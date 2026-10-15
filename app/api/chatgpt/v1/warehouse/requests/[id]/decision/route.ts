import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { authenticateChatGptRequest, chatGptJson } from "@/lib/integrations/chatgpt";
import { updateWarehouseRequestStatus } from "@/modules/almacen/lib/warehouse-request-status";

const bodySchema = z.object({
  decision: z.enum(["APPROVED", "REJECTED"]),
  confirmedRequestCode: z.string().trim().min(1).max(40),
}).strict();

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await authenticateChatGptRequest(request);
  if (auth.response) return auth.response;

  const { id } = await context.params;
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return chatGptJson({ error: "Incluye una decisión válida y el código exacto de la solicitud confirmada." }, { status: 400 });

  try {
    const current = await prisma.warehouseRequest.findUnique({
      where: { id },
      select: { id: true, requestCode: true, status: true },
    });
    if (!current || current.requestCode !== parsed.data.confirmedRequestCode) {
      return chatGptJson({ error: "La solicitud no coincide con el código confirmado." }, { status: 404 });
    }
    if (current.status !== "PENDING") {
      return chatGptJson({ error: `La solicitud ya está ${current.status.toLowerCase()} y no se puede procesar otra vez.` }, { status: 409 });
    }

    const updated = await updateWarehouseRequestStatus({
      id,
      status: parsed.data.decision,
      actorId: auth.principal.id,
      source: "chatgpt",
    });
    return chatGptJson({
      success: true,
      requestCode: updated.requestCode,
      status: updated.status,
      message: `Solicitud ${updated.status === "APPROVED" ? "aprobada" : "rechazada"}.`,
    });
  } catch (error) {
    if (error instanceof z.ZodError) return chatGptJson({ error: "La decisión no es válida." }, { status: 400 });
    const message = error instanceof Error ? error.message : "No se pudo procesar la solicitud.";
    const status = /ya fue procesada|no existe/i.test(message) ? 409 : /stock insuficiente|producto/i.test(message) ? 422 : 500;
    if (status === 500) console.error("ChatGPT warehouse decision failed", error);
    return chatGptJson({ error: status === 500 ? "No se pudo procesar la solicitud." : message }, { status });
  }
}
