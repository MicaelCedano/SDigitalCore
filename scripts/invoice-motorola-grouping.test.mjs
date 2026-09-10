import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";

const source = fs.readFileSync(new URL("../modules/facturas/actions/pdf-text-parser.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
}).outputText;
const mod = { exports: {} };
new Function("module", "exports", compiled)(mod, mod.exports);

const { parseInvoiceText } = mod.exports;
const result = parseInvoiceText(`
30 CELULAR MOTOROLA G PLAY 2024 4+64GB
10 CELULAR MOTOROLA G17 4+128GB PBBJ0069GT AZUL
10 CELULAR MOTOROLA G17 4+128GB PBBJ0070GT VERDE
10 CELULAR MOTOROLA G17 4+128GB PBBJ0068GT NEGRO
10 CELULAR MOTOROLA G17 4+256GB PBBN0005GT AZUL
10 CELULAR MOTOROLA G17 4+256GB PBBN0007GT VERDE
30 CELULAR MOTOROLA G35 4+256GB
4 CELULAR MOTOROLA G47 4+128GB PBCG0065GT NEGRO
`);

assert.deepEqual(result.items, [
  { quantity: 30, description: "CELULAR MOTOROLA G PLAY 2024 4+64GB", imeis: "" },
  { quantity: 30, description: "CELULAR MOTOROLA G17 4+128GB", imeis: "" },
  { quantity: 20, description: "CELULAR MOTOROLA G17 4+256GB", imeis: "" },
  { quantity: 30, description: "CELULAR MOTOROLA G35 4+256GB", imeis: "" },
  { quantity: 4, description: "CELULAR MOTOROLA G47 4+128GB", imeis: "" },
]);

console.log("Invoice Motorola variants are grouped through GB capacity");
