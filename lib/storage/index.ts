import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/**
 * Cliente público de Supabase (solo para Storage público).
 * No usar para queries de negocio — usar Prisma para eso.
 */
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

/**
 * Crea un cliente de Supabase con service role key.
 * SOLO USAR EN SERVIDOR — nunca en el cliente.
 */
export function createServiceClient() {
  if (typeof window !== "undefined") {
    throw new Error(
      "createServiceClient no puede usarse en el cliente. Solo servidor."
    );
  }
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(supabaseUrl, serviceKey);
}

/**
 * Sube un archivo a Supabase Storage.
 */
export async function uploadFile(
  bucket: string,
  path: string,
  file: File | Buffer,
  contentType?: string
) {
  const client = createServiceClient();
  const { data, error } = await client.storage.from(bucket).upload(path, file, {
    contentType,
    upsert: false,
  });

  if (error) throw new Error(`Error subiendo archivo: ${error.message}`);
  return data;
}

/**
 * Obtiene la URL pública de un archivo en Storage.
 */
export function getPublicUrl(bucket: string, path: string) {
  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return data.publicUrl;
}
