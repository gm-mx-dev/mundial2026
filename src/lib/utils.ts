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

const FLAG_CODE_MAP: Record<string, string> = {
  "Sudáfrica": "za", "Canadá": "ca", "Brasil": "br", "Japón": "jp",
  "Alemania": "de", "Paraguay": "py", "Países Bajos": "nl", "Marruecos": "ma",
  "C. Marfil": "ci", "Noruega": "no", "Francia": "fr", "Suecia": "se",
  "México": "mx", "Ecuador": "ec", "Inglaterra": "gb-eng", "RD Congo": "cd",
  "Bélgica": "be", "Senegal": "sn", "Estados Unidos": "us", "Bosnia H.": "ba",
  "España": "es", "Austria": "at", "Portugal": "pt", "Croacia": "hr",
  "Suiza": "ch", "Argelia": "dz", "Australia": "au", "Egipto": "eg",
  "Argentina": "ar", "Cabo Verde": "cv", "Colombia": "co", "Ghana": "gh",
};

export function getTeamFlagCode(team: string): string | null {
  return FLAG_CODE_MAP[team] ?? null;
}

export function getTeamFlagUrl(team: string, size = 20): string {
  const code = FLAG_CODE_MAP[team];
  return code ? `https://flagcdn.com/w${size}/${code}.png` : "";
}

// Devuelve la fecha local (YYYY-MM-DD) en zona horaria de CDMX
export function toMxDateKey(iso: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Mexico_City",
    year: "numeric", month: "2-digit", day: "2-digit",
  }).format(new Date(iso));
}

export function formatDayHeader(dateKey: string): string {
  const [y, m, d] = dateKey.split("-");
  const date = new Date(`${y}-${m}-${d}T12:00:00`);
  return new Intl.DateTimeFormat("es-MX", {
    weekday: "long", day: "numeric", month: "long",
  }).format(date);
}
