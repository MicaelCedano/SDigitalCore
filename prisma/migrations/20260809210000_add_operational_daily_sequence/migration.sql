-- Secuencia atómica para folios operativos diarios en hora de Santo Domingo.
CREATE TABLE "operational_daily_sequence" (
  "id" TEXT NOT NULL,
  "sequence_date" DATE NOT NULL,
  "sequence_type" TEXT NOT NULL,
  "last_value" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "operational_daily_sequence_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "operational_daily_sequence_sequence_date_sequence_type_key"
ON "operational_daily_sequence"("sequence_date", "sequence_type");
