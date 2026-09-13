import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";

const eligibilitySource = fs.readFileSync(new URL("../lib/wallet/eligibility.ts", import.meta.url), "utf8");
const eligibilityExports = {};
vm.runInNewContext(
  ts.transpileModule(eligibilitySource, {
    compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS },
  }).outputText,
  { exports: eligibilityExports },
);

const filter = eligibilityExports.WALLET_ELIGIBLE_USER_FILTER;
assert.equal(filter.roleCode.not, "ADMIN", "Nunca se debe acreditar manualmente a un ADMIN");
assert.equal(filter.OR[0].roleCode.in.join(","), "QC,TECNICO");
assert.equal(filter.OR[1].allowedModules.has, "wallet", "Los usuarios migrados con acceso a Wallet deben ser pagables");

const actionSource = fs.readFileSync(new URL("../modules/wallet/actions/manual-credit.ts", import.meta.url), "utf8");
const dataSource = fs.readFileSync(new URL("../modules/wallet/data.ts", import.meta.url), "utf8");
assert.match(actionSource, /\.\.\.WALLET_ELIGIBLE_USER_FILTER/);
assert.match(dataSource, /\.\.\.WALLET_ELIGIBLE_USER_FILTER/);
assert.match(actionSource, /status:\s*\{\s*in:\s*\["ACTIVE",\s*"INACTIVE"\]\s*\}/);

console.log("Wallet manual credit: list and server action share the same non-admin eligibility rule.");
