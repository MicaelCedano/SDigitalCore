import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { authenticateChatGptRequest, chatGptJson } from "@/lib/integrations/chatgpt";

const querySchema = z.object({
  status: z.enum(["PENDING", "APPROVED", "REJECTED", "ALL"]).default("PENDING"),
  limit: z.coerce.number().int().min(1).max(25).default(15),
});

export async function GET(request: Request) {
  const auth = await authenticateChatGptRequest(request);
  if (auth.response) return auth.response;

  const params = new URL(request.url).searchParams;
  const parsed = querySchema.safeParse({ status: params.get("status") ?? undefined, limit: params.get("limit") ?? undefined });
  if (!parsed.success) return chatGptJson({ error: parsed.error.issues[0]?.message }, { status: 400 });

  try {
    const requests = await prisma.warehouseRequest.findMany({
      where: parsed.data.status === "ALL" ? {} : { status: parsed.data.status },
      orderBy: { createdAt: "desc" },
      take: parsed.data.limit,
      select: {
        id: true,
        requestCode: true,
        title: true,
        branch: true,
        requestedBy: true,
        type: true,
        status: true,
        details: true,
        createdAt: true,
        items: {
          select: {
            unitsCount: true,
            product: { select: { code: true, name: true, brand: true, color: true, capacity: true, unitsPerBox: true } },
          },
        },
      },
    });

    return chatGptJson({
      count: requests.length,
      statusFilter: parsed.data.status,
      requests: requests.map((item) => ({
        ...item,
        details: item.details?.slice(0, 500) ?? null,
        createdAt: item.createdAt.toISOString(),
      })),
    });
  } catch (error) {
    console.error("ChatGPT warehouse request lookup failed", error);
    return chatGptJson({ error: "No se pudieron consultar las solicitudes de Almacén." }, { status: 500 });
  }
}
