import { authenticateChatGptRequest, chatGptJson } from "@/lib/integrations/chatgpt";

export async function POST(request: Request) {
  const auth = await authenticateChatGptRequest(request);
  if (auth.response) return auth.response;
  return chatGptJson(
    { error: "Esta vía quedó en solo lectura. Usa /api/mcp: preparar_cambios y confirmar_cambios. Aprobar una solicitud mueve stock y no está en la v1." },
    { status: 403 },
  );
}
