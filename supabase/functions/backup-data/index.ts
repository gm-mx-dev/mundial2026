// ============================================================
// QUINIELA MUNDIAL 2026 — Edge Function: backup-data
// Versión: v1 | Fecha: 2026-07-02
//
// Genera un respaldo JSON de todas las tablas y lo guarda
// en Supabase Storage (bucket 'backups', privado).
//
// CRON: diario a las 06:00 UTC (medianoche hora México)
// ARCHIVO: backup-YYYY-MM-DD.json
//
// Para descargar a local: node scripts/download-backup.mjs
// ============================================================

import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';

const SUPABASE_URL        = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

Deno.serve(async (req: Request) => {
  // Autenticación: solo el cron (x-cron-secret) o GET directo puede llamar esto
  const authHeader = req.headers.get('x-cron-secret');
  const cronSecret = Deno.env.get('CRON_SECRET') ?? 'quiniela2026';
  if (req.method !== 'GET' && authHeader !== cronSecret) {
    return new Response('No autorizado', { status: 401 });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  try {
    const now       = new Date();
    const dateStr   = now.toISOString().slice(0, 10); // YYYY-MM-DD
    const fileName  = `backup-${dateStr}.json`;

    // ── Leer todas las tablas en paralelo ────────────────────────────────────
    const [participantsRes, phasesRes, matchesRes, predictionsRes, auditRes] =
      await Promise.all([
        supabase.from('participants').select('*').order('name'),
        supabase.from('phases').select('*').order('sort_order'),
        supabase.from('matches').select('*').order('kickoff_at'),
        supabase.from('predictions').select('*').order('created_at'),
        supabase.from('audit_log').select('*').order('created_at', { ascending: false }),
      ]);

    // Verificar errores de lectura
    const readErrors = [participantsRes, phasesRes, matchesRes, predictionsRes, auditRes]
      .filter(r => r.error)
      .map(r => r.error!.message);

    if (readErrors.length > 0) {
      throw new Error(`Errores leyendo tablas: ${readErrors.join(', ')}`);
    }

    // ── Armar el JSON de respaldo ─────────────────────────────────────────────
    const backup = {
      timestamp : now.toISOString(),
      date      : dateStr,
      version   : '1',
      app       : 'Quiniela Mundial 2026',
      tables: {
        participants : participantsRes.data ?? [],
        phases       : phasesRes.data       ?? [],
        matches      : matchesRes.data      ?? [],
        predictions  : predictionsRes.data  ?? [],
        audit_log    : auditRes.data        ?? [],
      },
      summary: {
        participants : participantsRes.data?.length ?? 0,
        phases       : phasesRes.data?.length       ?? 0,
        matches      : matchesRes.data?.length      ?? 0,
        predictions  : predictionsRes.data?.length  ?? 0,
        audit_log    : auditRes.data?.length        ?? 0,
      },
    };

    const jsonContent = JSON.stringify(backup, null, 2);

    // ── Subir al bucket 'backups' (upsert = sobreescribe si ya existe ese día) ─
    const { error: uploadError } = await supabase.storage
      .from('backups')
      .upload(fileName, new TextEncoder().encode(jsonContent), {
        contentType : 'application/json',
        upsert      : true,
      });

    if (uploadError) {
      throw new Error(`Error al guardar backup en Storage: ${uploadError.message}`);
    }

    console.log(`Backup guardado: ${fileName} (${(jsonContent.length / 1024).toFixed(1)} KB)`);

    return new Response(
      JSON.stringify({
        ok      : true,
        file    : fileName,
        size_kb : parseFloat((jsonContent.length / 1024).toFixed(1)),
        summary : backup.summary,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );

  } catch (err) {
    console.error('Error en backup-data:', err);
    return new Response(
      JSON.stringify({ ok: false, error: String(err) }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
});
