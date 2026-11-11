import { authenticateChatGptRequest, chatGptJson } from "@/lib/integrations/chatgpt";

export async function POST(request: Request) {
  const auth = await authenticateChatGptRequest(request);
  if (auth.response) return auth.response;
  return chatGptJson(
    { error: "Esta vía quedó en solo lectura. Usa /api/mcp: preparar_cambios con entidad solicitud_almacen y luego confirmar_cambios." },
    { status: 403 },
  );
}
