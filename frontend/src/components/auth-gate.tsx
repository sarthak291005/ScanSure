"use client";

import React, { useEffect, useState } from "react";
import { AppProvider } from "@/app/providers";
import type { User } from "@/lib/types";

export function AuthGate({
  initialUser,
  children,
}: {
  initialUser: User | null;
  children: React.ReactNode;
}) {
  const [user, setUser] = useState<User | null>(initialUser);
  const [checking, setChecking] = useState(!initialUser);

  useEffect(() => {
    if (initialUser) {
      // Sync to localStorage as backup
      try {
        localStorage.setItem("lm_user", JSON.stringify(initialUser));
      } catch {}
      return;
    }

    // Attempt client-side restore
    try {
      const stored = localStorage.getItem("lm_user");
      const token = localStorage.getItem("lm_token");
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed?.id && parsed?.email) {
          setUser(parsed);
          setChecking(false);

          // Verify in background
          fetch("/api/auth/me", {
            headers: token ? { Authorization: `Bearer ${token}` } : {},
          })
            .then((r) => (r.ok ? r.json() : null))
            .then((data) => {
              if (data?.user) {
                setUser(data.user);
                localStorage.setItem("lm_user", JSON.stringify(data.user));
              }
            })
            .catch(() => {});
          return;
        }
      }
    } catch {}

    // Try /api/auth/me with cookie
    fetch("/api/auth/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.user) {
          setUser(data.user);
          try {
            localStorage.setItem("lm_user", JSON.stringify(data.user));
          } catch {}
          setChecking(false);
        } else {
          window.location.href = "/login";
        }
      })
      .catch(() => {
        window.location.href = "/login";
      });
  }, [initialUser]);

  if (checking) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
          <p className="text-sm font-medium text-slate-500">
            Loading Legal Metrology workspace…
          </p>
        </div>
      </div>
    );
  }

  if (!user) return null;

  return <AppProvider user={user}>{children}</AppProvider>;
}
