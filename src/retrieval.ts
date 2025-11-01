import type { FewShotSample } from "./types.ts";

/**
 * Simple tokenization - splits on whitespace and removes empty strings
 */
function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/\s+/)
    .filter((word) => word.length > 0);
}

/**
 * Count how many times any of the search words appear in the target text
 */
function countMatches(searchWords: string[], targetText: string): number {
  const lowerTarget = targetText.toLowerCase();
  let count = 0;
  for (const word of searchWords) {
    // Count occurrences of the word as a whole word (to avoid partial matches)
    const regex = new RegExp(`\\b${word}\\b`, "gi");
    const matches = lowerTarget.match(regex);
    if (matches) {
      count += matches.length;
    }
  }
  return count;
}

/**
 * Retrieve the most relevant examples based on keyword matching in descriptions and code.
 * 
 * Scoring:
 * - Description matches: 2x weight (higher priority)
 * - Code matches: 1x weight
 * - Multiple matches increase score
 * 
 * @param userPrompt - The user's current request
 * @param samples - All available few-shot samples
 * @param maxExamples - Maximum number of examples to return (default: 12)
 * @returns Array of relevant samples sorted by relevance score (highest first)
 */
export function retrieveRelevantExamples(
  userPrompt: string,
  samples: FewShotSample[],
  maxExamples: number = 12,
): FewShotSample[] {
  if (!userPrompt.trim() || samples.length === 0) {
    // If no prompt or no samples, return first N samples
    return samples.slice(0, maxExamples);
  }

  const searchWords = tokenize(userPrompt);

  // Score each sample
  const scoredSamples = samples.map((sample) => {
    const descriptionMatches = countMatches(
      searchWords,
      sample.input || "",
    );
    const codeMatches = countMatches(
      searchWords,
      sample.output || "",
    );

    // Description matches weighted 2x, code matches weighted 1x
    const score = descriptionMatches * 2 + codeMatches * 1;

    return {
      sample,
      score,
      descriptionMatches,
      codeMatches,
    };
  });

  // Sort by score (highest first), then by description matches, then by code matches
  scoredSamples.sort((a, b) => {
    if (b.score !== a.score) {
      return b.score - a.score;
    }
    if (b.descriptionMatches !== a.descriptionMatches) {
      return b.descriptionMatches - a.descriptionMatches;
    }
    return b.codeMatches - a.codeMatches;
  });

  // Return top N samples
  return scoredSamples
    .slice(0, maxExamples)
    .map((scored) => scored.sample);
}
