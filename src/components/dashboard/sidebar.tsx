"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Briefcase,
  FileText,
  Users,
  Settings,
  ShieldCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/dashboard/jobs", label: "Stellen", icon: Briefcase },
  { href: "/dashboard/candidates", label: "Kandidaten", icon: Users },
  { href: "/dashboard/cv-generator", label: "CV", icon: FileText },
  { href: "/dashboard/users", label: "Benutzer", icon: ShieldCheck },
  { href: "/dashboard/settings", label: "Settings", icon: Settings },
];

// Mobile: show 5 key items in bottom tab bar
const mobileNavItems = [
  { href: "/dashboard", label: "Home", icon: LayoutDashboard },
  { href: "/dashboard/jobs", label: "Stellen", icon: Briefcase },
  { href: "/dashboard/candidates", label: "Kandidaten", icon: Users },
  { href: "/dashboard/cv-generator", label: "CV", icon: FileText },
  { href: "/dashboard/settings", label: "Mehr", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();

  const isActive = (href: string) =>
    pathname === href ||
    (href !== "/dashboard" && pathname.startsWith(href));

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className="hidden lg:fixed lg:left-0 lg:top-0 lg:z-40 lg:h-screen lg:w-[260px] lg:flex lg:flex-col bg-sidebar border-r border-sidebar-border">
        <div className="flex h-16 items-center border-b border-sidebar-border px-6">
          <Link href="/dashboard" className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent">
              <span className="text-sm font-bold text-accent-foreground">X</span>
            </div>
            <span className="text-lg font-semibold tracking-tight text-sidebar-foreground">
              XMB Admin
            </span>
          </Link>
        </div>

        <nav className="flex flex-col gap-0.5 p-3 flex-1">
          {navItems.map((item) => {
            const active = isActive(item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                  active
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-foreground/60 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                )}
              >
                <item.icon
                  className={cn(
                    "h-[18px] w-[18px]",
                    active ? "text-accent" : "text-sidebar-foreground/40"
                  )}
                />
                {item.label}
                {active && (
                  <div className="ml-auto h-1.5 w-1.5 rounded-full bg-accent" />
                )}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-sidebar-border p-3">
          <div className="rounded-lg bg-sidebar-accent/50 px-4 py-3">
            <p className="text-xs text-sidebar-foreground/40">XMB Group AG</p>
            <p className="text-xs text-sidebar-foreground/25 mt-0.5">Admin Portal v1.0</p>
          </div>
        </div>
      </aside>

      {/* Mobile Bottom Tab Bar */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 lg:hidden border-t border-border bg-card/95 backdrop-blur-lg pb-safe">
        <div className="flex items-center justify-around px-1">
          {mobileNavItems.map((item) => {
            const active = isActive(item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex flex-col items-center gap-0.5 py-2 px-3 min-w-0 flex-1 transition-colors",
                  active
                    ? "text-foreground"
                    : "text-muted-foreground"
                )}
              >
                <div className={cn(
                  "flex items-center justify-center w-10 h-7 rounded-full transition-colors",
                  active ? "bg-accent/15" : ""
                )}>
                  <item.icon
                    className={cn(
                      "h-5 w-5",
                      active ? "text-accent" : ""
                    )}
                  />
                </div>
                <span className="text-[10px] font-medium truncate">
                  {item.label}
                </span>
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
