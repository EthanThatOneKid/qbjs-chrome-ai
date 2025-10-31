import "./language-model.d.ts";

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

  // Create session with system prompt
  session = await LanguageModel.create({
    initialPrompts: [
      {
        role: "system",
        content: SYSTEM_PROMPT,
      },
    ],
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
