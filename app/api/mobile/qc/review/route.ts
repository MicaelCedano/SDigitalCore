import { authorizeQc, qcJson, readQcBody } from "@/lib/mobile/qc-http";
import { reviewDeviceSchema } from "@/lib/validation/revision-batch";
import { reviewDeviceAction } from "@/modules/qc/actions/revision-batch";
const schema = reviewDeviceSchema.refine((data) => !!data.mobile, {
  message: "Falta el identificador del envío.",
});
export async function POST(request: Request) {
  try {
    const auth = await authorizeQc(request, true);
    if (auth.response) return auth.response;
    const parsed = schema.safeParse(await readQcBody(request, 8192));
    if (!parsed.success)
      return qcJson(
        { error: parsed.error.issues[0]?.message || "Revisión inválida." },
        400
      );
    const result = await reviewDeviceAction(parsed.data);
    if (!result.success) {
      const code = "errorCode" in result ? result.errorCode : "";
      return qcJson(
        {
          error:
            code === "QC_UNAVAILABLE" || !code
              ? "No se pudo confirmar la revisión. Reintenta el mismo envío."
              : result.error,
        },
        code === "QC_CONFLICT"
          ? 409
          : code === "QC_FORBIDDEN"
          ? 403
          : code === "QC_INVALID"
          ? 400
          : 503
      );
    }
    return qcJson({
      success: true,
      replayed: "replayed" in result && result.replayed === true,
      message: result.message,
    });
  } catch {
    return qcJson(
      {
        error:
          "No se pudo procesar la revisión. Revisa la conexión y reintenta.",
      },
      400
    );
  }
}
