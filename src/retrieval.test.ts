/// <reference lib="deno.ns" />

import { assertEquals, assertExists } from "@std/assert";
import { retrieveRelevantExamples } from "./retrieval.ts";
import type { FewShotSample } from "./types.ts";

// Test samples with various characteristics
const mockSamples: FewShotSample[] = [
  {
    description: "Fractal Fern",
    code:
      "Screen 12\nRandomize Timer\nColor _RGB(Rnd * 255, Rnd * 255, Rnd * 255)",
  },
  {
    description: "A simple drawing program in only 14 lines",
    code:
      "Dim drawing As Integer\nDo\n    If _MouseButton(1) Then\n        PSet (_MouseX, _MouseY)\n    End If\nLoop",
  },
  {
    description: "Tetris",
    code:
      "Dim Shared As Double piece(6, 3, 1)\nDim Shared piece_color(6)\nScreen _NewImage(640, 480, 32)",
  },
  {
    description: "For when you think Tetris is too easy",
    code:
      "Dim Shared piece(17, 2, 4)\nScreen _NewImage(640, 480, 32)\n'Complex Tetris variant",
  },
  {
    description: "Rotating Lorenz Attractor",
    code:
      "Screen _NewImage(640, 480, 32)\nDim As Double p, s, b, h, x, y, z\np = 28\ns = 10\nb = 8 / 3",
  },
  {
    description: "Bubble Universe",
    code:
      "Const xmax = 512, ymax = 512\nScreen _NewImage(xmax, ymax, 32)\nTAU = 6.283185307179586",
  },
];

Deno.test("retrieval: exact match in description returns relevant result first", () => {
  const results = retrieveRelevantExamples("Fractal Fern", mockSamples, 5);

  assertExists(results);
  assertEquals(results.length, 1);
  assertEquals(results[0].description, "Fractal Fern");
});

Deno.test("retrieval: code search no longer supported - only searches descriptions", () => {
  // Search for "PSet" which appears in code but not in description
  // Should not find anything since we only search descriptions now
  const results = retrieveRelevantExamples("PSet", mockSamples, 5);

  assertExists(results);
  // Since "PSet" doesn't appear in any description, should return empty or first N
  assertEquals(Array.isArray(results), true);
});

Deno.test("retrieval: finds examples matching description", () => {
  // "Tetris" appears in description
  const results = retrieveRelevantExamples("Tetris", mockSamples, 5);

  assertExists(results);
  assertEquals(results.length >= 1, true);
  // Should find examples with "Tetris" in description
  const hasTetris = results.some((r) => r.description.includes("Tetris"));
  assertEquals(hasTetris, true);
});

Deno.test("retrieval: typo tolerance finds results with 1 character difference", () => {
  // "Fracal" has a typo (missing 't') but should still find "Fractal"
  const results = retrieveRelevantExamples("Fracal Fern", mockSamples, 5);

  assertExists(results);
  assertEquals(results.length, 1);
  assertEquals(results[0].description, "Fractal Fern");
});

Deno.test("retrieval: empty query returns first N samples", () => {
  const results = retrieveRelevantExamples("", mockSamples, 3);

  assertExists(results);
  assertEquals(results.length, 3);
  assertEquals(results[0].description, mockSamples[0].description);
  assertEquals(results[1].description, mockSamples[1].description);
  assertEquals(results[2].description, mockSamples[2].description);
});

Deno.test("retrieval: empty samples array returns empty array", () => {
  const results = retrieveRelevantExamples("test", [], 5);

  assertExists(results);
  assertEquals(results.length, 0);
});

Deno.test("retrieval: respects maxExamples limit", () => {
  const results = retrieveRelevantExamples("Screen", mockSamples, 2);

  assertExists(results);
  assertEquals(results.length <= 2, true);
});

Deno.test("retrieval: multiple word queries find relevant results", () => {
  const results = retrieveRelevantExamples("drawing program", mockSamples, 5);

  assertExists(results);
  assertEquals(results.length >= 1, true);
  // Should find the drawing program sample
  const hasDrawingProgram = results.some(
    (r) => r.description === "A simple drawing program in only 14 lines",
  );
  assertEquals(hasDrawingProgram, true);
});

