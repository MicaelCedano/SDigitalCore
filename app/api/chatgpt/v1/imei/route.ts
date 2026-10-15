import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { authenticateChatGptRequest, chatGptJson } from "@/lib/integrations/chatgpt";

const querySchema = z.string().trim().regex(/^\d{15}$/, "Indica un IMEI completo de 15 dígitos.");

export async function GET(request: Request) {
  const auth = await authenticateChatGptRequest(request);
  if (auth.response) return auth.response;

  const parsed = querySchema.safeParse(new URL(request.url).searchParams.get("imei") ?? "");
  if (!parsed.success) return chatGptJson({ error: parsed.error.issues[0]?.message }, { status: 400 });

  try {
    const device = await prisma.deviceUnit.findUnique({
      where: { imei: parsed.data },
      select: {
        imei: true,
        brand: true,
        model: true,
        status: true,
        updatedAt: true,
        batch: { select: { batchNumber: true, supplierName: true, branch: true, receivedAt: true } },
        inspections: {
          where: { status: "COMPLETED", corrections: { none: {} } },
          orderBy: [{ reviewedAt: "desc" }, { createdAt: "desc" }],
          take: 20,
          select: {
            reviewerNameSnapshot: true,
            reviewedAt: true,
            result: true,
            grade: true,
            functionalityNotes: true,
            physicalNotes: true,
            createdAt: true,
          },
        },
      },
    });

    if (!device) return chatGptJson({ found: false, imei: parsed.data, message: "No encontré ese IMEI en los registros de QC." });
    const latest = device.inspections[0] ?? null;
    return chatGptJson({
      found: true,
      imei: device.imei,
      device: { brand: device.brand, model: device.model, status: device.status },
      batch: device.batch
        ? {
            number: device.batch.batchNumber,
            supplier: device.batch.supplierName,
            branch: device.batch.branch,
            receivedAt: device.batch.receivedAt.toISOString(),
          }
        : null,
      latestReviewer: latest?.reviewerNameSnapshot ?? null,
      latestInspection: latest
        ? {
            reviewer: latest.reviewerNameSnapshot,
            result: latest.result,
            grade: latest.grade,
            reviewedAt: (latest.reviewedAt ?? latest.createdAt).toISOString(),
            functionalityNotes: latest.functionalityNotes,
            physicalNotes: latest.physicalNotes,
          }
        : null,
      inspectionHistory: device.inspections.map((inspection) => ({
        reviewer: inspection.reviewerNameSnapshot,
        result: inspection.result,
        grade: inspection.grade,
        reviewedAt: (inspection.reviewedAt ?? inspection.createdAt).toISOString(),
      })),
      deviceUpdatedAt: device.updatedAt.toISOString(),
    });
  } catch (error) {
    console.error("ChatGPT IMEI lookup failed", error);
    return chatGptJson({ error: "No se pudo consultar el IMEI." }, { status: 500 });
  }
}
