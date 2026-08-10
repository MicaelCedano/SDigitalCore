import type { Prisma } from "@prisma/client";

const BUSINESS_TIME_ZONE = "America/Santo_Domingo";

function businessDateString(date: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: BUSINESS_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export async function nextOperationalNumber(
  tx: Prisma.TransactionClient,
  type: string,
  prefix: string,
  date = new Date(),
) {
  const dateString = businessDateString(date);
  const sequenceDate = new Date(`${dateString}T00:00:00.000Z`);
  const sequence = await tx.operationalDailySequence.upsert({
    where: { sequenceDate_sequenceType: { sequenceDate, sequenceType: type } },
    create: { sequenceDate, sequenceType: type, lastValue: 1 },
    update: { lastValue: { increment: 1 } },
  });

  return `${prefix}-${dateString.replaceAll("-", "")}-${String(sequence.lastValue).padStart(3, "0")}`;
}