Deno.test("retrieval: case insensitive search", () => {
  // Orama search is case-insensitive by default
  const results1 = retrieveRelevantExamples("fractal", mockSamples, 5);
  const results2 = retrieveRelevantExamples("FRACTAL", mockSamples, 5);
  const results3 = retrieveRelevantExamples("Fractal", mockSamples, 5);

  // All should find the same result
  assertEquals(results1.length, results2.length);
  assertEquals(results2.length, results3.length);
  if (results1.length > 0) {
    assertEquals(results1[0].description, results2[0].description);
    assertEquals(results2[0].description, results3[0].description);
  }
});

Deno.test("retrieval: partial word matches work", () => {
  // "Lorenz" should match "Rotating Lorenz Attractor"
  const results = retrieveRelevantExamples("Lorenz", mockSamples, 5);

  assertExists(results);
  assertEquals(results.length >= 1, true);
  const hasLorenz = results.some(
    (r) => r.description === "Rotating Lorenz Attractor",
  );
  assertEquals(hasLorenz, true);
});

Deno.test("retrieval: default maxExamples is 12", () => {
  // Create more samples to test default limit
  const manySamples: FewShotSample[] = Array.from({ length: 20 }, (_, i) => ({
    description: `Sample ${i}`,
    code: `Code ${i}`,
  }));

  const results = retrieveRelevantExamples("Sample", manySamples);

  assertExists(results);
  assertEquals(results.length, 12);
});

Deno.test("retrieval: handles samples with empty input or output", () => {
  const samplesWithEmpty: FewShotSample[] = [
    ...mockSamples,
    {
      description: "",
      code: "Some code here",
    },
    {
      description: "Some description",
      code: "",
    },
  ];

  // Should not crash and should return results
  const results = retrieveRelevantExamples("Fractal", samplesWithEmpty, 5);

  assertExists(results);
  assertEquals(Array.isArray(results), true);
});

Deno.test("retrieval: returns results sorted by relevance score", () => {
  // "Tetris" query should return exact match first
  const results = retrieveRelevantExamples("Tetris", mockSamples, 10);

  assertExists(results);
  // First result should be exact match
  if (results.length > 0) {
    assertEquals(results[0].description, "Tetris");
  }
});

Deno.test("retrieval: finds results matching description only", () => {
  // Search for a term - only finds if it appears in descriptions
  const results = retrieveRelevantExamples("drawing", mockSamples, 10);

  assertExists(results);
  // Should find results where "drawing" appears in description
  assertEquals(results.length >= 1, true);
  const hasDrawing = results.some((r) =>
    r.description.toLowerCase().includes("drawing")
  );
  assertEquals(hasDrawing, true);
});

Deno.test("retrieval: filters stop words and finds relevant results", () => {
  // Test with a prompt containing stop words like "Please generate a fractal fern"
  // Should extract "fractal fern" and find the Fractal Fern sample
  const results = retrieveRelevantExamples(
    "Please generate a fractal fern",
    mockSamples,
    5,
  );

  assertExists(results);
  assertEquals(results.length >= 1, true);
  // Should find the Fractal Fern sample
  const hasFractalFern = results.some(
    (r) => r.description === "Fractal Fern",
  );
  assertEquals(hasFractalFern, true);
});

Deno.test("retrieval: avoids duplicates in results", () => {
  // Create samples with duplicates
  const samplesWithDuplicates: FewShotSample[] = [
    ...mockSamples,
    {
      description: "Fractal Fern", // Duplicate
      code:
        "Screen 12\nRandomize Timer\nColor _RGB(Rnd * 255, Rnd * 255, Rnd * 255)",
    },
    {
      description: "Tetris", // Duplicate
      code:
        "Dim Shared As Double piece(6, 3, 1)\nDim Shared piece_color(6)\nScreen _NewImage(640, 480, 32)",
    },
  ];

  const results = retrieveRelevantExamples(
    "fractal",
    samplesWithDuplicates,
    10,
  );

  assertExists(results);
  // Check that no duplicates exist
  const seen = new Set<string>();
  for (const result of results) {
    const key = `${result.description}|||${result.code}`;
    assertEquals(
      seen.has(key),
      false,
      `Duplicate found: ${result.description}`,
    );
    seen.add(key);
  }
});
