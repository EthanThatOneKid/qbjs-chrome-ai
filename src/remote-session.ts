import {
  GenerationConfig,
  GenerativeModel,
  GoogleGenerativeAI,
  HarmBlockThreshold,
  HarmCategory,
  SafetySetting,
} from "@google/genai";
import type { ChatMessage } from "./types.ts";
import { SYSTEM_PROMPT } from "./session.ts";

// Function to initialize the remote session with the API key
export function initializeRemoteSession(apiKey: string) {
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
  return model;
}

// Format conversation history for the remote API
function formatRemoteConversationHistory(
  messages: ChatMessage[],
  maxHistoryPairs: number = 10,
): { role: string; parts: { text: string }[] }[] {
  const history: { role: string; parts: { text: string }[] }[] = [];
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
  model: GenerativeModel,
  userPrompt: string,
  conversationHistory: ChatMessage[],
) {
  const generationConfig: GenerationConfig = {
    temperature: 0.7,
    topP: 1,
    topK: 1,
    maxOutputTokens: 8192,
    responseMimeType: "text/plain",
  };

  const safetySettings: SafetySetting[] = [
    {
      category: HarmCategory.HARM_CATEGORY_HARASSMENT,
      threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
    },
    // ... other safety settings
  ];

  const chat = model.startChat({
    generationConfig,
    safetySettings,
    history: [
      { role: "user", parts: [{ text: SYSTEM_PROMPT }] },
      { role: "model", parts: [{ text: " entendido." }] },
      ...formatRemoteConversationHistory(conversationHistory),
    ],
  });

  const result = await chat.sendMessage(userPrompt);
  return result.response.text();
}
