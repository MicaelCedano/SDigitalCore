import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { authenticateChatGptRequest, chatGptJson } from "@/lib/integrations/chatgpt";

const querySchema = z.object({
  query: z.string().trim().max(80).optional(),
  limit: z.coerce.number().int().min(1).max(25).default(15),
});

export async function GET(request: Request) {
  const auth = await authenticateChatGptRequest(request);
  if (auth.response) return auth.response;

  const params = new URL(request.url).searchParams;
  const parsed = querySchema.safeParse({ query: params.get("query") ?? undefined, limit: params.get("limit") ?? undefined });
  if (!parsed.success) return chatGptJson({ error: parsed.error.issues[0]?.message }, { status: 400 });
  const query = parsed.data.query;

  try {
    const batches = await prisma.qcRevisionBatch.findMany({
      where: query
        ? { OR: [
            { batchNumber: { contains: query, mode: "insensitive" } },
            { supplierName: { contains: query, mode: "insensitive" } },
          ] }
        : {},
      orderBy: { receivedAt: "desc" },
      take: parsed.data.limit,
      select: {
        id: true,
        batchNumber: true,
        supplierName: true,
        branch: true,
        status: true,
        totalDevices: true,
        reviewedDevices: true,
        functionalCount: true,
        nonFunctionalCount: true,
        receivedAt: true,
        completedAt: true,
      },
    });

    return chatGptJson({
      metric: "porcentaje de equipos revisados en QC",
      count: batches.length,
      batches: batches.map((batch) => ({
        ...batch,
        progressPercent: batch.totalDevices > 0 ? Math.round((batch.reviewedDevices / batch.totalDevices) * 100) : 0,
        remainingDevices: Math.max(0, batch.totalDevices - batch.reviewedDevices),
        receivedAt: batch.receivedAt.toISOString(),
        completedAt: batch.completedAt?.toISOString() ?? null,
      })),
    });
  } catch (error) {
    console.error("ChatGPT purchase progress lookup failed", error);
    return chatGptJson({ error: "No se pudo consultar el avance de compra/QC." }, { status: 500 });
  }
}
