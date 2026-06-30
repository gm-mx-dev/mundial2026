/**
 * Banderas de los 32 equipos del Mundial 2026.
 * Usa el paquete country-flag-icons (SVGs inline, sin CDN externo).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
import type { ComponentType } from "react";
import AR from "country-flag-icons/react/3x2/AR";
import AT from "country-flag-icons/react/3x2/AT";
import AU from "country-flag-icons/react/3x2/AU";
import BA from "country-flag-icons/react/3x2/BA";
import BE from "country-flag-icons/react/3x2/BE";
import BR from "country-flag-icons/react/3x2/BR";
import CA from "country-flag-icons/react/3x2/CA";
import CD from "country-flag-icons/react/3x2/CD";
import CH from "country-flag-icons/react/3x2/CH";
import CI from "country-flag-icons/react/3x2/CI";
import CO from "country-flag-icons/react/3x2/CO";
import CV from "country-flag-icons/react/3x2/CV";
import DE from "country-flag-icons/react/3x2/DE";
import DZ from "country-flag-icons/react/3x2/DZ";
import EC from "country-flag-icons/react/3x2/EC";
import EG from "country-flag-icons/react/3x2/EG";
import ES from "country-flag-icons/react/3x2/ES";
import FR from "country-flag-icons/react/3x2/FR";
import GB from "country-flag-icons/react/3x2/GB";
import GH from "country-flag-icons/react/3x2/GH";
import HR from "country-flag-icons/react/3x2/HR";
import JP from "country-flag-icons/react/3x2/JP";
import MA from "country-flag-icons/react/3x2/MA";
import MX from "country-flag-icons/react/3x2/MX";
import NL from "country-flag-icons/react/3x2/NL";
import NO from "country-flag-icons/react/3x2/NO";
import PT from "country-flag-icons/react/3x2/PT";
import PY from "country-flag-icons/react/3x2/PY";
import SE from "country-flag-icons/react/3x2/SE";
import SN from "country-flag-icons/react/3x2/SN";
import US from "country-flag-icons/react/3x2/US";
import ZA from "country-flag-icons/react/3x2/ZA";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type FlagComp = ComponentType<any>;

const TEAM_FLAGS: Record<string, FlagComp> = {
  "Argentina":      AR,
  "Austria":        AT,
  "Australia":      AU,
  "Bosnia H.":      BA,
  "Bélgica":        BE,
  "Brasil":         BR,
  "Canadá":         CA,
  "RD Congo":       CD,
  "Suiza":          CH,
  "C. Marfil":      CI,
  "Colombia":       CO,
  "Cabo Verde":     CV,
  "Alemania":       DE,
  "Argelia":        DZ,
  "Ecuador":        EC,
  "Egipto":         EG,
  "España":         ES,
  "Francia":        FR,
  "Inglaterra":     GB,
  "Ghana":          GH,
  "Croacia":        HR,
  "Japón":          JP,
  "Marruecos":      MA,
  "México":         MX,
  "Países Bajos":   NL,
  "Noruega":        NO,
  "Portugal":       PT,
  "Paraguay":       PY,
  "Suecia":         SE,
  "Senegal":        SN,
  "Estados Unidos": US,
  "Sudáfrica":      ZA,
};

interface Props {
  team: string;
  className?: string;
}

export default function FlagIcon({ team, className = "w-6 h-4 inline-block rounded-sm" }: Props) {
  const Flag = TEAM_FLAGS[team];
  if (!Flag) return null;
  return <Flag className={className} aria-label={team} />;
}
