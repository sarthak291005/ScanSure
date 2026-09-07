"use client";

import React, { useEffect, useRef, useState } from "react";
import type { FindingStatus, Verification } from "@/lib/types";

export function cx(...parts: (string | false | null | undefined)[]) {
  return parts.filter(Boolean).join(" ");
}

/* ---------- Motion hooks ---------- */

export function useCountUp(target: number, duration = 900, delay = 0) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    let raf = 0;
    let start = 0;
    const tick = (t: number) => {
      if (!start) start = t;
      const p = Math.min(1, (t - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setValue(Math.round(target * eased));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    const timer = setTimeout(() => {
      raf = requestAnimationFrame(tick);
    }, delay);
    return () => {
      clearTimeout(timer);
      cancelAnimationFrame(raf);
    };
  }, [target, duration, delay]);
  return value;
}

export function AnimatedNumber({
  value,
  suffix = "",
  prefix = "",
  duration = 900,
  delay = 0,
  className,
}: {
  value: number;
  suffix?: string;
  prefix?: string;
  duration?: number;
  delay?: number;
  className?: string;
}) {
  const v = useCountUp(value, duration, delay);
  return (
    <span className={cx("tabular-nums", className)}>
      {prefix}
      {v.toLocaleString("en-IN")}
      {suffix}
    </span>
  );
}

export function AnimatedBar({
  pct,
  className,
  barClass = "bg-brand-500",
  delay = 0,
}: {
  pct: number;
  className?: string;
  barClass?: string;
  delay?: number;
}) {
  const [w, setW] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => setW(pct), 60 + delay);
    return () => clearTimeout(t);
  }, [pct, delay]);
  return (
    <div className={cx("h-2 overflow-hidden rounded-full bg-ink-100", className)}>
      <div
        className={cx("h-full rounded-full transition-all duration-700 ease-out", barClass)}
        style={{ width: `${w}%` }}
      />
    </div>
  );
}

export function Reveal({
  children,
  delay = 0,
  className,
  as = "div",
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
  as?: "div" | "li" | "tr";
}) {
  const Comp = as as any;
  return (
    <Comp className={cx("animate-fade-up", className)} style={{ animationDelay: `${delay}ms` }}>
      {children}
    </Comp>
  );
}

/* ---------- Icons (stroke, 24 viewBox) ---------- */

export function Icon({
  d,
  className = "h-5 w-5",
  strokeWidth = 1.8,
}: {
  d: string;
  className?: string;
  strokeWidth?: number;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d={d} />
    </svg>
  );
}

export const ICONS = {
  dashboard:
    "M3 12l9-9 9 9M5 10v10a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1V10",
  products:
    "M21 8l-9-5-9 5v8l9 5 9-5V8zM3.3 8.3 12 13l8.7-4.7M12 13v8.5",
  scanner:
    "M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2M3 12h18",
  reports:
    "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zM14 2v6h6M9 13h6M9 17h6",
  rules:
    "M9 12l2 2 4-4M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z",
  logout: "M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9",
  plus: "M12 5v14M5 12h14",
  search: "M21 21l-4.35-4.35M17 11a6 6 0 1 1-12 0 6 6 0 0 1 12 0z",
  trash:
    "M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6M10 11v6M14 11v6",
  edit: "M17 3a2.85 2.85 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z",
  check: "M20 6 9 17l-5-5",
  x: "M18 6 6 18M6 6l12 12",
  alert:
    "M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0zM12 9v4M12 17h.01",
  chevronRight: "m9 18 6-6-6-6",
  eye: "M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7zM15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0z",
  camera:
    "M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2v11zM12 17a4 4 0 1 0 0-8 4 4 0 0 0 0 8z",
  upload: "M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12",
  shield:
    "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10zM9 12l2 2 4-4",
  download: "M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3",
  refresh: "M23 4v6h-6M1 20v-6h6M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15",
  menu: "M4 6h16M4 12h16M4 18h16",
  sparkles:
    "M12 3l1.9 5.7L19.6 10l-5.7 1.9L12 17.6l-1.9-5.7L4.4 10l5.7-1.9L12 3zM19 15l.9 2.6L22.5 18.5l-2.6.9L19 22l-.9-2.6-2.6-.9 2.6-.9L19 15z",
  doc: "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zM14 2v6h6",
  factory:
    "M2 20a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8l-7 5V8l-7 5V4a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v16zM7 18h.01M12 18h.01M17 18h.01",
};

/* ---------- Badge ---------- */

const badgeTones: Record<string, string> = {
  emerald: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  rose: "bg-rose-50 text-rose-700 ring-rose-200",
  amber: "bg-amber-50 text-amber-700 ring-amber-200",
  slate: "bg-ink-100 text-ink-600 ring-ink-200",
  brand: "bg-brand-50 text-brand-700 ring-brand-200",
  violet: "bg-violet-50 text-violet-700 ring-violet-200",
};

