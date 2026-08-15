import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const scriptsDir = path.dirname(fileURLToPath(import.meta.url));
const entries = await fs.readdir(scriptsDir);
const testFiles = entries.filter((entry) => entry.endsWith(".test.mjs")).sort();

for (const testFile of testFiles) {
  await import(pathToFileURL(path.join(scriptsDir, testFile)).href);
}
