"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Download, RefreshCw, DatabaseBackup } from "lucide-react";

interface BackupFile {
  name: string;
  metadata?: { size?: number };
  created_at?: string;
  updated_at?: string;
}

interface Props {
  backups: BackupFile[];
}

function formatDateName(name: string) {
  const match = name.match(/backup-(\d{4}-\d{2}-\d{2})\.json/);
  if (!match) return name;
  const d = new Date(match[1] + "T12:00:00Z");
  return d.toLocaleDateString("es-MX", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function formatSize(metadata?: { size?: number }) {
  const bytes = metadata?.size;
  if (!bytes) return null;
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export default function RespaldoManager({ backups }: Props) {
  const router = useRouter();
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState<{
    ok?: boolean;
    file?: string;
    size_kb?: number;
    summary?: Record<string, number>;
    error?: string;
  } | null>(null);

  const generateBackup = async () => {
    setGenerating(true);
    setResult(null);
    try {
      const resp = await fetch("/api/admin/respaldo", { method: "POST" });
      const data = await resp.json();
      setResult(data);
      if (data.ok) router.refresh(); // Recarga la lista
    } catch (err) {
      setResult({ ok: false, error: String(err) });
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="px-4 py-4 space-y-5">

      {/* ── Generar respaldo ── */}
      <div className="space-y-3">
        <button
          onClick={generateBackup}
          disabled={generating}
          className="flex items-center gap-2 px-4 py-2.5 bg-indigo-700 hover:bg-indigo-600
                     disabled:bg-indigo-900 disabled:text-indigo-500
                     text-white text-sm font-medium rounded-lg transition-colors"
        >
          <RefreshCw size={15} className={generating ? "animate-spin" : ""} />
          {generating ? "Generando respaldo…" : "Generar respaldo ahora"}
        </button>

        {result && (
          <div className={`text-sm px-3 py-2.5 rounded-lg border ${
            result.ok
              ? "bg-green-950/40 border-green-800/50 text-green-400"
              : "bg-red-950/40 border-red-800/50 text-red-400"
          }`}>
            {result.ok ? (
              <div>
                <span className="font-semibold">✅ Respaldo creado: </span>
                {result.file} ({result.size_kb} KB)
                {result.summary && (
                  <span className="block mt-1 text-xs text-green-600">
                    {Object.entries(result.summary)
                      .map(([k, v]) => `${k}: ${v}`)
                      .join(" · ")}
                  </span>
                )}
              </div>
            ) : (
              <span>❌ {result.error}</span>
            )}
          </div>
        )}
      </div>

      {/* ── Lista de respaldos ── */}
      <div>
        <div className="text-xs text-gray-500 uppercase tracking-wide mb-2">
          Respaldos disponibles en Storage ({backups.length})
        </div>

        {backups.length === 0 ? (
          <div className="py-8 text-center">
            <DatabaseBackup size={32} className="mx-auto text-gray-700 mb-2" />
            <p className="text-sm text-gray-600">
              No hay respaldos todavía. Genera el primero con el botón de arriba.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {backups.map((file, i) => {
              const size = formatSize(file.metadata);
              const isLatest = i === 0;
              return (
                <div
                  key={file.name}
                  className="flex items-center justify-between gap-4
                             bg-gray-950 border border-gray-800 rounded-lg px-4 py-3"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-white capitalize">
                        {formatDateName(file.name)}
                      </span>
                      {isLatest && (
                        <span className="text-[10px] bg-indigo-900/60 border border-indigo-700/50 text-indigo-400 px-1.5 py-0.5 rounded-full font-medium">
                          más reciente
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-gray-600 mt-0.5">
                      {file.name}{size ? ` · ${size}` : ""}
                    </div>
                  </div>

                  <a
                    href={`/api/admin/respaldo/download?file=${encodeURIComponent(file.name)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 px-3 py-1.5
                               bg-gray-800 hover:bg-gray-700
                               text-gray-300 text-xs font-medium
                               rounded-lg transition-colors whitespace-nowrap shrink-0"
                  >
                    <Download size={13} />
                    Descargar
                  </a>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Nota ── */}
      <p className="text-xs text-gray-700 border-t border-gray-800 pt-3">
        Los respaldos se generan automáticamente cada día a las 06:00 UTC (medianoche hora México).
        Se guardan en Supabase Storage (bucket privado). El archivo descargado es un JSON con todas las tablas.
      </p>
    </div>
  );
}
