"use client";

import React, { useEffect, useState } from "react";
import { Icon, ICONS } from "@/components/ui";

export default function LoginPage() {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [loading, setLoading] = useState(false);
  const [demoLoading, setDemoLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: "",
    email: "demo@scansure.ai",
    password: "demo1234",
    company: "",
    role: "seller",
  });

  // Check if already authenticated on client
  useEffect(() => {
    try {
      const stored = localStorage.getItem("lm_user");
      const token = localStorage.getItem("lm_token");
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed?.id) {
          // Double check with server
          fetch("/api/auth/me", {
            headers: token ? { Authorization: `Bearer ${token}` } : {},
          })
            .then((r) => (r.ok ? r.json() : null))
            .then((data) => {
              if (data?.user) {
                window.location.href = "/";
              }
            })
            .catch(() => {});
        }
      }
    } catch {}
  }, []);

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const performLogin = async (email: string, pass: string) => {
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password: pass }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Invalid email or password");
    if (data.user) {
      try {
        localStorage.setItem("lm_user", JSON.stringify(data.user));
      } catch {}
    }
    if (data.token) {
      try {
        localStorage.setItem("lm_token", data.token);
      } catch {}
    }
    window.location.href = "/";
  };

  const handle1ClickDemo = async () => {
    setDemoLoading(true);
    setError(null);
    const candidates = [
      "demo@scansure.ai",
      "demo@labelcheck.ai",
      "demo@labelguard.in",
    ];
    let lastError: Error | null = null;
    for (const email of candidates) {
      try {
        await performLogin(email, "demo1234");
        return;
      } catch (err: any) {
        lastError = err;
      }
    }
    setError(lastError?.message || "Failed to sign in with demo account");
    setDemoLoading(false);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      if (mode === "login") {
        await performLogin(form.email, form.password);
      } else {
        const res = await fetch("/api/auth/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: form.name.trim() || "User",
            email: form.email.trim(),
            password: form.password,
            company: form.company.trim() || undefined,
            role: form.role,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Registration failed");
        if (data.user) {
          try {
            localStorage.setItem("lm_user", JSON.stringify(data.user));
          } catch {}
        }
        if (data.token) {
          try {
            localStorage.setItem("lm_token", data.token);
          } catch {}
        }
        window.location.href = "/";
      }
    } catch (err: any) {
      setError(err.message || "Something went wrong");
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 px-4 py-12 sm:px-6 lg:px-8">
      <div className="w-full max-w-md">
        {/* Brand header */}
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-lg shadow-blue-600/30">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-8 w-8"
            >
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              <path d="m9 12 2 2 4-4" />
            </svg>
          </div>
          <h1 className="mt-4 text-2xl font-bold tracking-tight text-slate-900">
            ScanSure
          </h1>
          <p className="mt-1 text-xs font-semibold uppercase tracking-wider text-blue-600">
            Automated Legal Metrology Compliance Verification
          </p>
        </div>

        {/* Card */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-7 shadow-xl shadow-slate-900/5 sm:p-8">
          <div className="mb-6">
            <h2 className="text-xl font-bold text-slate-900">
              {mode === "login" ? "Welcome back" : "Create your account"}
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              {mode === "login"
                ? "Sign in to continue to your dashboard"
                : "Start verifying packaging labels in seconds"}
            </p>
          </div>

          {/* Public HTML File Link & Demo Callout */}
          <div className="mb-6 space-y-2.5">
            <a
              href="/index.html"
              className="flex items-center justify-between gap-2.5 rounded-xl border border-blue-200 bg-blue-50/90 p-3 text-xs font-semibold text-blue-900 shadow-sm transition hover:bg-blue-100"
            >
              <span className="flex items-center gap-2">
                <span className="flex h-5 w-5 items-center justify-center rounded-lg bg-blue-600 text-[10px] text-white font-bold">
                  HTML
                </span>
                <span>Open Standalone Public HTML Version</span>
              </span>
              <span className="text-blue-700 underline font-bold">&rarr;</span>
            </a>

            {mode === "login" && (
              <div className="flex items-start gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50/80 p-3.5 text-xs text-emerald-800">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600"
                >
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                  <path d="m9 11 3 3L22 4" />
                </svg>
                <div className="leading-relaxed">
                  <span className="font-semibold text-emerald-900">Demo data ready</span> — use the credentials below or click 1-click sign in.
                </div>
              </div>
            )}
          </div>

          {error && (
            <div className="mb-5 flex items-start gap-2.5 rounded-xl border border-rose-200 bg-rose-50 p-3.5 text-xs font-medium text-rose-800">
              <Icon d={ICONS.alert} className="mt-0.5 h-4 w-4 shrink-0 text-rose-600" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={submit} className="space-y-4">
            {mode === "register" && (
              <>
                <div>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-700">
                    Full Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={form.name}
                    onChange={(e) => set("name", e.target.value)}
                    placeholder="Shraddha Murdia"
                    className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-blue-500/10"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-700">
                      Company
                    </label>
                    <input
                      type="text"
                      value={form.company}
                      onChange={(e) => set("company", e.target.value)}
                      placeholder="Balaji Foods"
                      className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-blue-500/10"
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-700">
                      Role
                    </label>
                    <select
                      value={form.role}
                      onChange={(e) => set("role", e.target.value)}
                      className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-sm text-slate-900 focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-blue-500/10"
                    >
                      <option value="manufacturer">Manufacturer</option>
                      <option value="packer">Packer</option>
                      <option value="importer">Importer</option>
                      <option value="seller">Seller</option>
                      <option value="inspector">Inspector</option>
                    </select>
                  </div>
                </div>
              </>
            )}

            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-700">
                Email Address <span className="text-rose-500">*</span>
              </label>
              <input
                type="email"
                required
                value={form.email}
                onChange={(e) => set("email", e.target.value)}
                placeholder="demo@scansure.ai"
                className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-blue-500/10"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-700">
                Password <span className="text-rose-500">*</span>
              </label>
              <input
                type="password"
                required
                value={form.password}
                onChange={(e) => set("password", e.target.value)}
                placeholder="••••••"
                minLength={6}
                className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-blue-500/10"
              />
            </div>

            <button
              type="submit"
              disabled={loading || demoLoading}
              className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white shadow-md shadow-blue-600/25 transition-all hover:bg-blue-700 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading && (
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
              )}
              {mode === "login" ? "Sign In" : "Create Account & Sign In"}
            </button>
          </form>

          {mode === "login" && (
            <div className="mt-4">
              <button
                type="button"
                onClick={handle1ClickDemo}
                disabled={loading || demoLoading}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-100 hover:text-slate-900 disabled:opacity-60"
              >
                {demoLoading ? (
                  <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
                ) : (
                  <Icon d={ICONS.sparkles} className="h-4 w-4 text-blue-600" />
                )}
                1-Click Demo Sign In (Instant Access)
              </button>
            </div>
          )}

          {/* Toggle sign in / sign up */}
          <div className="mt-6 border-t border-slate-100 pt-5 text-center text-sm text-slate-500">
            {mode === "login" ? (
              <p>
                Don&apos;t have an account?{" "}
                <button
                  type="button"
                  onClick={() => {
                    setMode("register");
                    setError(null);
                    setForm((f) => ({
                      ...f,
                      email: f.email === "demo@scansure.ai" ? "" : f.email,
                      password: "",
                    }));
                  }}
                  className="font-semibold text-blue-600 hover:text-blue-700 hover:underline"
                >
                  Sign up
                </button>
              </p>
            ) : (
              <p>
                Already have an account?{" "}
                <button
                  type="button"
                  onClick={() => {
                    setMode("login");
                    setError(null);
                    setForm((f) => ({
                      ...f,
                      email: f.email || "demo@scansure.ai",
                      password: f.password || "demo1234",
                    }));
                  }}
                  className="font-semibold text-blue-600 hover:text-blue-700 hover:underline"
                >
                  Sign in
                </button>
              </p>
            )}
          </div>
        </div>

        {/* Footer info */}
        <div className="mt-6 text-center text-xs text-slate-400">
          Complies with Legal Metrology (Packaged Commodities) Rules, 2011 &amp; FSSAI Standards
        </div>
      </div>
    </div>
  );
}
