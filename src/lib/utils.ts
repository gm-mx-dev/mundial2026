import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatMXN(amount: number): string {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    minimumFractionDigits: 0,
  }).format(amount);
}

export function formatDateTime(iso: string): string {
  return new Intl.DateTimeFormat("es-MX", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Mexico_City",
  }).format(new Date(iso));
}

export function isMatchLocked(kickoffAt: string): boolean {
  return new Date(kickoffAt) <= new Date();
}

const FLAG_MAP: Record<string, string> = {
  "Sudáfrica": "🇿🇦", "Canadá": "🇨🇦", "Brasil": "🇧🇷", "Japón": "🇯🇵",
  "Alemania": "🇩🇪", "Paraguay": "🇵🇾", "Países Bajos": "🇳🇱", "Marruecos": "🇲🇦",
  "C. Marfil": "🇨🇮", "Noruega": "🇳🇴", "Francia": "🇫🇷", "Suecia": "🇸🇪",
  "México": "🇲🇽", "Ecuador": "🇪🇨", "Inglaterra": "🏴󠁧󠁢󠁥󠁮󠁧󠁿", "RD Congo": "🇨🇩",
  "Bélgica": "🇧🇪", "Senegal": "🇸🇳", "Estados Unidos": "🇺🇸", "Bosnia H.": "🇧🇦",
  "España": "🇪🇸", "Austria": "🇦🇹", "Portugal": "🇵🇹", "Croacia": "🇭🇷",
  "Suiza": "🇨🇭", "Argelia": "🇩🇿", "Australia": "🇦🇺", "Egipto": "🇪🇬",
  "Argentina": "🇦🇷", "Cabo Verde": "🇨🇻", "Colombia": "🇨🇴", "Ghana": "🇬🇭",
};

export function getTeamFlag(team: string): string {
  return FLAG_MAP[team] ?? "🏳️";
}
