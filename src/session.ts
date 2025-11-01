import "./language-model.d.ts";
import type { ChatMessage, FewShotSample } from "./types.ts";
import { retrieveRelevantExamples } from "./retrieval.ts";
import fewShotSamples from "./samples.json" with { type: "json" };

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

// Convert few-shot samples to initialPrompts format
function formatFewShotExamples(
  samples: FewShotSample[],
): Array<{ role: string; content: string }> {
  const examples: Array<{ role: string; content: string }> = [];

  for (const sample of samples) {
    if (!sample?.description || !sample?.code) continue;

    // Add user message
    examples.push({
      role: "user",
      content: sample.description,
    });

    // Add model response formatted as JSON (matching structured output format)
    examples.push({
      role: "assistant",
      content: JSON.stringify({ code: sample.code }),
    });
  }

  return examples;
}

// Convert conversation history to initialPrompts format
// Limits to most recent N messages to avoid exceeding input quota
function formatConversationHistory(
  messages: ChatMessage[],
  maxHistoryPairs: number = 5,
): Array<{ role: string; content: string }> {
  const history: Array<{ role: string; content: string }> = [];

  // Extract user/system pairs from conversation history, starting from most recent
  // Skip error messages and only include user/system pairs
  const pairs: Array<{ user: ChatMessage; system: ChatMessage }> = [];

  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];
    if (msg.role === "user") {
      // Look ahead for the corresponding system response
      if (i + 1 < messages.length && messages[i + 1].role === "system") {
        pairs.push({
          user: msg,
          system: messages[i + 1],
        });
        i++; // Skip the system message we already processed
      }
    }
  }

  // Take only the most recent N pairs to avoid exceeding input quota
  const recentPairs = pairs.slice(-maxHistoryPairs);

  for (const pair of recentPairs) {
    history.push({
      role: "user",
      content: pair.user.text,
    });
    history.push({
      role: "assistant",
      content: JSON.stringify({ code: pair.system.text }),
    });
  }

  return history;
}

// Estimate approximate character count of prompts (rough token estimate)
function estimatePromptSize(
  prompts: Array<{ role: string; content: string }>,
): number {
  return prompts.reduce((sum, p) => sum + p.content.length, 0);
}

// Session management - no longer cached, create new session per request
export async function initializeSession(
  userPrompt: string,
  conversationHistory: ChatMessage[] = [],
  maxExamples: number = 8, // Reduced from 12 to avoid exceeding input quota
): Promise<LanguageModelSession> {
  // Check availability - pass same options as create() for consistency
  const availability = await LanguageModel.availability({
    outputLanguage: "en",
  });
  if (availability === "unavailable") {
    throw new Error(
      "Language model is unavailable. Please check your Chrome version and system requirements.",
    );
  }

  // Use imported few-shot samples (bundled at build time)
  const allSamples: FewShotSample[] = fewShotSamples as FewShotSample[];

  // Retrieve relevant examples based on user prompt
  const relevantSamples = retrieveRelevantExamples(
    userPrompt,
    allSamples,
    maxExamples,
  );

  // Log which samples are being used for few-shot
  console.log(
    `[Few-shot] Using ${relevantSamples.length} examples for prompt: "${userPrompt}"`,
  );
  relevantSamples.forEach((sample, index) => {
    console.log(
      `[Few-shot] ${index + 1}. ${sample.description.substring(0, 80)}${
        sample.description.length > 80 ? "..." : ""
      }`,
    );
  });

  // Format few-shot examples
  const formattedExamples = formatFewShotExamples(relevantSamples);

  // Format conversation history (previous user/system pairs)
  // Start with fewer history pairs and adjust based on examples size
  let historyPrompts = formatConversationHistory(conversationHistory, 2);

  // Create base prompts array:
  // 1. System prompt
  const basePrompts: Array<{ role: string; content: string }> = [
    {
      role: "system",
      content: SYSTEM_PROMPT,
    },
  ];

  // Rough size estimation: try to keep under ~100k chars total
  // (Approximate limit - adjust based on actual quota behavior)
  const MAX_ESTIMATED_SIZE = 100000;
  let currentSize = estimatePromptSize(basePrompts);

  // Add examples, but trim if getting too large
  const examplePrompts: Array<{ role: string; content: string }> = [];
  for (const example of formattedExamples) {
    const exampleSize = estimatePromptSize([example]);
    if (
      currentSize + exampleSize + estimatePromptSize(historyPrompts) >
        MAX_ESTIMATED_SIZE
    ) {
      console.warn(
        `[Session] Trimming examples to avoid exceeding input quota. Size: ${currentSize}`,
      );
      break;
    }
    examplePrompts.push(example);
    currentSize += exampleSize;
  }

  // Adjust history if still too large
  if (currentSize + estimatePromptSize(historyPrompts) > MAX_ESTIMATED_SIZE) {
    historyPrompts = formatConversationHistory(conversationHistory, 1);
    console.warn(
      `[Session] Reduced history pairs to 1 due to size constraints`,
    );
  }

  // Create initial prompts array:
  // 1. System prompt
  // 2. Few-shot examples (from retrieval, possibly trimmed)
  // 3. Conversation history (user/system pairs, possibly reduced)
  // Note: Current user prompt is added via prompt() call, not in initialPrompts
  const initialPrompts: Array<{ role: string; content: string }> = [
    ...basePrompts,
    ...examplePrompts,
    ...historyPrompts,
  ];

  // Log estimated size for debugging (rough estimate: ~4 chars per token)
  const finalSize = estimatePromptSize(initialPrompts);
  console.log(
    `[Session] Estimated prompt size: ~${
      Math.round(finalSize / 4)
    } tokens (${finalSize} chars), Examples: ${
      examplePrompts.length / 2
    }, History pairs: ${historyPrompts.length / 2}`,
  );

  // Create new session with system prompt, few-shot examples, and conversation history
  const session = await LanguageModel.create({
    initialPrompts,
    outputLanguage: "en", // Specify output language for optimal quality and safety attestation
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
  if (!session) {
    return;
  }

  try {
    const destroyResult = session.destroy();
    // Handle both Promise and non-Promise return values
    if (destroyResult && typeof destroyResult.then === "function") {
      await destroyResult.catch(() => {
        // Ignore cleanup errors
      });
    }
  } catch {
    // Ignore cleanup errors if destroy throws synchronously
  }
}
