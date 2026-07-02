#!/usr/bin/env node
// ============================================================
// QUINIELA MUNDIAL 2026 — Script: download-backup.mjs
//
// Descarga el backup más reciente (o de una fecha específica)
// de Supabase Storage al directorio backups/ local.
//
// Uso:
//   node scripts/download-backup.mjs            # más reciente
//   node scripts/download-backup.mjs 2026-07-02  # fecha específica
//
//   O via npm:
//   npm run backup:download
//   npm run backup:download -- 2026-07-02
// ============================================================

import fs   from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient }  from '@supabase/supabase-js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT      = path.join(__dirname, '..');

// ── Leer .env.local ──────────────────────────────────────────────────────────
function loadEnv(filePath) {
  if (!fs.existsSync(filePath)) return {};
  const text = fs.readFileSync(filePath, 'utf-8');
  const env  = {};
  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const val = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, '');
    env[key]  = val;
  }
  return env;
}

const env = { ...loadEnv(path.join(ROOT, '.env.local')), ...process.env };

const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌  Faltan variables en .env.local:');
  if (!SUPABASE_URL) console.error('     NEXT_PUBLIC_SUPABASE_URL');
  if (!SUPABASE_KEY) console.error('     SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ── Argumento opcional: fecha YYYY-MM-DD ─────────────────────────────────────
const targetDate = process.argv[2];

async function main() {
  // Listar archivos del bucket (orden desc por nombre = más reciente primero)
  const { data: files, error: listError } = await supabase.storage
    .from('backups')
    .list('', { sortBy: { column: 'name', order: 'desc' } });

  if (listError) {
    console.error('❌  Error listando backups:', listError.message);
    process.exit(1);
  }

  if (!files || files.length === 0) {
    console.log('⚠️   No hay backups en el bucket todavía.');
    process.exit(0);
  }

  // Seleccionar archivo
  let fileName;
  if (targetDate) {
    fileName = `backup-${targetDate}.json`;
    if (!files.find(f => f.name === fileName)) {
      console.error(`❌  No existe backup para la fecha: ${targetDate}`);
      console.log('    Disponibles:', files.map(f => f.name).join(', '));
      process.exit(1);
    }
  } else {
    fileName = files[0].name; // más reciente
  }

  console.log(`⬇️   Descargando ${fileName}...`);

  // Descargar
  const { data: blob, error: downloadError } = await supabase.storage
    .from('backups')
    .download(fileName);

  if (downloadError) {
    console.error('❌  Error descargando:', downloadError.message);
    process.exit(1);
  }

  // Guardar en backups/ local
  const outDir  = path.join(ROOT, 'backups');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  const outPath = path.join(outDir, fileName);
  const buffer  = Buffer.from(await blob.arrayBuffer());
  fs.writeFileSync(outPath, buffer);

  const sizeKb = (buffer.length / 1024).toFixed(1);
  console.log(`✅  Guardado en backups/${fileName} (${sizeKb} KB)`);

  // Mostrar resumen del backup
  try {
    const parsed = JSON.parse(buffer.toString());
    if (parsed.summary) {
      console.log('\n📊  Resumen:');
      for (const [table, count] of Object.entries(parsed.summary)) {
        console.log(`    ${table.padEnd(14)} ${count} registros`);
      }
      console.log(`\n    Generado: ${parsed.timestamp}`);
    }
  } catch {
    // Si no se puede parsear, no pasa nada
  }
}

main().catch(err => {
  console.error('❌  Error inesperado:', err.message ?? err);
  process.exit(1);
});
