import { GoogleGenAI } from "@google/genai";
import type { ChatMessage } from "./types.ts";
import { SYSTEM_PROMPT } from "./session.ts";

// Function to initialize the remote session with the API key
export function initializeRemoteSession(apiKey: string) {
  return new GoogleGenAI({ apiKey });
}

// Format conversation history for the remote API
function formatRemoteConversationHistory(
  messages: ChatMessage[],
  maxHistoryPairs: number = 10,
): Array<{ role: "user" | "model"; parts: Array<{ text: string }> }> {
  const history: Array<
    { role: "user" | "model"; parts: Array<{ text: string }> }
  > = [];
  const recentMessages = messages.slice(-maxHistoryPairs * 2);

  for (const msg of recentMessages) {
    if (msg.role === "user") {
      history.push({ role: "user", parts: [{ text: msg.text }] });
    } else if (msg.role === "system") {
      history.push({ role: "model", parts: [{ text: msg.text }] });
    }
  }
  return history;
}

// Function to generate a response from the remote API
export async function generateRemoteResponse(
  ai: GoogleGenAI,
  userPrompt: string,
  conversationHistory: ChatMessage[],
): Promise<string> {
  // Build contents array with conversation history and current user prompt
  // The system prompt is included in the first message to establish context
  const formattedHistory = formatRemoteConversationHistory(conversationHistory);
  const contents: Array<
    { role: "user" | "model"; parts: Array<{ text: string }> }
  > = [];

  if (formattedHistory.length === 0) {
    // First message: prepend system prompt to establish the assistant's role
    contents.push({
      role: "user",
      parts: [{
        text:
          `${SYSTEM_PROMPT}\n\nNow, please generate QBJS code for: ${userPrompt}`,
      }],
    });
  } else {
    // Continuing conversation: add history and current prompt
    // System prompt context is maintained through conversation history
    contents.push(...formattedHistory);
    contents.push({ role: "user", parts: [{ text: userPrompt }] });
  }

  // Use models.generateContent with full conversation history
  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents,
    config: {
      temperature: 0.7,
      topP: 1,
      topK: 1,
      maxOutputTokens: 8192,
      responseMimeType: "text/plain",
    },
  });
  if (response.text === undefined) {
    throw new Error("No response text");
  }

  return response.text;
}
