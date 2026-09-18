export type ChargerCategory = "TPC_LIGHTNING_20W" | "TPC_LIGHTNING_33W" | "TPC_TPC_33W";

export function classifyCharger(description: string): ChargerCategory {
  const upper = description.toUpperCase();
  const match = upper.match(/IPHONE\s+(\d+)/);
  if (!match) return "TPC_LIGHTNING_20W";

  const model = Number.parseInt(match[1], 10);
  const pro = upper.includes("PRO");

  if (model >= 15) return "TPC_TPC_33W";
  if (model === 14 || (model === 13 && pro)) return "TPC_LIGHTNING_33W";
  return "TPC_LIGHTNING_20W";
}
