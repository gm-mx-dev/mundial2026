"use client";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import type { Participant } from "@/types/database";
import { UserCheck, UserX } from "lucide-react";

interface Props {
  participants: Participant[];
  adminId: string;
}

export default function ParticipantsManager({ participants: initial, adminId }: Props) {
  const [participants, setParticipants] = useState(initial);
  const [loading, setLoading] = useState<string | null>(null);
  const [reasonModal, setReasonModal] = useState<{ id: string; name: string } | null>(null);
  const [reason, setReason] = useState("");
  const supabase = createClient();

  const toggle = async (p: Participant, confirmReason?: string) => {
    if (!p.is_active && !confirmReason) {
      // Reactivar: sin razón requerida
    } else if (p.is_active && !confirmReason) {
      // Desactivar: pedir razón
      setReasonModal({ id: p.id, name: p.name });
      return;
    }

    setLoading(p.id);
    const newActive = !p.is_active;

    // Actualizar participante
    const { error } = await supabase
      .from("participants")
      .update({
        is_active: newActive,
        deactivated_reason: newActive ? null : confirmReason,
        deactivated_at: newActive ? null : new Date().toISOString(),
      })
      .eq("id", p.id);

    if (!error) {
      // Registrar en bitácora
      await supabase.from("audit_log").insert({
        action_type: newActive ? "participant_activated" : "participant_deactivated",
        performed_by: adminId,
        affected_user: p.id,
        before_value: { is_active: p.is_active },
        after_value: { is_active: newActive },
        reason: confirmReason ?? null,
      });

      setParticipants((prev) =>
        prev.map((part) =>
          part.id === p.id
            ? { ...part, is_active: newActive, deactivated_reason: confirmReason ?? null }
            : part
        )
      );
    }
    setLoading(null);
    setReasonModal(null);
    setReason("");
  };

  const activeCount = participants.filter((p) => p.is_active).length;
  const bolsa = activeCount * 500;

  return (
    <>
      {/* Bolsa en tiempo real */}
      <div className="px-4 py-2 bg-indigo-950/30 border-b border-gray-800 text-sm text-indigo-300">
        💰 Bolsa actual: <strong>${bolsa.toLocaleString("es-MX")} MXN</strong>
        <span className="text-gray-500 ml-2">({activeCount} activos × $500)</span>
      </div>

      <div className="divide-y divide-gray-800/60">
        {participants.map((p) => (
          <div key={p.id} className="flex items-center justify-between px-4 py-3 hover:bg-gray-800/30 transition-colors">
            <div className="flex items-center gap-3">
              {/* Indicador de estado */}
              <div className={cn(
                "w-2.5 h-2.5 rounded-full flex-shrink-0",
                p.is_active ? "bg-green-400" : "bg-red-500"
              )} />
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-white">{p.name}</span>
                  {p.is_admin && (
                    <span className="text-xs bg-indigo-900/60 text-indigo-300 px-1.5 py-0.5 rounded">Admin</span>
                  )}
                  {p.needs_proxy && (
                    <span className="text-xs bg-gray-800 text-gray-400 px-1.5 py-0.5 rounded">Sin celular</span>
                  )}
                </div>
                {!p.is_active && p.deactivated_reason && (
                  <div className="text-xs text-red-400 mt-0.5">Razón: {p.deactivated_reason}</div>
                )}
              </div>
            </div>

            {/* Toggle */}
            <button
              onClick={() => toggle(p)}
              disabled={loading === p.id}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all",
                p.is_active
                  ? "bg-red-900/30 text-red-400 hover:bg-red-900/50 border border-red-800/40"
                  : "bg-green-900/30 text-green-400 hover:bg-green-900/50 border border-green-800/40",
                loading === p.id && "opacity-50 cursor-not-allowed"
              )}
            >
              {p.is_active ? (
                <><UserX size={13} /> Desactivar</>
              ) : (
                <><UserCheck size={13} /> Activar</>
              )}
            </button>
          </div>
        ))}
      </div>

      {/* Modal razón de desactivación */}
      {reasonModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 w-full max-w-sm">
            <h3 className="font-bold text-white mb-1">Desactivar a {reasonModal.name}</h3>
            <p className="text-sm text-gray-400 mb-4">
              El participante no podrá entrar a la app y desaparecerá del ranking.
              La bolsa bajará $500.
            </p>
            <label className="block text-xs text-gray-400 mb-1.5">Razón (obligatoria)</label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Ej: No realizó el pago correspondiente"
              rows={3}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <div className="flex gap-3 mt-4">
              <button
                onClick={() => { setReasonModal(null); setReason(""); }}
                className="flex-1 py-2 rounded-lg bg-gray-800 text-gray-300 text-sm hover:bg-gray-700 transition-colors"
              >
                Cancelar
              </button>
              <button
                disabled={!reason.trim()}
                onClick={() => {
                  const p = participants.find((x) => x.id === reasonModal.id)!;
                  toggle(p, reason.trim());
                }}
                className="flex-1 py-2 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
