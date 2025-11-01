import "./language-model.d.ts";
import type { FewShotSample, ChatMessage } from "./types.ts";
import { retrieveRelevantExamples } from "./retrieval.ts";

// System prompt to guide QBJS code generation
export const SYSTEM_PROMPT =
  `You are an expert QB64/QBJS programmer. Generate valid QB64 code based on user requests.

QB64/QBJS syntax notes:
- Use PRINT for output
- Variables don't need declaration (dynamic typing)
- Use DIM for arrays
- Line numbers are optional
- Functions use FUNCTION/END FUNCTION
- Subroutines use SUB/END SUB
- Always use SCREEN 12 at the beginning of the program to set graphics mode
- Use COLOR to set text/background colors

Always respond with valid, runnable QB64 code. Do not include explanations or markdown code blocks in your response - only the raw QB64 code. Always include SCREEN 12 at the start of the code.`;

// Structured output schema for QBJS code generation
export const codeResponseSchema = {
  type: "object",
  properties: {
    code: { type: "string" },
  },
  required: ["code"],
} as const;

// Load few-shot samples from samples.json
async function loadFewShotSamples(): Promise<FewShotSample[]> {
  try {
    // Try multiple paths to find samples.json
    // First try relative to current location (for bundled code in dist/)
    let response = await fetch("./samples.json");

    // If that fails, try src/ path (for development)
    if (!response.ok) {
      response = await fetch("./src/samples.json");
    }

    // If that also fails, try from root
    if (!response.ok) {
      response = await fetch("/src/samples.json");
    }

    if (!response.ok) {
      console.warn("Could not load few-shot samples:", response.statusText);
      return [];
    }

    const samples: FewShotSample[] = await response.json();
    return Array.isArray(samples) ? samples : [];
  } catch (error) {
    console.warn("Error loading few-shot samples:", error);
    return [];
  }
}

// Convert few-shot samples to initialPrompts format
function formatFewShotExamples(
  samples: FewShotSample[],
): Array<{ role: string; content: string }> {
  const examples: Array<{ role: string; content: string }> = [];

  for (const sample of samples) {
    if (!sample?.input || !sample?.output) continue;

    // Add user message
    examples.push({
      role: "user",
      content: sample.input,
    });

    // Add model response formatted as JSON (matching structured output format)
    examples.push({
      role: "model",
      content: JSON.stringify({ code: sample.output }),
    });
  }

  return examples;
}

// Convert conversation history to initialPrompts format
function formatConversationHistory(
  messages: ChatMessage[],
): Array<{ role: string; content: string }> {
  const history: Array<{ role: string; content: string }> = [];

  // Extract user/system pairs from conversation history
  // Skip error messages and only include user/system pairs
  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];
    if (msg.role === "user") {
      history.push({
        role: "user",
        content: msg.text,
      });
      // Look ahead for the corresponding system response
      if (i + 1 < messages.length && messages[i + 1].role === "system") {
        history.push({
          role: "model",
          content: JSON.stringify({ code: messages[i + 1].text }),
        });
        i++; // Skip the system message we just added
      }
    }
  }

  return history;
}

// Session management - no longer cached, create new session per request
export async function initializeSession(
  userPrompt: string,
  conversationHistory: ChatMessage[] = [],
  maxExamples: number = 12,
): Promise<LanguageModelSession> {
  // Check availability
  const availability = await LanguageModel.availability();
  if (availability === "unavailable") {
    throw new Error(
      "Language model is unavailable. Please check your Chrome version and system requirements.",
    );
  }

  // Load all few-shot samples
  const allSamples = await loadFewShotSamples();

  // Retrieve relevant examples based on user prompt
  const relevantSamples = retrieveRelevantExamples(
    userPrompt,
    allSamples,
    maxExamples,
  );

  // Format few-shot examples
  const fewShotExamples = formatFewShotExamples(relevantSamples);

  // Format conversation history (previous user/system pairs)
  const historyPrompts = formatConversationHistory(conversationHistory);

  // Create initial prompts array:
  // 1. System prompt
  // 2. Few-shot examples (from retrieval)
  // 3. Conversation history (user/system pairs)
  // Note: Current user prompt is added via prompt() call, not in initialPrompts
  const initialPrompts: Array<{ role: string; content: string }> = [
    {
      role: "system",
      content: SYSTEM_PROMPT,
    },
    ...fewShotExamples,
    ...historyPrompts,
  ];

  // Create new session with system prompt, few-shot examples, and conversation history
  const session = await LanguageModel.create({
    initialPrompts,
    monitor(m) {
      m.addEventListener("downloadprogress", (e: { progress?: number }) => {
        const progress = e.progress;
        if (progress !== undefined && progress > 0 && progress < 1) {
          // Could update UI with download progress if needed
          console.log(`Downloading model: ${Math.round(progress * 100)}%`);
        }
      });
    },
  });

  return session;
}

// Note: Since we create sessions per request, this function is now
// mainly for cleanup when needed. Sessions should be destroyed
// after use if memory is a concern.
export async function destroySession(
  session: LanguageModelSession | null,
): Promise<void> {
  if (session) {
    return session.destroy().catch(() => {
      // Ignore cleanup errors
    });
  }
  return Promise.resolve();
}
