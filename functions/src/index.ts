import * as z from "zod";
import * as admin from "firebase-admin";

// Import Genkit & Plugins
import { genkit } from "genkit";
import { googleAI, gemini15Flash } from "@genkit-ai/googleai";
import { onFlow } from "@genkit-ai/firebase/functions";

// Initialize Firebase Admin (for Firestore Access)
admin.initializeApp();
const db = admin.firestore();

// Initialize Genkit
const ai = genkit({
    plugins: [googleAI()],
    model: gemini15Flash, // Default model
});

// --- DEFINE TOOLS ---

// Tool: Check Schedule Availability
const checkAvailability = ai.defineTool(
    {
        name: "checkAvailability",
        description: "Checks if a specific date has any free slots.",
        inputSchema: z.object({ date: z.string().describe("YYYY-MM-DD format") }),
        outputSchema: z.object({ available: z.boolean(), slots: z.array(z.string()) }),
    },
    async ({ date }) => {
        // Basic mock logic: Check existing tasks in Firestore
        const snapshot = await db.collection("schedule").where("date", "==", date).get();
        const busyTimes = snapshot.docs.map(doc => doc.data().time);

        // Assume 9-5 workday
        const allSlots = ["09:00", "10:00", "11:00", "13:00", "14:00", "15:00", "16:00"];
        const freeSlots = allSlots.filter(slot => !busyTimes.includes(slot));

        return { available: freeSlots.length > 0, slots: freeSlots };
    }
);

// Tool: Get Product Price
const getProductPrice = ai.defineTool(
    {
        name: "getProductPrice",
        description: "Gets the price of a service or product.",
        inputSchema: z.object({ productName: z.string() }),
        outputSchema: z.object({ price: z.number().optional(), found: z.boolean() }),
    },
    async ({ productName }) => {
        // Simple search (case-insensitive)
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

// --- DEFINE FLOW ---

export const clientAgent = onFlow(
    ai,
    {
        name: "clientAgent",
        inputSchema: z.object({
            message: z.string(),
            userId: z.string().optional(), // To look up client data
        }),
        outputSchema: z.object({ text: z.string() }),
        authPolicy: "public-open", // For demo purposes, allow open access
    },
    async (input) => {
        // 1. Fetch Context (Client Name, etc.)
        let context = "You are a helpful assistant for 'Wilco Plumbing'.";
        if (input.userId) {
            const userDoc = await db.collection("clients").doc(input.userId).get();
            if (userDoc.exists) {
                context += ` You are speaking with ${userDoc.data()?.name}.`;
            }
        }

        // 2. Call LLM with Tools
        const response = await ai.generate({
            prompt: input.message,
            system: `${context} 
               Use the available tools to check schedule availability or check pricing when asked. 
               If quoting, give an estimate based on the product price.
               Be professional and concise.`,
            tools: [checkAvailability, getProductPrice],
        });

        return { text: response.text() };
    }
);
