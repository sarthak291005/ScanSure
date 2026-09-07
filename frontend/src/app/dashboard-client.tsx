"use client";

import React, { useEffect, useState } from "react";
import {
  Card,
  Icon,
  ICONS,
  Skeleton,
  ResultBadge,
  ScoreRing,
  EmptyState,
  Button,
  AnimatedNumber,
  AnimatedBar,
  Reveal,
} from "@/components/ui";
import { PageHeader } from "@/components/shell";
import { useAppUser } from "./providers";
import { timeAgo, formatDate } from "@/lib/types";

type Dash = {
  counts: { products: number; scans: number; verifications: number };
  byResult: Record<string, number>;
  byStatus: Record<string, number>;
  recent: {
    id: string;
    result: "compliant" | "non_compliant" | "needs_review";
    score: number;
    createdAt: string;
    productName: string;
    productId: string;
  }[];
  avgComplianceScore: number | null;
};

export function DashboardClient() {
  const user = useAppUser();
  const [data, setData] = useState<Dash | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    fetch("/api/dashboard")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("Failed"))))
      .then(setData)
      .catch(() => setError("Could not load dashboard data."))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const stats = data
    ? [
        {
          label: "Products tracked",
          num: data.counts.products,
          suffix: "",
          icon: ICONS.products,
          tone: "text-brand-600 bg-brand-50",
          href: "/products",
        },
        {
          label: "Labels scanned",
          num: data.counts.scans,
          suffix: "",
          icon: ICONS.scanner,
          tone: "text-violet-600 bg-violet-50",
          href: "/scanner",
        },
        {
          label: "Inspection reports",
          num: data.counts.verifications,
          suffix: "",
          icon: ICONS.reports,
          tone: "text-amber-600 bg-amber-50",
          href: "/reports",
        },
        {
          label: "Avg compliance score",
          num: data.avgComplianceScore ?? 0,
          suffix: data.avgComplianceScore != null ? "%" : "",
          icon: ICONS.shield,
          tone: "text-emerald-600 bg-emerald-50",
          href: "/reports",
        },
      ]
    : [];

  const totalChecks = data
    ? Object.values(data.byStatus).reduce((a, b) => a + b, 0)
    : 0;

  return (
    <>
      <PageHeader
        title={`Welcome back, ${user?.name.split(" ")[0] ?? "there"}`}
        subtitle={`${user?.company ?? "Your workspace"} · Legal Metrology compliance at a glance`}
        action={
          <Button onClick={() => (window.location.href = "/scanner")}>
            <Icon d={ICONS.scanner} className="h-4 w-4" />
            Scan a label
          </Button>
        }
      />

      {/* Stat cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {loading || error
          ? Array.from({ length: 4 }).map((_, i) => (
              <Card key={i} className="p-5">
                <Skeleton className="h-10 w-16" />
                <Skeleton className="mt-3 h-4 w-24" />
              </Card>
            ))
          : stats.map((s, i) => (
              <Reveal key={s.label} delay={i * 70}>
                <a href={s.href} className="group block">
                  <Card className="lift p-5">
                    <div className="flex items-start justify-between">
                      <div
                        className={`flex h-10 w-10 items-center justify-center rounded-xl transition-transform duration-300 group-hover:scale-110 ${s.tone}`}
                      >
                        <Icon d={s.icon} className="h-5 w-5" />
                      </div>
                      <Icon
                        d={ICONS.chevronRight}
                        className="h-4 w-4 -translate-x-1 text-ink-300 opacity-0 transition-all duration-300 group-hover:translate-x-0 group-hover:opacity-100 group-hover:text-ink-500"
                      />
                    </div>
                    <div className="mt-4 text-3xl font-bold tracking-tight text-ink-950">
                      <AnimatedNumber
                        value={s.num}
                        suffix={s.suffix}
                        delay={i * 70}
                      />
                    </div>
                    <div className="mt-0.5 text-sm font-medium text-ink-500">
                      {s.label}
                    </div>
                  </Card>
                </a>
              </Reveal>
            ))}
      </div>

      {error && (
        <Card className="mt-6 border-rose-200 bg-rose-50 p-4 text-sm font-medium text-rose-700">
          {error}
        </Card>
      )}

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-5">
        {/* Recent verifications */}
        <Card className="lg:col-span-3">
          <div className="flex items-center justify-between border-b border-ink-100 px-5 py-4">
            <h2 className="text-sm font-semibold text-ink-900">
              Recent inspections
            </h2>
            <a
              href="/reports"
              className="text-xs font-semibold text-brand-600 hover:text-brand-700"
            >
              View all
            </a>
          </div>
          {loading ? (
            <div className="space-y-3 p-5">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : data && data.recent.length > 0 ? (
            <ul className="divide-y divide-ink-100">
              {data.recent.map((r, i) => (
                <li key={r.id}>
                  <a
                    href={`/reports?id=${r.id}`}
                    className="group flex items-center gap-4 px-5 py-3.5 transition-colors hover:bg-ink-50"
                  >
                    <div className="transition-transform duration-300 group-hover:scale-110">
                      <ScoreRing score={r.score} size={44} stroke={4} delay={i * 90} />
                    </div>
                    <div className="min-w-0 flex-1 animate-fade-up" style={{ animationDelay: `${i * 70 + 100}ms` }}>
                      <div className="flex items-center gap-2">
                        <span className="truncate text-sm font-semibold text-ink-900 transition-colors group-hover:text-brand-700">
                          {r.productName}
                        </span>
                      </div>
                      <div className="text-xs text-ink-400">
                        {timeAgo(r.createdAt)}
                      </div>
                    </div>
                    <ResultBadge result={r.result} />
                    <Icon
                      d={ICONS.chevronRight}
                      className="h-4 w-4 -translate-x-1 text-ink-300 opacity-0 transition-all duration-300 group-hover:translate-x-0 group-hover:opacity-100"
                    />
                  </a>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState
              icon={ICONS.reports}
              title="No inspections yet"
              message="Scan your first product label to generate an evidence-backed compliance report."
              action={
                <Button
                  variant="secondary"
                  onClick={() => (window.location.href = "/scanner")}
                >
                  <Icon d={ICONS.scanner} className="h-4 w-4" />
                  Open scanner
                </Button>
              }
            />
          )}
        </Card>

        {/* Compliance breakdown */}
        <Card className="lg:col-span-2">
          <div className="border-b border-ink-100 px-5 py-4">
            <h2 className="text-sm font-semibold text-ink-900">
              Rule checks breakdown
            </h2>
            <p className="mt-0.5 text-xs text-ink-400">
              All checks across {totalChecks} findings
            </p>
          </div>
          <div className="space-y-4 p-5">
            {loading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-9 w-full" />
              ))
            ) : (
              <>
                {[
                  {
                    key: "compliant",
                    label: "Compliant",
                    n: data?.byResult?.compliant ?? 0,
                    color: "bg-emerald-500",
                    text: "text-emerald-600",
                  },
                  {
                    key: "non_compliant",
                    label: "Non-compliant",
                    n: data?.byResult?.non_compliant ?? 0,
                    color: "bg-rose-500",
                    text: "text-rose-600",
                  },
                  {
                    key: "needs_review",
                    label: "Needs review",
                    n: data?.byResult?.needs_review ?? 0,
                    color: "bg-amber-500",
                    text: "text-amber-600",
                  },
                ].map((row) => {
                  const total =
                    (data?.byResult?.compliant ?? 0) +
                    (data?.byResult?.non_compliant ?? 0) +
                    (data?.byResult?.needs_review ?? 0);
                   const pct = total ? Math.round((row.n / total) * 100) : 0;
                   return (
                    <div key={row.key}>
                      <div className="mb-1.5 flex items-center justify-between text-sm">
                        <span className="font-medium text-ink-700">
                          {row.label}
                        </span>
                        <span className={`font-bold tabular-nums ${row.text}`}>
                          <AnimatedNumber value={row.n} delay={200} />
                        </span>
                      </div>
                      <AnimatedBar pct={pct} barClass={row.color} delay={250} />
                    </div>
                  );
                })}

                <div className="border-t border-ink-100 pt-4">
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="rounded-xl bg-emerald-50 p-3 transition-transform duration-300 hover:-translate-y-0.5">
                      <div className="text-lg font-bold text-emerald-600">
                        <AnimatedNumber value={data?.byStatus?.pass ?? 0} delay={300} />
                      </div>
                      <div className="text-[11px] font-medium text-emerald-700/70">
                        Passed
                      </div>
                    </div>
                    <div className="rounded-xl bg-rose-50 p-3 transition-transform duration-300 hover:-translate-y-0.5">
                      <div className="text-lg font-bold text-rose-600">
                        <AnimatedNumber value={data?.byStatus?.fail ?? 0} delay={400} />
                      </div>
                      <div className="text-[11px] font-medium text-rose-700/70">
                        Failed
                      </div>
                    </div>
                    <div className="rounded-xl bg-amber-50 p-3 transition-transform duration-300 hover:-translate-y-0.5">
                      <div className="text-lg font-bold text-amber-600">
                        <AnimatedNumber value={data?.byStatus?.warning ?? 0} delay={500} />
                      </div>
                      <div className="text-[11px] font-medium text-amber-700/70">
                        Warnings
                      </div>
                    </div>
                  </div>
                </div>

                <a
                  href="/rules"
                  className="flex items-center justify-center gap-1.5 rounded-lg border border-ink-200 py-2 text-sm font-semibold text-ink-600 transition-colors hover:bg-ink-50 hover:text-ink-900"
                >
                  Manage rule library
                  <Icon d={ICONS.chevronRight} className="h-3.5 w-3.5" />
                </a>
              </>
            )}
          </div>
        </Card>
      </div>

      <div className="mt-6">
        <QuickLinks />
      </div>
    </>
  );
}

function QuickLinks() {
  const items = [
    {
      title: "Add a product",
      desc: "Register a SKU with declared pack size, MRP and manufacturer details.",
      icon: ICONS.plus,
      href: "/products?new=1",
    },
    {
      title: "Run a label scan",
      desc: "Upload a label photo — AI extracts declarations and checks 10 LM rules.",
      icon: ICONS.camera,
      href: "/scanner",
    },
    {
      title: "Issue a certificate",
      desc: "Download an evidence-backed inspection report for marketplaces.",
      icon: ICONS.download,
      href: "/reports",
    },
  ];
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      {items.map((it) => (
        <a key={it.title} href={it.href} className="group">
          <Card className="flex h-full items-start gap-4 p-5 transition-all group-hover:-translate-y-0.5 group-hover:shadow-md">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-ink-100 text-ink-600 transition-colors group-hover:bg-brand-600 group-hover:text-white">
              <Icon d={it.icon} className="h-5 w-5" />
            </div>
            <div>
              <div className="text-sm font-semibold text-ink-900">
                {it.title}
              </div>
              <div className="mt-0.5 text-xs leading-relaxed text-ink-500">
                {it.desc}
              </div>
            </div>
          </Card>
        </a>
      ))}
    </div>
  );
}
