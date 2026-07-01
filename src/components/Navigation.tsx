"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Trophy, Star, ClipboardList, Settings, UserCircle, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";

const navItems = [
  { href: "/",            label: "Inicio",      icon: Trophy },
  { href: "/pronosticos", label: "Pronósticos", icon: Star },
  { href: "/partidos",    label: "Partidos",    icon: ClipboardList },
  { href: "/perfil",      label: "Mi Perfil",   icon: UserCircle },
  { href: "/admin",       label: "Admin",       icon: Settings, adminOnly: true },
];

interface NavigationProps {
  isAdmin?: boolean;
}

export default function Navigation({ isAdmin = false }: NavigationProps) {
  const pathname = usePathname();
  const router = useRouter();
  const items = navItems.filter((i) => !i.adminOnly || isAdmin);

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/pronosticos");
    router.refresh();
  };

  return (
    <>
      {/* ── Mobile: barra top con scroll horizontal ── */}
      <nav className="md:hidden fixed top-0 left-0 right-0 z-50 bg-gray-950/95 backdrop-blur border-b border-gray-800">
        <div className="flex overflow-x-auto scrollbar-hide px-2">
          {items.map(({ href, label, icon: Icon }) => {
            const active = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "flex items-center gap-1.5 px-4 py-3 text-sm font-medium whitespace-nowrap transition-colors",
                  active
                    ? "text-indigo-400 border-b-2 border-indigo-400"
                    : "text-gray-400 hover:text-gray-200"
                )}
              >
                <Icon size={16} />
                {label}
              </Link>
            );
          })}
          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 px-4 py-3 text-sm font-medium whitespace-nowrap text-gray-600 hover:text-red-400 transition-colors ml-auto"
          >
            <LogOut size={16} />
            Salir
          </button>
        </div>
      </nav>

      {/* ── Tablet/Desktop: sidebar ── */}
      <aside className="hidden md:flex flex-col fixed top-0 left-0 h-full w-56 bg-gray-900 border-r border-gray-800 z-50 pt-6">
        <div className="px-4 mb-8">
          <div className="text-lg font-bold text-white">⚽ Quiniela</div>
          <div className="text-xs text-gray-500">Mundial 2026</div>
        </div>
        <nav className="flex-1 px-2 space-y-1">
          {items.map(({ href, label, icon: Icon }) => {
            const active = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                  active
                    ? "bg-indigo-600 text-white"
                    : "text-gray-400 hover:bg-gray-800 hover:text-white"
                )}
              >
                <Icon size={18} />
                {label}
              </Link>
            );
          })}
        </nav>
        <div className="px-2 pb-6">
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-800 hover:text-red-400 transition-colors"
          >
            <LogOut size={18} />
            Cerrar sesión
          </button>
        </div>
      </aside>
    </>
  );
}
