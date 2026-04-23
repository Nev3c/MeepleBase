"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Library, Dices, User, Wrench, Users } from "lucide-react";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/library", label: "Bibliothek", icon: Library },
  { href: "/plays",   label: "Partien",    icon: Dices   },
  { href: "/tools",   label: "Tools",      icon: Wrench  },
  { href: "/players", label: "Spieler",    icon: Users   },
  { href: "/profile", label: "Profil",     icon: User    },
];

interface BottomNavProps {
  unreadMessages?: number;
}

export function BottomNav({ unreadMessages = 0 }: BottomNavProps) {
  const pathname = usePathname();

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-border pb-safe"
      style={{ transform: "translateZ(0)", willChange: "transform" }}
      aria-label="Hauptnavigation"
    >
      <div className="flex items-stretch max-w-lg mx-auto px-2">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const isActive = pathname.startsWith(href);
          const showBadge = href === "/players" && unreadMessages > 0;

          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex flex-col items-center justify-center gap-1 flex-1 py-3 px-1 min-h-[56px]",
                "transition-colors duration-200 ease-out relative",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset",
                isActive
                  ? "text-amber-500"
                  : "text-slate-400 hover:text-slate-600 active:scale-95"
              )}
              aria-current={isActive ? "page" : undefined}
            >
              {/* Always in DOM — only colour changes, no layout-shifting insertion */}
              <span className={cn(
                "absolute top-0 left-1/2 -translate-x-1/2 w-6 h-0.5 rounded-full transition-colors duration-200",
                isActive ? "bg-amber-500" : "bg-transparent"
              )} />

              <span className="relative">
                <Icon
                  size={22}
                  strokeWidth={2}
                  className="transition-colors duration-200"
                />
                {showBadge && (
                  <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-amber-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center leading-none">
                    {unreadMessages > 9 ? "9+" : unreadMessages}
                  </span>
                )}
              </span>

              <span className="text-[11px] font-semibold tracking-wide leading-none">
                {label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
