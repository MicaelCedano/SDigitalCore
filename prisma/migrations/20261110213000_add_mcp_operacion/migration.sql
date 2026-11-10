-- MCP: bitácora de preparar / confirmar / revertir.
-- OAuth sigue siendo stateless (JWT). No aplicar esta migración desde el agente.

CREATE TYPE "mcp_operacion_estado" AS ENUM ('PENDIENTE', 'APLICADA', 'EXPIRADA', 'REVERTIDA');

CREATE TABLE "mcp_operacion" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "entidad" VARCHAR(40) NOT NULL,
  "entity_id" TEXT NOT NULL,
  "version_hash_antes" VARCHAR(64) NOT NULL,
  "version_hash_despues" VARCHAR(64),
  "propuesta" JSONB NOT NULL,
  "diff" JSONB NOT NULL,
  "snapshot_antes" JSONB NOT NULL,
  "snapshot_despues" JSONB,
  "estado" "mcp_operacion_estado" NOT NULL DEFAULT 'PENDIENTE',
  "justificacion" TEXT,
  "actor_user_id" TEXT,
  "reversa_de_id" UUID,
  "expires_at" TIMESTAMP(3) NOT NULL,
  "applied_at" TIMESTAMP(3),
  "reverted_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "mcp_operacion_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "mcp_operacion_reversa_de_id_key" ON "mcp_operacion"("reversa_de_id");
CREATE INDEX "mcp_operacion_entidad_entity_id_created_at_idx" ON "mcp_operacion"("entidad", "entity_id", "created_at");
CREATE INDEX "mcp_operacion_estado_expires_at_idx" ON "mcp_operacion"("estado", "expires_at");

ALTER TABLE "mcp_operacion"
  ADD CONSTRAINT "mcp_operacion_actor_user_id_fkey"
  FOREIGN KEY ("actor_user_id") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "mcp_operacion"
  ADD CONSTRAINT "mcp_operacion_reversa_de_id_fkey"
  FOREIGN KEY ("reversa_de_id") REFERENCES "mcp_operacion"("id") ON DELETE SET NULL ON UPDATE CASCADE;
