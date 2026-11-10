import { createJiti } from "jiti";
import { resolve } from "node:path";

const script = process.argv[2];
if (!script) {
  console.error("Uso: node scripts/run-ts-test.mjs <archivo.ts>");
  process.exit(1);
}

const root = process.cwd();
const jiti = createJiti(import.meta.url, {
  alias: { "@": root },
  tryNative: false,
});

await jiti.import(resolve(root, script));
