-- Marca el origen de las penalidades: las migradas desde SDigitalSystem
-- son históricas (su descuento ya está incluido en el saldo del wallet
-- migrado) y NO se pueden revertir desde Core.
ALTER TABLE "penalty" ADD COLUMN IF NOT EXISTS "source_system" VARCHAR(50);
