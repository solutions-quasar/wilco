import * as z from "zod"; // Use zod directly
import * as admin from "firebase-admin";

// Import Genkit & Plugins
import { genkit } from "genkit";
import { googleAI, gemini15Flash } from "@genkit-ai/googleai";
import { onCall } from "firebase-functions/v2/https";

// Initialize Firebase Admin
admin.initializeApp();
const db = admin.firestore();

// Initialize Genkit
const ai = genkit({
    plugins: [googleAI()],
    model: gemini15Flash,
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

// --- DEFINE FLOW ---

// 1. Define the Genkit Flow logic
export const clientAgentFlow = ai.defineFlow(
    {
        name: "clientAgentFlow",
        inputSchema: z.object({
            message: z.string(),
            userId: z.string().optional(),
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

        const response = await ai.generate({
            prompt: input.message,
            system: `${context} 
               Use the available tools to check schedule availability.
               If quoting, give an estimate based on the product price.`,
            tools: [checkAvailability, getProductPrice],
        });

        return { text: response.text };
    }
);

// 2. Wrap it in a Firebase Cloud Function
export const clientAgent = onCall(
    {
        cors: true, // Enable CORS for web client
        secrets: ["GOOGLE_GENAI_API_KEY"], // <--- GRANT ACCESS TO THE KEY
    },
    async (request) => {
        // request.data contains the arguments passed from the client
        try {
            const result = await clientAgentFlow(request.data);
            return result;
        } catch (e: any) {
            console.error("Flow Error:", e);
            throw new Error(e.message);
        }
    }
);
