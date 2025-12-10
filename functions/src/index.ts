import * as z from "zod"; // Use zod directly
import * as admin from "firebase-admin";

// Import Genkit & Plugins
import { genkit } from "genkit";
import { vertexAI } from "@genkit-ai/vertexai";
import { onCall } from "firebase-functions/v2/https";

// Initialize Firebase Admin
admin.initializeApp();
const db = admin.firestore();

// Initialize Genkit
const ai = genkit({
    plugins: [vertexAI({ location: 'us-central1' })],
    model: 'vertexai/gemini-2.0-flash-lite-001',
});

// --- DEFINE TOOLS ---

const checkAvailability = ai.defineTool(
    {
        name: "checkAvailability",
        description: "Checks if a specific date has any free slots.",
        inputSchema: z.object({ date: z.string().describe("YYYY-MM-DD format") }),
        outputSchema: z.object({ available: z.boolean(), slots: z.array(z.string()) }),
    },
    async ({ date }) => {
        const snapshot = await db.collection("schedule").where("date", "==", date).get();
        const busyTimes = snapshot.docs.map(doc => doc.data().time);
        const allSlots = ["09:00", "10:00", "11:00", "13:00", "14:00", "15:00", "16:00"];
        const freeSlots = allSlots.filter(slot => !busyTimes.includes(slot));
        return { available: freeSlots.length > 0, slots: freeSlots };
    }
);

const getProductPrice = ai.defineTool(
    {
        name: "getProductPrice",
        description: "Gets the price of a service or product.",
        inputSchema: z.object({ productName: z.string() }),
        outputSchema: z.object({ price: z.number().optional(), found: z.boolean() }),
    },
    async ({ productName }) => {
        const snapshot = await db.collection("products").get();
        const product = snapshot.docs.find(doc =>
            doc.data().name.toLowerCase().includes(productName.toLowerCase())
        );
        if (product) {
            return { price: parseFloat(product.data().price), found: true };
        }
        return { found: false };
    }
);

