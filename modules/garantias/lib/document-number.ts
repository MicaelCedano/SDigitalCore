import type { Prisma } from "@prisma/client";

export function civilDate(value: string | Date) {
  if (value instanceof Date) return value;
  return new Date(`${value}T00:00:00.000Z`);
}

export function santoDomingoDateString(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Santo_Domingo", year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

export async function nextWarrantyNumber(tx: Prisma.TransactionClient, date: Date, type: string, prefix: string) {
  const sequenceDate = civilDate(santoDomingoDateString(date));
  const sequence = await tx.warrantyDailySequence.upsert({
    where: { sequenceDate_sequenceType: { sequenceDate, sequenceType: type } },
    create: { sequenceDate, sequenceType: type, lastValue: 1 },
    update: { lastValue: { increment: 1 } },
  });
  const parts = santoDomingoDateString(date).split("-");
  return `${prefix}-${parts[1]}${parts[2]}-${String(sequence.lastValue).padStart(3, "0")}`;
}
