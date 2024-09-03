import { NextResponse } from "next/server";
import { Pinecone } from "@pinecone-database/pinecone";
import OpenAI from "openai";

// Define the system prompt for the assistant
const systemPrompt = `
You are an AI assistant for a "Rate My Professor" platform. Your primary function is to help students find suitable professors based on their queries using a RAG (Retrieval - Augmented Generation) system. For each user question, you will provide information on the top 3 most relevant professors.

Your knowledge base includes a comprehensive database of professor reviews, ratings, and course information. When a user asks a question or provides search criteria, you will:

1. Analyze the user's query to understand their requirements (e.g., subject area, teaching style, difficulty level).
2. Use the RAG system to retrieve the most relevant professor information from the database.
3. Present the top 3 professors who best match the query, including:
   - Professor's name
   - Subject / department
   - Overall rating (out of 5 stars)
   - A brief summary of student reviews
   - Any standout characteristics or teaching methods
4. Provide a concise explanation of why these professors were selected based on the user's criteria.
5. If the user's query is vague or broad, ask follow-up questions to refine the search and provide more accurate results.
6. Be prepared to answer additional questions about the professors or courses if the user requests more information.
7. Maintain a neutral and informative tone, presenting both positive and negative aspects of professors when relevant.
8. If asked about a specific professor not in the top 3, provide information about that professor if available in the database.
9. Remind users that professor performance can vary and encourage them to read full reviews for a comprehensive understanding.
10. Do not disclose any personal information about professors or students beyond what is publicly available in the reviews.

Always strive to provide helpful, accurate, and unbiased information to assist students in making informed decisions about their course selections.
`;

// Handle the POST request
export async function POST(req) {
    const data = await req.json();
    const pc = new Pinecone({
        apiKey: process.env.PINECONE_API_KEY,
    });
    const index = pc.index('rag').namespace('ns1');
    const openai = new OpenAI();

    const text = data[data.length - 1].content;
    const embedding = await openai.embeddings.create({
        model: 'text-embedding-3-small',
        input: text,
        encoding_format: 'float'
    });

    const results = await index.query({
        topK: 3,
        includeMetadata: true,
        vector: embedding.data[0].embedding
    });

    let resultString = '\n\nReturned results from vector db (done automatically):\n';
    results.matches.forEach((match) => {
        resultString += `
Professor: ${match.id}
Review: ${match.metadata.review}
Subject: ${match.metadata.subject}
Stars: ${match.metadata.stars}
\n\n`;
    });

    const lastMessage = data[data.length - 1];
    const lastMessageContent = lastMessage.content + resultString;
    const lastDataWithoutLastMessage = data.slice(0, data.length - 1);

    const completion = await openai.chat.completions.create({
        messages: [
            { role: 'system', content: systemPrompt },
            ...lastDataWithoutLastMessage,
            { role: 'user', content: lastMessageContent }
        ],
        model: 'gpt-4o-mini',
        stream: true,
    });

    const stream = new ReadableStream({
        async start(controller) {
            const encoder = new TextEncoder();
            try {
                for await (const chunk of completion) {
                    const content = chunk.choices[0]?.delta?.content;
                    if (content) {
                        const text = encoder.encode(content);
                        controller.enqueue(text);
                    }
                }
            } catch (err) {
                controller.error(err);
            } finally {
                controller.close();
            }
        },
    });

    return new NextResponse(stream);
}