const createQuote = ai.defineTool(
    {
        name: "createQuote",
        description: "Creates a formal quote for the client.",
        inputSchema: z.object({
            items: z.array(z.object({ description: z.string(), price: z.number() })),
            clientName: z.string().optional(),
        }),
        outputSchema: z.object({ quoteId: z.string(), total: z.number(), success: z.boolean() }),
    },
    async ({ items, clientName }) => {
        const total = items.reduce((sum, item) => sum + item.price, 0);
        const quoteRef = await db.collection("quotes").add({
            items,
            total,
            clientName: clientName || "Valued Client",
            status: "draft",
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        return { quoteId: quoteRef.id, total, success: true };
    }
);

const listInvoices = ai.defineTool(
    {
        name: "listInvoices",
        description: "Lists invoices, useful for checking unpaid bills.",
        inputSchema: z.object({
            status: z.enum(['paid', 'unpaid', 'overdue', 'all']).optional(),
        }),
        outputSchema: z.object({
            invoices: z.array(z.object({ id: z.string(), amount: z.number(), status: z.string() })),
            found: z.boolean(),
        }),
    },
    async ({ status }) => {
        let query: admin.firestore.Query = db.collection("invoices");
        if (status && status !== 'all') {
            query = query.where("status", "==", status);
        }
        const snapshot = await query.limit(5).get();
        const invoices = snapshot.docs.map(doc => ({
            id: doc.id,
            amount: doc.data().amount || 0,
            status: doc.data().status || 'unknown'
        }));
        return { invoices, found: invoices.length > 0 };
    }
);

const bookAppointment = ai.defineTool(
    {
        name: "bookAppointment",
        description: "Books a specific time slot for a client.",
        inputSchema: z.object({
            date: z.string().describe("YYYY-MM-DD"),
            time: z.string().describe("HH:MM (24h)"),
            serviceType: z.string(),
            clientName: z.string().optional(),
        }),
        outputSchema: z.object({ success: z.boolean(), bookingId: z.string().optional(), message: z.string() }),
    },
    async ({ date, time, serviceType, clientName }) => {
        const existing = await db.collection("schedule")
            .where("date", "==", date)
            .where("time", "==", time)
            .get();

        if (!existing.empty) {
            return { success: false, message: "Slot already taken." };
        }

        const ref = await db.collection("schedule").add({
            date,
            time,
            serviceType,
            clientName: clientName || "Valued Client",
            status: "booked",
            createdAt: admin.firestore.FieldValue.serverTimestamp()
        });
        return { success: true, bookingId: ref.id, message: "Appointment confirmed." };
    }
);

const updateSchedule = ai.defineTool(
    {
        name: "updateSchedule",
        description: "Admin tool to block off time or days. Use this to mark unavailability.",
        inputSchema: z.object({
            date: z.string().describe("YYYY-MM-DD"),
            time: z.string().optional().describe("HH:MM. If omitted, blocks entire day."),
            reason: z.string().optional(),
            status: z.enum(['unavailable', 'holiday', 'training', 'open']),
        }),
        outputSchema: z.object({ success: z.boolean(), updatedSlots: z.number() }),
    },
    async ({ date, time, reason, status }) => {
        const slotsToBlock = time ? [time] : ["09:00", "10:00", "11:00", "13:00", "14:00", "15:00", "16:00"];
        const batch = db.batch();

        for (const slot of slotsToBlock) {
            const snapshot = await db.collection("schedule")
                .where("date", "==", date)
                .where("time", "==", slot)
                .get();

            if (snapshot.empty) {
                const newDoc = db.collection("schedule").doc();
                batch.set(newDoc, { date, time: slot, status, reason: reason || "Admin Blocked" });
            } else {
                snapshot.docs.forEach(doc => {
                    batch.update(doc.ref, { status, reason: reason || "Admin Updated" });
                });
            }
        }
        await batch.commit();
        return { success: true, updatedSlots: slotsToBlock.length };
    }
);

const searchKnowledgeBase = ai.defineTool(
    {
        name: "searchKnowledgeBase",
        description: "Searches the internal knowledge base for answers to questions about warranties, procedures, or general 'how-to' info.",
        inputSchema: z.object({
            query: z.string().describe("The search keywords or question."),
        }),
        outputSchema: z.object({
            results: z.array(z.object({ title: z.string(), content: z.string() })),
            found: z.boolean(),
        }),
    },
    async ({ query }) => {
        // "Lite" RAG: Fetch all and filter in-memory (good for <100 docs)
        const snapshot = await db.collection("knowledge").get();
        const allDocs = snapshot.docs.map(doc => doc.data());

        const keywords = query.toLowerCase().split(' ').filter(k => k.length > 3);

        const scored = allDocs.map(doc => {
            let score = 0;
            const text = (doc.title + " " + doc.content).toLowerCase();
            if (text.includes(query.toLowerCase())) score += 10; // Exact phrase
            keywords.forEach(k => {
                if (text.includes(k)) score += 1;
            });
            return { doc, score };
        });

        const top = scored
            .filter(x => x.score > 0)
            .sort((a, b) => b.score - a.score)
            .slice(0, 3)
            .map(x => ({ title: x.doc.title, content: x.doc.content }));

        return { results: top, found: top.length > 0 };
    }
);

// --- DEFINE FLOW ---

// 1. Define the Genkit Flow logic
export const clientAgentFlow = ai.defineFlow(
    {
        name: "clientAgentFlow",
        inputSchema: z.object({
            message: z.string().optional(),
            audio: z.object({
                data: z.string(), // Base64
                mimeType: z.string()
            }).optional(),
            userId: z.string().nullable().optional(),
        }),
        outputSchema: z.object({ text: z.string() }),
    },
    async (input) => {
        let context = "You are a helpful assistant for 'Wilco Plumbing'.";
        if (input.userId) {
            const userDoc = await db.collection("clients").doc(input.userId).get();
            if (userDoc.exists) {
                context += ` You are speaking with ${userDoc.data()?.name}.`;
            }
        }

        // Construct Multimodal Prompt
        let prompt: any[] = [];
        if (input.message) prompt.push({ text: input.message });
        if (input.audio) {
            prompt.push({
                media: {
                    url: `data:${input.audio.mimeType};base64,${input.audio.data}`
                }
            });
        }

        // Fallback if empty (shouldn't happen with UI checks)
        if (prompt.length === 0) prompt.push({ text: "Hello" });

        const response = await ai.generate({
            prompt: prompt,
            system: `${context} 
               You are a smart, helpful AI assistant for 'Wilco Plumbing'.
               IMPORTANT: You MUST reply in the same language as the user's last message (e.g. French -> French, English -> English).
               
               Your capabilities:
               - Check schedule availability (use 'checkAvailability').
               - Create formal quotes (use 'createQuote').
               - Book appointments (use 'bookAppointment' - CHECK AVAILABILITY FIRST).
               - Check unpaid invoices (use 'listInvoices').
               - Admin: Block off time/days (use 'updateSchedule').
               - Knowledge Base: Answer general questions about warranties, services, or procedures by searching the database (use 'searchKnowledgeBase').

               If the user asks a general question (e.g., "Find me a plumber" or "I have a leak"), politely explain you can help book an appointment or check availability. Do not refuse to answer; instead, guide them to your tools.
               `,
            tools: [checkAvailability, getProductPrice, createQuote, listInvoices, bookAppointment, updateSchedule, searchKnowledgeBase],
        });

        return { text: response.text };
    }
);

// 2. Wrap it in a Firebase Cloud Function
export const clientAgent = onCall(
    {
        cors: true, // Enable CORS for web client
        memory: "1GiB",
        timeoutSeconds: 120,
    },
    async (request) => {
        // request.data contains the arguments passed from the client
        try {
            console.log("Starting clientAgentFlow with input:", JSON.stringify(request.data));
            const result = await clientAgentFlow(request.data);
            console.log("Flow completed successfully:", JSON.stringify(result));
            return result;
        } catch (e: any) {
            console.error("Flow Error:", e);
            throw new Error(e.message);
        }
    }
);