export function Badge({
  tone = "slate",
  children,
  className,
}: {
  tone?: keyof typeof badgeTones;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset",
        badgeTones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

export function ResultBadge({ result }: { result: Verification["result"] }) {
  const map = {
    compliant: { tone: "emerald" as const, label: "Compliant" },
    non_compliant: { tone: "rose" as const, label: "Non-compliant" },
    needs_review: { tone: "amber" as const, label: "Needs review" },
  };
  const m = map[result];
  return (
    <Badge tone={m.tone}>
      <span
        className={cx(
          "h-1.5 w-1.5 rounded-full",
          result === "compliant"
            ? "bg-emerald-500"
            : result === "non_compliant"
              ? "bg-rose-500"
              : "bg-amber-500",
        )}
      />
      {m.label}
    </Badge>
  );
}

export function FindingStatusBadge({ status }: { status: FindingStatus }) {
  const map: Record<FindingStatus, { tone: keyof typeof badgeTones; label: string }> = {
    pass: { tone: "emerald", label: "Pass" },
    fail: { tone: "rose", label: "Fail" },
    warning: { tone: "amber", label: "Warning" },
    not_applicable: { tone: "slate", label: "N/A" },
  };
  const m = map[status];
  return <Badge tone={m.tone}>{m.label}</Badge>;
}

/* ---------- Buttons ---------- */

const btnVariants: Record<string, string> = {
  primary:
    "bg-brand-600 text-white hover:bg-brand-700 shadow-sm shadow-brand-600/20 disabled:bg-ink-300",
  secondary:
    "bg-white text-ink-700 ring-1 ring-inset ring-ink-200 hover:bg-ink-50 hover:text-ink-900 disabled:text-ink-400",
  ghost: "text-ink-600 hover:bg-ink-100 hover:text-ink-900",
  danger: "bg-rose-600 text-white hover:bg-rose-700 disabled:bg-ink-300",
};

export function Button({
  variant = "primary",
  loading,
  className,
  children,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: keyof typeof btnVariants;
  loading?: boolean;
}) {
  return (
    <button
      {...rest}
      disabled={rest.disabled || loading}
      className={cx(
        "pressable inline-flex items-center justify-center gap-2 rounded-lg px-3.5 py-2 text-sm font-semibold focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 disabled:cursor-not-allowed disabled:active:scale-100",
        btnVariants[variant],
        className,
      )}
    >
      {loading && (
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
      )}
      {children}
    </button>
  );
}

/* ---------- Card ---------- */

export function Card({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cx(
        "rounded-2xl border border-ink-200/70 bg-white shadow-sm shadow-ink-900/[0.03]",
        className,
      )}
    >
      {children}
    </div>
  );
}

/* ---------- Empty state ---------- */

export function EmptyState({
  icon,
  title,
  message,
  action,
}: {
  icon: string;
  title: string;
  message: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-50 text-brand-500">
        <Icon d={icon} className="h-7 w-7" />
      </div>
      <div>
        <h3 className="text-base font-semibold text-ink-900">{title}</h3>
        <p className="mx-auto mt-1 max-w-sm text-sm text-ink-500">{message}</p>
      </div>
      {action}
    </div>
  );
}

/* ---------- Skeleton ---------- */

export function Skeleton({ className }: { className?: string }) {
  return (
    <div className={cx("shimmer rounded-lg bg-ink-100", className)} />
  );
}

/* ---------- Score ring ---------- */

export function ScoreRing({
  score,
  size = 56,
  stroke = 5,
  tone,
  animate = true,
  delay = 0,
}: {
  score: number;
  size?: number;
  stroke?: number;
  tone?: string;
  animate?: boolean;
  delay?: number;
}) {
  const [shown, setShown] = useState(animate ? 0 : score);
  useEffect(() => {
    if (!animate) return;
    let raf = 0;
    let start = 0;
    const dur = 950;
    const tick = (t: number) => {
      if (!start) start = t;
      const p = Math.min(1, (t - start) / dur);
      const eased = 1 - Math.pow(1 - p, 3);
      setShown(Math.round(score * eased));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    const timer = setTimeout(() => {
      raf = requestAnimationFrame(tick);
    }, delay);
    return () => {
      clearTimeout(timer);
      cancelAnimationFrame(raf);
    };
  }, [score, animate, delay]);

  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const off = c - (shown / 100) * c;
  const color =
    tone ??
    (score >= 85 ? "#059669" : score >= 60 ? "#d97706" : "#e11d48");
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--color-ink-100)"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeDasharray={c}
          strokeDashoffset={off}
          strokeLinecap="round"
          style={{ transition: "stroke-dashoffset 0.1s linear" }}
        />
      </svg>
      <span
        className="absolute inset-0 flex items-center justify-center font-bold tabular-nums text-ink-900"
        style={{ fontSize: size * 0.3 }}
      >
        {shown}
      </span>
    </div>
  );
}

/* ---------- Field wrapper ---------- */

export function Field({
  label,
  hint,
  children,
  required,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
  required?: boolean;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 flex items-baseline justify-between text-sm font-medium text-ink-800">
        <span>
          {label}
          {required && <span className="ml-0.5 text-rose-500">*</span>}
        </span>
        {hint && <span className="text-xs font-normal text-ink-400">{hint}</span>}
      </span>
      {children}
    </label>
  );
}

export const inputCls =
  "w-full rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm text-ink-900 placeholder:text-ink-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 transition";

/* ---------- Modal ---------- */

export function Modal({
  open,
  onClose,
  title,
  children,
  wide,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  wide?: boolean;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4 sm:p-8">
      <div
        className="fixed inset-0 bg-ink-950/40 backdrop-blur-sm"
        onClick={onClose}
      />
      <div
        className={cx(
          "animate-fade-up relative z-10 my-auto w-full rounded-2xl bg-white shadow-2xl",
          wide ? "max-w-2xl" : "max-w-lg",
        )}
      >
        <div className="flex items-center justify-between border-b border-ink-100 px-5 py-4">
          <h2 className="text-base font-semibold text-ink-900">{title}</h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-ink-400 hover:bg-ink-100 hover:text-ink-700"
            aria-label="Close"
          >
            <Icon d={ICONS.x} className="h-4 w-4" />
          </button>
        </div>
        <div className="px-5 py-4">{children}</div>
      </div>
    </div>
  );
}
