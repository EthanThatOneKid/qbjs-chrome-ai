import { create, insert, search } from "@orama/orama";
import type { FewShotSample } from "./types.ts";

// Cached Orama database instance
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let cachedDB: any = null;
let cachedSamplesHash: string = "";

/**
 * Create a hash of samples array for cache invalidation
 */
function hashSamples(samples: FewShotSample[]): string {
  return `${samples.length}-${samples[0]?.description || ""}-${
    samples[samples.length - 1]?.description || ""
  }`;
}

/**
 * Initialize or get cached Orama database with samples indexed
 * Note: All Orama operations are sync in v3.0+
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getOrCreateDatabase(samples: FewShotSample[]): any {
  const samplesHash = hashSamples(samples);

  // Return cached database if samples haven't changed
  if (cachedDB && cachedSamplesHash === samplesHash) {
    return cachedDB;
  }

  // Create new database
  const db = create({
    schema: {
      description: "string", // Description/prompt
      code: "string", // Code
    },
  });

  // Index all samples (insert is sync in Orama 3.0+)
  for (const sample of samples) {
    insert(db, {
      description: sample.description || "",
      code: sample.code || "",
    });
  }

  // Cache the database
  cachedDB = db;
  cachedSamplesHash = samplesHash;

  return db;
}

/**
 * Extract meaningful keywords from user prompt, filtering out common stop words
 */
function extractKeywords(prompt: string): string[] {
  const stopWords = new Set([
    "a",
    "an",
    "and",
    "are",
    "as",
    "at",
    "be",
    "by",
    "for",
    "from",
    "has",
    "he",
    "in",
    "is",
    "it",
    "its",
    "of",
    "on",
    "that",
    "the",
    "to",
    "was",
    "will",
    "with",
    "please",
    "generate",
    "create",
    "make",
    "show",
    "draw",
    "display",
    "code",
    "program",
  ]);

  return prompt
    .toLowerCase()
    .split(/\s+/)
    .filter((word) => word.length > 1 && !stopWords.has(word));
}

/**
 * Retrieve the most relevant examples using Orama full-text search.
 *
 * Scoring:
 * - Only searches in description (input) field
 * - Uses Orama's built-in relevance scoring with typo tolerance
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

  // Get or create indexed database
  const db = getOrCreateDatabase(samples);

  // Extract meaningful keywords from the prompt
  const keywords = extractKeywords(userPrompt);
  // Use keywords if available, otherwise fall back to full prompt
  const searchTerm = keywords.length > 0 ? keywords.join(" ") : userPrompt;

  // Search only in description field
  // Note: Orama 3.0+ search is sync, but TypeScript types may indicate Promise
  const descriptionResults = search(db, {
    term: searchTerm,
    properties: ["description"],
    limit: maxExamples * 2, // Get more results for better selection
    tolerance: 1, // Allow 1 character typo tolerance
  }) as {
    hits: Array<
      { score: number; document: { description: string; code: string } }
    >;
  };

  // Combine results with scores
  // Use a unique key (description + code) to avoid duplicates
  const scoreMap = new Map<string, { sample: FewShotSample; score: number }>();

  // Process description matches only
  for (const hit of descriptionResults.hits) {
    // Create a unique key from the document content
    const uniqueKey = `${hit.document.description}|||${hit.document.code}`;
    const existing = scoreMap.get(uniqueKey);
    if (existing) {
      // Add to existing score if duplicate
      existing.score += hit.score;
    } else {
      // Find the original sample by matching description/code
      const sample = samples.find(
        (s) =>
          s.description === hit.document.description &&
          s.code === hit.document.code,
      );
      if (sample) {
        scoreMap.set(uniqueKey, {
          sample,
          score: hit.score,
        });
      }
    }
  }

  // Convert to array and sort by score
  const scoredSamples = Array.from(scoreMap.values());

  // Sort by score (highest first)
  scoredSamples.sort((a, b) => b.score - a.score);

  // Return top N samples (already deduplicated)
  return scoredSamples
    .slice(0, maxExamples)
    .map((scored) => scored.sample);
}
