import { authorizeQc, qcJson, readQcBody } from "@/lib/mobile/qc-http";
import { mobilePhotoSchema } from "@/modules/qc/lib/photo-input";
import { uploadDevicePhotosAction } from "@/modules/qc/actions/device-photos";
export async function POST(request: Request) {
  try {
    const auth = await authorizeQc(request, true);
    if (auth.response) return auth.response;
    const parsed = mobilePhotoSchema.safeParse(
      await readQcBody(request, 1450000)
    );
    if (!parsed.success)
      return qcJson({ error: "Foto inválida o demasiado grande." }, 400);
    const { deviceId, commandId, base64 } = parsed.data;
    const bytes = Buffer.from(base64, "base64");
    if (bytes.toString("base64") !== base64)
      return qcJson({ error: "La foto está incompleta." }, 400);
    const form = new FormData();
    form.set("deviceId", deviceId);
    form.set("mobileCommandId", commandId);
    form.append(
      "files",
      new File([new Uint8Array(bytes)], "evidencia.jpg", { type: "image/jpeg" })
    );
    const result = await uploadDevicePhotosAction(form);
    return result.success
      ? qcJson({ success: true, uploaded: result.uploaded })
      : qcJson(
          {
            error:
              "errorCode" in result && result.errorCode === "QC_FORBIDDEN"
                ? "Ya no tienes acceso para adjuntar fotos a este equipo."
                : "La foto no se confirmó. Reintenta la foto pendiente.",
          },
          "errorCode" in result && result.errorCode === "QC_FORBIDDEN"
            ? 403
            : 503
        );
  } catch {
    return qcJson(
      {
        error:
          "No se pudo procesar la foto. Selecciona una imagen JPEG, PNG o WebP.",
      },
      400
    );
  }
}
