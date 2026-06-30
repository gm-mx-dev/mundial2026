"use client";
import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import type { RankingRow } from "@/types/database";
import RankingTable from "./RankingTable";

interface Props {
  initialRows: RankingRow[];
}

export default function RankingRealtime({ initialRows }: Props) {
  const [rows, setRows] = useState(initialRows);
  const supabase = createClient();

  const fetchRanking = useCallback(async () => {
    const { data } = await supabase.from("ranking").select("*").order("position");
    if (data) setRows(data as RankingRow[]);
  }, [supabase]);

  useEffect(() => {
    // Escuchar cambios en matches y predictions para refrescar el ranking
    const channel = supabase
      .channel("ranking-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "matches" }, fetchRanking)
      .on("postgres_changes", { event: "*", schema: "public", table: "predictions" }, fetchRanking)
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [supabase, fetchRanking]);

  return <RankingTable rows={rows} />;
}
