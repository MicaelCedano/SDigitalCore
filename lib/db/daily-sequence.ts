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

/**
 * Genera el folio consecutivo global de los lotes QC.
 *
 * Se mantiene separado de las secuencias diarias para que el folio sea fácil
 * de identificar en operación: LOT-115, LOT-116, LOT-117...
 */
export async function nextQcBatchNumber(tx: Prisma.TransactionClient) {
  const sequenceDate = new Date("1970-01-01T00:00:00.000Z");
  const sequence = await tx.operationalDailySequence.upsert({
    where: { sequenceDate_sequenceType: { sequenceDate, sequenceType: "QC_BATCH_GLOBAL" } },
    create: { sequenceDate, sequenceType: "QC_BATCH_GLOBAL", lastValue: 115 },
    update: { lastValue: { increment: 1 } },
  });

  return `LOT-${sequence.lastValue}`;
}
