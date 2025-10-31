/// <reference lib="deno.ns" />

import { parse } from "@std/csv/parse";
import { ProgressBar } from "@std/cli/unstable-progress-bar";
import type { FewShotSample } from "./src/program.ts";

if (import.meta.main) {
  await downloadSamples();
}

async function downloadSamples(
  maxSampleCount = Infinity,
  maxOutputLength = Infinity,
) {
  const fewShot: FewShotSample[] = [];

  const samplesResponse = await fetch(
    "https://raw.githubusercontent.com/boxgaming/qbjs-samples/refs/heads/main/samples.txt",
  );
  const samplesText = await samplesResponse.text();

  const samples = parse(samplesText, {
    columns: ["filename", "label", "author", "description", "tags"],
    trimLeadingSpace: true,
  });

  const bar = new ProgressBar({ max: maxSampleCount });

  for (const sample of samples) {
    if (!sample.filename.endsWith(".bas")) {
      continue;
    }

    const response = await fetch(
      `https://raw.githubusercontent.com/boxgaming/qbjs-samples/refs/heads/main/samples/${sample.filename}`,
    );
    const output = await response.text();
    if (output.length > (Math.min(maxOutputLength, samples.length))) {
      continue;
    }

    if (output.toLowerCase().includes("import")) {
      continue;
    }

    const input = sample.description || sample.label;
    const fewShotSample: FewShotSample = { input, output };
    fewShot.push(fewShotSample);

    bar.value++;

    if (fewShot.length >= maxSampleCount) {
      break;
    }
  }

  await bar.stop();

  await Deno.writeTextFile(
    "./src/samples.json",
    JSON.stringify(fewShot, null, 2) + "\n",
  );
}
