"use client";
import { useEffect, useState } from "react";

interface Props {
  kickoffAt: string; // ISO string
}

interface TimeLeft {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  started: boolean;
}

function calc(kickoffAt: string): TimeLeft {
  const diff = new Date(kickoffAt).getTime() - Date.now();
  if (diff <= 0) return { days: 0, hours: 0, minutes: 0, seconds: 0, started: true };
  const total = Math.floor(diff / 1000);
  return {
    days: Math.floor(total / 86400),
    hours: Math.floor((total % 86400) / 3600),
    minutes: Math.floor((total % 3600) / 60),
    seconds: total % 60,
    started: false,
  };
}

function pad(n: number) {
  return String(n).padStart(2, "0");
}

export default function CountdownTimer({ kickoffAt }: Props) {
  const [time, setTime] = useState<TimeLeft>(() => calc(kickoffAt));

  useEffect(() => {
    const id = setInterval(() => setTime(calc(kickoffAt)), 1000);
    return () => clearInterval(id);
  }, [kickoffAt]);

  if (time.started) {
    return (
      <div className="flex items-center gap-1.5 text-green-400 font-semibold text-sm">
        <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse inline-block" />
        En curso
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1 text-indigo-300 font-mono text-sm tabular-nums">
      {time.days > 0 && (
        <>
          <span className="font-bold text-white">{time.days}</span>
          <span className="text-gray-500 text-xs mr-1">d</span>
        </>
      )}
      <span className="font-bold text-white">{pad(time.hours)}</span>
      <span className="text-gray-600">:</span>
      <span className="font-bold text-white">{pad(time.minutes)}</span>
      <span className="text-gray-600">:</span>
      <span className="font-bold text-white">{pad(time.seconds)}</span>
    </div>
  );
}
