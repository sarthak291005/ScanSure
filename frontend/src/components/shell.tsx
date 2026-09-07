"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { cx, Icon, ICONS, Badge } from "./ui";
import type { User } from "@/lib/types";

const NAV = [
  { href: "/", label: "Dashboard", icon: ICONS.dashboard },
  { href: "/products", label: "Products", icon: ICONS.products },
  { href: "/scanner", label: "Label Scanner", icon: ICONS.scanner },
  { href: "/reports", label: "Inspection Reports", icon: ICONS.reports },
  { href: "/rules", label: "Compliance Rules", icon: ICONS.rules },
];

const ROLE_LABEL: Record<string, string> = {
  manufacturer: "Manufacturer",
  packer: "Packer",
  importer: "Importer",
  seller: "Marketplace Seller",
  inspector: "Certified Inspector",
};

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathnameSafe();
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2.5 px-5 pb-6 pt-6">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 text-white shadow-md shadow-brand-900/30">
          <Icon d={ICONS.shield} className="h-5 w-5" strokeWidth={2} />
        </div>
        <div>
          <div className="text-[15px] font-bold leading-tight text-white">
            ScanSure
          </div>
          <div className="text-[11px] font-medium text-brand-300/80">
            Legal Metrology Compliance
          </div>
        </div>
      </div>
      <nav className="flex-1 space-y-1 px-3">
        {NAV.map((n) => {
          const active =
            n.href === "/" ? pathname === "/" : pathname.startsWith(n.href);
          return (
            <a
              key={n.href}
              href={n.href}
              onClick={onNavigate}
              className={cx(
                "group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200",
                active
                  ? "bg-white/10 text-white"
                  : "text-brand-200/70 hover:bg-white/5 hover:text-white hover:translate-x-1",
              )}
            >
              {active && (
                <span className="animate-fade-in absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full bg-brand-300" />
              )}
              <Icon
                d={n.icon}
                className={cx(
                  "h-[18px] w-[18px] transition-all duration-200 group-hover:scale-110",
                  active ? "text-brand-300" : "text-brand-300/50 group-hover:text-brand-300",
                )}
              />
              <span className="relative z-10">{n.label}</span>
              {active && (
                <span className="ping-soft ml-auto relative h-1.5 w-1.5 rounded-full bg-brand-300" />
              )}
            </a>
          );
        })}
      </nav>
      <div className="mx-3 mb-4 rounded-xl bg-white/5 p-3 transition-colors hover:bg-white/10">
        <div className="flex items-center gap-2 text-xs font-semibold text-brand-200">
          <span className="ping-soft relative h-2 w-2 rounded-full bg-emerald-400" />
          <Icon d={ICONS.sparkles} className="h-3.5 w-3.5 animate-pulse text-brand-300" />
          AI Engine v2.4
          <span className="ml-auto rounded-full bg-emerald-400/20 px-1.5 py-0.5 text-[9px] font-bold text-emerald-300">
            LIVE
          </span>
        </div>
        <p className="mt-1 text-[11px] leading-relaxed text-brand-300/60">
          LM (Packing Rules) 2011 · FSS Act 2006 · MRP Rules 2021
        </p>
        <a
          href="/index.html"
          target="_blank"
          rel="noopener noreferrer"
          className="mt-2.5 flex items-center justify-between rounded-lg bg-blue-600/30 px-2 py-1.5 text-[11px] font-semibold text-blue-200 hover:bg-blue-600/50 hover:text-white transition"
        >
          <span>Open Standalone HTML</span>
          <span>&rarr;</span>
        </a>
      </div>
    </div>
  );
}

function usePathnameSafe() {
  // import here to keep the file simple; next/navigation client hook
  return React.useSyncExternalStore(
    (cb) => {
      window.addEventListener("popstate", cb);
      return () => window.removeEventListener("popstate", cb);
    },
    () => window.location.pathname,
    () => "/",
  );
}

export function Shell({
  user,
  children,
}: {
  user: User;
  children: React.ReactNode;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const router = useRouter();

  const logout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {}
    try {
      localStorage.removeItem("lm_user");
      localStorage.removeItem("lm_token");
    } catch {}
    window.location.href = "/login";
  };

  useEffect(() => {
    const onPop = () => setMobileOpen(false);
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  return (
    <div className="min-h-screen">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 bg-gradient-to-b from-brand-950 via-ink-950 to-ink-950 lg:block">
        <SidebarContent />
        <UserFooter user={user} onLogout={logout} />
      </aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-ink-950/50 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="absolute inset-y-0 left-0 w-72 bg-gradient-to-b from-brand-950 via-ink-950 to-ink-950 shadow-2xl">
            <SidebarContent onNavigate={() => setMobileOpen(false)} />
            <UserFooter user={user} onLogout={logout} />
          </aside>
        </div>
      )}

      {/* Top bar (mobile) */}
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-ink-200 bg-white/80 px-4 py-3 backdrop-blur lg:hidden">
        <button
          onClick={() => setMobileOpen(true)}
          className="rounded-lg p-2 text-ink-600 hover:bg-ink-100"
          aria-label="Open menu"
        >
          <Icon d={ICONS.menu} />
        </button>
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-600 text-white">
            <Icon d={ICONS.shield} className="h-4 w-4" />
          </div>
          <span className="text-sm font-bold text-ink-900">ScanSure</span>
        </div>
        <button
          onClick={logout}
          className="rounded-lg p-2 text-ink-500 hover:bg-ink-100"
          aria-label="Sign out"
        >
          <Icon d={ICONS.logout} className="h-5 w-5" />
        </button>
      </header>

      <main className="lg:pl-64">
        <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          {children}
        </div>
      </main>
    </div>
  );
}

function UserFooter({ user, onLogout }: { user: User; onLogout: () => void }) {
  const initials = user.name
    .split(" ")
    .map((s) => s[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  return (
    <div className="border-t border-white/10 p-3">
      <div className="flex items-center gap-3 rounded-xl px-2 py-2">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-500/20 text-xs font-bold text-brand-200">
          {initials}
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold text-white">
            {user.name}
          </div>
          <div className="truncate text-[11px] text-brand-300/70">
            {user.company || user.email}
          </div>
        </div>
        <button
          onClick={onLogout}
          className="rounded-lg p-2 text-brand-300/60 transition-colors hover:bg-white/10 hover:text-white"
          title="Sign out"
          aria-label="Sign out"
        >
          <Icon d={ICONS.logout} className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-ink-950 sm:text-2xl">
          {title}
        </h1>
        {subtitle && <p className="mt-1 text-sm text-ink-500">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export { Badge };
