// GET /api/admin/respaldo/download?file=backup-YYYY-MM-DD.json
// Genera una URL firmada (60 s) del bucket privado 'backups' y redirige.
// Solo administradores.

import { NextRequest, NextResponse } from "next/server";
import { createClient, tryAdminClient } from "@/lib/supabase/server";

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new NextResponse("No autenticado", { status: 401 });

  const { data: me } = await supabase
    .from("participants")
    .select("is_admin")
    .eq("auth_user_id", user.id)
    .single();

  if (!me?.is_admin) return new NextResponse("No autorizado", { status: 403 });

  const fileName = req.nextUrl.searchParams.get("file");
  if (!fileName) return new NextResponse("Falta el parámetro file", { status: 400 });

  // Validar que el nombre tenga el formato esperado (evitar path traversal)
  if (!/^backup-\d{4}-\d{2}-\d{2}\.json$/.test(fileName)) {
    return new NextResponse("Nombre de archivo inválido", { status: 400 });
  }

  const adminClient = tryAdminClient();
  if (!adminClient) return new NextResponse("Storage no disponible (falta SUPABASE_SERVICE_ROLE_KEY)", { status: 500 });

  const { data, error } = await adminClient.storage
    .from("backups")
    .createSignedUrl(fileName, 60); // URL válida por 60 segundos

  if (error || !data?.signedUrl) {
    return new NextResponse(error?.message ?? "No se pudo generar la URL", { status: 500 });
  }

  // El navegador sigue el redirect y descarga el archivo directamente de Storage
  return NextResponse.redirect(data.signedUrl);
}
