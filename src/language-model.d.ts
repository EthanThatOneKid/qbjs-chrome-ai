// Type declarations for Chrome LanguageModel API
declare global {
  interface LanguageModelSession {
    prompt(
      prompt: string,
      options?: {
        responseConstraint?: unknown;
        signal?: AbortSignal;
      },
    ): Promise<string>;
    promptStreaming(
      prompt: string,
      options?: {
        responseConstraint?: unknown;
        signal?: AbortSignal;
      },
    ): ReadableStream<string>;
    destroy(): Promise<void>;
    clone(options?: { signal?: AbortSignal }): Promise<LanguageModelSession>;
    inputUsage: number;
    inputQuota: number;
  }

  interface LanguageModel {
    availability(): Promise<"available" | "unavailable" | "readily">;
    create(options?: {
      initialPrompts?: Array<{ role: string; content: string }>;
      monitor?: (model: {
        addEventListener: (
          type: string,
          listener: (event: { progress?: number }) => void,
        ) => void;
      }) => void;
    }): Promise<LanguageModelSession>;
  }

  const LanguageModel: LanguageModel;
}

export {};
