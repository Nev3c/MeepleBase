"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Library, Dices, User, Compass } from "lucide-react";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  {
    href: "/library",
    label: "Bibliothek",
    icon: Library,
  },
  {
    href: "/plays",
    label: "Partien",
    icon: Dices,
  },
  {
    href: "/discover",
    label: "Entdecken",
    icon: Compass,
  },
  {
    href: "/profile",
    label: "Profil",
    icon: User,
  },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-border pb-safe"
      aria-label="Hauptnavigation"
    >
      <div className="flex items-stretch max-w-lg mx-auto">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const isActive = pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex flex-col items-center justify-center gap-1 flex-1 py-3 px-2 min-h-[56px]",
                "transition-all duration-200 ease-out relative",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset",
                isActive
                  ? "text-amber-500"
                  : "text-slate-400 hover:text-slate-600 active:scale-95"
              )}
              aria-current={isActive ? "page" : undefined}
            >
              {isActive && (
                <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-amber-500 rounded-full" />
              )}
              <Icon
                size={22}
                strokeWidth={isActive ? 2.5 : 1.75}
                className="transition-all duration-200"
              />
              <span className={cn(
                "text-[10px] font-medium tracking-wide leading-none",
                isActive ? "font-semibold" : ""
              )}>
                {label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
