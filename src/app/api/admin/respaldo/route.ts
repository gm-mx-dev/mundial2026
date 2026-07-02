// POST /api/admin/respaldo
// Llama a la Edge Function backup-data para generar un respaldo inmediato.
// Solo administradores.

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(_req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const { data: me } = await supabase
    .from("participants")
    .select("is_admin")
    .eq("auth_user_id", user.id)
    .single();

  if (!me?.is_admin) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const supabaseUrl  = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey   = process.env.SUPABASE_SERVICE_ROLE_KEY!;

  // Llamar la Edge Function via GET (no requiere x-cron-secret en GET)
  // El service role key satisface verify_jwt
  let resp: Response;
  try {
    resp = await fetch(`${supabaseUrl}/functions/v1/backup-data`, {
      method: "GET",
      headers: { Authorization: `Bearer ${serviceKey}` },
    });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 502 });
  }

  if (!resp.ok) {
    const text = await resp.text().catch(() => "Error desconocido");
    return NextResponse.json({ ok: false, error: text }, { status: resp.status });
  }

  const data = await resp.json().catch(() => ({ ok: false, error: "Respuesta inesperada" }));
  return NextResponse.json(data);
}
