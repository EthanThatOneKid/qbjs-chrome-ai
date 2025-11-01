import "./language-model.d.ts";
import type { FewShotSample } from "./types.ts";

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

  // Limit to a reasonable number of examples to stay within token limits
  // Using up to 12 examples based on the few-shot.ts script default
  const maxExamples = Math.min(12, samples.length);

  for (let i = 0; i < maxExamples; i++) {
    const sample = samples[i];
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

// Session management
let session: LanguageModelSession | null = null;

export async function initializeSession(): Promise<LanguageModelSession> {
  if (session) {
    return session;
  }

  // Check availability
  const availability = await LanguageModel.availability();
  if (availability === "unavailable") {
    throw new Error(
      "Language model is unavailable. Please check your Chrome version and system requirements.",
    );
  }

  // Load few-shot samples and format them as initial prompts
  const samples = await loadFewShotSamples();
  const fewShotExamples = formatFewShotExamples(samples);

  // Create initial prompts array: system prompt + few-shot examples
  const initialPrompts: Array<{ role: string; content: string }> = [
    {
      role: "system",
      content: SYSTEM_PROMPT,
    },
    ...fewShotExamples,
  ];

  // Create session with system prompt and few-shot examples
  session = await LanguageModel.create({
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

export function destroySession(): Promise<void> {
  if (session) {
    return session.destroy().catch(() => {
      // Ignore cleanup errors
    });
  }
  return Promise.resolve();
}
