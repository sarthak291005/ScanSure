"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Button,
  Card,
  Icon,
  ICONS,
  Badge,
  EmptyState,
  cx,
  ScoreRing,
  ResultBadge,
} from "@/components/ui";
import { PageHeader } from "@/components/shell";
import { useToast } from "@/components/toast";
import { Product, timeAgo } from "@/lib/types";
import { OCR_STAGES } from "@/lib/ocr";

/* ---------------- types ---------------- */

type Stage =
  | "upload"
  | "preview"
  | "processing"
  | "extracted"
  | "evaluation"
  | "evidence"
  | "manual"
  | "report";

const STAGES: { id: Stage; num: number; label: string; mode: string }[] = [
  { id: "upload", num: 1, label: "Upload / Capture", mode: "UPLOAD" },
  { id: "preview", num: 2, label: "Image Preview", mode: "PREVIEW" },
  { id: "processing", num: 3, label: "Processing", mode: "OCR RUN" },
  { id: "extracted", num: 4, label: "Extracted Info", mode: "EXTRACTION" },
  { id: "evaluation", num: 5, label: "Compliance Eval", mode: "EVALUATION" },
  { id: "evidence", num: 6, label: "Evidence Viewer", mode: "EVIDENCE" },
  { id: "manual", num: 7, label: "Manual Verify", mode: "INSPECTOR" },
  { id: "report", num: 8, label: "Final Report", mode: "REPORT" },
];

type Region = {
  id: string;
  field: string;
  ruleCode: string;
  x: number;
  y: number;
  w: number;
  h: number;
  confidence: number;
  found: boolean;
  side: "front" | "back";
};

type EngineFinding = {
  ruleCode: string;
  status: "pass" | "fail" | "warning" | "not_applicable";
  detail: string;
  evidence: string;
};

type ScanData = {
  scanId: string;
  verificationId: string | null;
  detectedProductName: string | null;
  detectedCategory: string | null;
  categoryConfidence: number | null;
  imageUrl: string;
  backImageUrl: string;
  panels: 1 | 2;
  extracted: Record<string, string | null>;
  confidence: number;
  regions: Region[];
  findings: EngineFinding[];
  result: "compliant" | "non_compliant" | "needs_review";
  score: number;
  passed: number;
  failed: number;
  warnings: number;
  summary: string;
};

type HistoryItem = {
  id: string;
  result: "compliant" | "non_compliant" | "needs_review";
  score: number;
  productName: string;
  createdAt: string;
};

const FIELD_LABELS: Record<string, string> = {
  brand: "Brand / Article",
  netWeight: "Net Quantity",
  manufacturer: "Manufacturer",
  address: "Address",
  mfgDate: "Mfg Date",
  bestBefore: "Best Before",
  mrp: "MRP",
  licence: "FSSAI Licence",
  countryOfOrigin: "Country of Origin",
};

const REGION_LAYOUT: Record<string, { x: number; y: number; w: number; h: number; rule: string }> = {
  brand: { x: 0.28, y: 0.05, w: 0.44, h: 0.11, rule: "LM-009" },
  manufacturer: { x: 0.07, y: 0.54, w: 0.42, h: 0.07, rule: "LM-003" },
  address: { x: 0.07, y: 0.63, w: 0.46, h: 0.07, rule: "LM-003" },
  mfgDate: { x: 0.55, y: 0.54, w: 0.31, h: 0.07, rule: "LM-004" },
  bestBefore: { x: 0.55, y: 0.63, w: 0.33, h: 0.07, rule: "LM-005" },
  netWeight: { x: 0.05, y: 0.76, w: 0.25, h: 0.1, rule: "LM-001" },
  mrp: { x: 0.66, y: 0.74, w: 0.28, h: 0.11, rule: "LM-007" },
  licence: { x: 0.05, y: 0.89, w: 0.36, h: 0.07, rule: "LM-008" },
  countryOfOrigin: { x: 0.44, y: 0.89, w: 0.28, h: 0.07, rule: "LM-006" },
};

const BOX_COLORS: Record<string, string> = {
  pass: "#34d399",
  warning: "#fbbf24",
  fail: "#f87171",
  not_applicable: "#94a3b8",
  missing: "#fb7185",
};

const FRONT_FIELDS = new Set(["brand", "netWeight", "mrp", "countryOfOrigin"]);

function genPreviewRegions(p: Product, panels: 1 | 2 = 1): Region[] {
  const seed = p.name.length + (p.mfgDate.charCodeAt(5) ?? 7);
  const rand = (n: number) => ((seed * 31 + n * 17) % 100) / 100;
  const clamp01 = (v: number) => Math.min(0.97, Math.max(0.03, v));
  return Object.entries(REGION_LAYOUT).map(([field, l], i) => ({
    id: `rg-${field}`,
    field,
    ruleCode: l.rule,
    x: clamp01(l.x + (rand(i + 11) - 0.5) * 0.05),
    y: clamp01(l.y + (rand(i + 21) - 0.5) * 0.04),
    w: l.w,
    h: l.h,
    confidence: 90,
    found: true,
    side: panels === 2 ? (FRONT_FIELDS.has(field) ? "front" : "back") : "front",
  }));
}

function hexA(hex: string, a: number) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${a})`;
}

type Override = { action: "confirm" | "false_positive" | "dispute"; note: string };

function effectiveStatus(f: EngineFinding, o?: Override): EngineFinding["status"] {
  if (!o || o.action === "confirm") return f.status;
  if (o.action === "false_positive")
    return f.status === "pass" || f.status === "not_applicable" ? f.status : "pass";
  if (o.action === "dispute") return f.status === "pass" ? "fail" : f.status;
  return f.status;
}

/* ---------------- component ---------------- */

export function ScannerClient() {
  const toast = useToast();
  const [products, setProducts] = useState<Product[]>([]);
  const [productId, setProductId] = useState<string>("");
  const [detectedProductName, setDetectedProductName] = useState<string | null>(null);
  const [detectedCategory, setDetectedCategory] = useState<string | null>(null);
  const [categoryConfidence, setCategoryConfidence] = useState<number | null>(null);
  const [file, setFile] = useState<string | null>(null);
  const [fileMeta, setFileMeta] = useState<{ name: string; size: number } | null>(null);
  const [backFile, setBackFile] = useState<string | null>(null);
  const [backFileMeta, setBackFileMeta] = useState<{ name: string; size: number } | null>(null);
  const [canvasSide, setCanvasSide] = useState<"front" | "back">("front");
  const [dragOver, setDragOver] = useState(false);

  const [stage, setStage] = useState<Stage>("upload");
  const [farthest, setFarthest] = useState(1);
  const [stageIdx, setStageIdx] = useState(0);
  const [data, setData] = useState<ScanData | null>(null);
  const [previewRegions, setPreviewRegions] = useState<Region[]>([]);
  const [revealCount, setRevealCount] = useState(0);

  const [overrides, setOverrides] = useState<Record<string, Override>>({});
  const [selectedRule, setSelectedRule] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [origin, setOrigin] = useState({ x: 50, y: 50 });

  const [history, setHistory] = useState<HistoryItem[]>([]);

  const fileRef = useRef<HTMLInputElement>(null);
  const backFileRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [cameraOn, setCameraOn] = useState(false);
  const [cameraStarting, setCameraStarting] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);

  const selected = useMemo(
    () => products.find((p) => p.id === productId),
    [products, productId],
  );

  useEffect(() => {
    fetch("/api/products")
      .then((r) => r.json())
      .then((d) => {
        setProducts(d.products ?? []);
      })
      .finally(() => {});
    fetch("/api/verifications")
      .then((r) => r.json())
      .then((d) =>
        setHistory(
          (d.verifications ?? []).slice(0, 8).map((v: any) => ({
            id: v.id,
            result: v.result,
            score: v.score,
            productName: v.productName,
            createdAt: v.createdAt,
          })),
        ),
      )
      .catch(() => {});
  }, []);

  /* ---------- camera ---------- */
  const stopCamera = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setCameraOn(false);
  };
  const startCamera = async () => {
    setCameraError(null);
    setCameraStarting(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }
      setCameraOn(true);
    } catch (err: any) {
      setCameraError(
        err?.name === "NotAllowedError"
          ? "Camera permission denied. Allow access in your browser — or upload a photo instead."
          : err?.name === "NotFoundError"
            ? "No camera device found. Upload a label photo instead."
            : "Could not start the camera. Upload a label photo instead.",
      );
    } finally {
      setCameraStarting(false);
    }
  };
  const captureFrame = () => {
    const video = videoRef.current;
    if (!video || video.videoWidth === 0) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d")?.drawImage(video, 0, 0);
    const url = canvas.toDataURL("image/jpeg", 0.92);
    setFile(url);
    setFileMeta({ name: "Live camera capture", size: 0 });
    toast("success", "Label frame captured from live camera");
  };
  useEffect(
    () => () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
    },
    [],
  );

  /* ---------- file ---------- */
  const onFile = (f: File | null) => {
    if (!f) return;
    if (!f.type.startsWith("image/")) {
      toast("error", "Please choose an image file (JPG/PNG)");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setFile(reader.result as string);
      setFileMeta({
        name: f.name,
        size: f.size,
      });
    };
    reader.readAsDataURL(f);
    toast("success", `Image loaded: ${f.name}`);
  };

  const clearFile = () => {
    setFile(null);
    setFileMeta(null);
  };

  const onBackFile = (f: File | null) => {
    if (!f) return;
    if (!f.type.startsWith("image/")) {
      toast("error", "Please choose an image file (JPG/PNG)");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setBackFile(reader.result as string);
      setBackFileMeta({ name: f.name, size: f.size });
    };
    reader.readAsDataURL(f);
    toast("success", `Back panel added: ${f.name}`);
  };

  const clearBackFile = () => {
    setBackFile(null);
    setBackFileMeta(null);
  };

  /* ---------- stage navigation ---------- */
  const go = (s: Stage) => {
    const idx = STAGES.findIndex((x) => x.id === s);
    if (idx > farthest) return;
    setStage(s);
    if (s === "upload" || s === "preview") {
      setSelectedRule(null);
      setZoom(1);
      setOrigin({ x: 50, y: 50 });
      setRevealCount(0);
    }
    if (s === "evidence" && data && !selectedRule && data.findings.length) {
      setSelectedRule(data.findings[0].ruleCode);
      zoomTo(data.findings[0].ruleCode);
    }
  };

  const zoomTo = (ruleCode: string) => {
    const regions = data?.regions ?? previewRegions;
    const r = regions.find((x) => x.ruleCode === ruleCode);
    if (!r) return;
    setOrigin({ x: (r.x + r.w / 2) * 100, y: (r.y + r.h / 2) * 100 });
    setZoom(3);
  };

  /* ---------- pipeline ---------- */
  const startScan = async () => {
    if (!file) return;
    const panels: 1 | 2 = backFile ? 2 : 1;
    setData(null);
    setOverrides({});
    setSelectedRule(null);
    setRevealCount(0);
    setCanvasSide("front");
    setPreviewRegions([]);
    setStage("processing");
    setStageIdx(0);

    const api = fetch("/api/scans", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        productId: selected?.id,
        image: file ?? undefined,
        backImage: backFile ?? undefined,
      }),
    })
      .then((r) => r.json())
      .catch(() => null);

    // staged animation
    for (let i = 0; i < OCR_STAGES.length; i++) {
      setStageIdx(i);
      setRevealCount(0);
      await new Promise((r) => setTimeout(r, 420));
    }
    setRevealCount(0);

    const res = await api;
    if (!res?.verification) {
      setStage("upload");
      toast("error", "Scan failed — please try again");
      return;
    }
    const v = res.verification;
    // resolve the persisted verification id for the reports deep-link
    let verificationId: string | null = null;
    try {
      const rep = await fetch(`/api/scans/${res.scan.id}/verify`).then((r) =>
        r.ok ? r.json() : null,
      );
      verificationId = rep?.verification?.id ?? null;
    } catch {
      verificationId = null;
    }
    setData({
      scanId: res.scan.id,
      verificationId,
      detectedProductName: res.scan.detectedProductName ?? null,
      detectedCategory: res.scan.detectedCategory ?? null,
      categoryConfidence: res.scan.categoryConfidence ?? null,
      imageUrl: res.scan.imageUrl || file || selected?.imageUrl || "",
      backImageUrl: res.scan.backImageUrl || backFile || selected?.imageUrl || "",
      panels: res.scan.panels ?? panels,
      extracted: v.extracted,
      confidence: v.confidence,
      regions: v.regions ?? [],
      findings: v.findings,
      result: v.result,
      score: v.score,
      passed: v.passed,
      failed: v.failed,
      warnings: v.warnings,
      summary: v.summary,
    });
    // scan data is complete — unlock the remaining stages
    setFarthest(7);
    setStage("extracted");
    toast(
      v.result === "compliant" ? "success" : v.result === "non_compliant" ? "error" : "info",
      v.result === "compliant"
        ? "Label verified — compliant"
        : v.result === "non_compliant"
          ? "Violations detected — review the report"
          : "Scan complete — review recommended",
    );
    // refresh history
    fetch("/api/verifications")
      .then((r) => r.json())
      .then((d) =>
        setHistory(
          (d.verifications ?? []).slice(0, 8).map((x: any) => ({
            id: x.id,
            result: x.result,
            score: x.score,
            productName: x.productName,
            createdAt: x.createdAt,
          })),
        ),
      )
      .catch(() => {});
  };

  const newScan = () => {
    stopCamera();
    setData(null);
    setOverrides({});
    setSelectedRule(null);
    setRevealCount(0);
    setPreviewRegions([]);
    setFile(null);
    setFileMeta(null);
    setBackFile(null);
    setBackFileMeta(null);
    setCanvasSide("front");
    setFarthest(1);
    setStage("upload");
  };

  /* ---------- recompute with overrides ---------- */
  const final = useMemo(() => {
    if (!data) return null;
    const eff = data.findings.map((f) => ({
      ...f,
      eff: effectiveStatus(f, overrides[f.ruleCode]),
    }));
    const applicable = eff.filter((f) => f.eff !== "not_applicable");
    const passed = applicable.filter((f) => f.eff === "pass").length;
    const failed = applicable.filter((f) => f.eff === "fail").length;
    const warnings = applicable.filter((f) => f.eff === "warning").length;
    const score = Math.round(
      ((passed + warnings * 0.5) / Math.max(1, applicable.length)) * 100,
    );
    const result: ScanData["result"] = data.result;
    return { eff, score, result, passed, failed, warnings };
  }, [data, overrides]);

  /* ---------- boxes ---------- */
  const regions = data?.regions ?? previewRegions;
  const boxMode: "allpass" | "status" =
    stage === "extracted" ? "allpass" : "status";
  const interactive = ["evaluation", "evidence", "manual"].includes(stage);

  const statusFor = (r: Region): string => {
    if (boxMode === "allpass") return r.found ? "pass" : "missing";
    if (stage === "processing") return "pass";
    const f = data?.findings.find((x) => x.ruleCode === r.ruleCode);
    const base = f ? f.status : "not_applicable";
    const eff = effectiveStatus(f ?? { ruleCode: r.ruleCode, status: base, detail: "", evidence: "" }, overrides[r.ruleCode]);
    return r.found ? eff : "missing";
  };

  // Two-panel scans: show only the boxes belonging to the active side
  const twoPanels = (data?.panels ?? 0) === 2 || !!backFile;
  let visibleRegions =
    stage === "processing" ? regions.slice(0, revealCount) : regions;
  if (twoPanels) {
    visibleRegions = visibleRegions.filter((r) => r.side === canvasSide);
  }

  // Which image the canvas shows (respects the Front/Back toggle)
  const canvasImage = twoPanels
    ? canvasSide === "back"
      ? data?.backImageUrl || backFile || data?.imageUrl || file || selected?.imageUrl || "/images/label-2.jpg"
      : data?.imageUrl || file || selected?.imageUrl || "/images/label-1.jpg"
    : data?.imageUrl || file || selected?.imageUrl || "/images/label-1.jpg";

  /* ---------- render ---------- */
  const stageMeta = STAGES.find((s) => s.id === stage)!;

  return (
    <>
      <PageHeader
        title="AI Label Scanner"
        subtitle="8-stage pipeline · live OCR bounding boxes · forensic evidence · inspector verification"
      />

      {/* Stepper */}
      <Card className="mb-5 p-4">
        <div className="flex items-center gap-1 overflow-x-auto pb-1">
          {STAGES.map((s, i) => {
            const currentIdx = STAGES.findIndex((x) => x.id === stage);
            const done = i < currentIdx;
            const active = i === currentIdx;
            const reachable = i <= farthest;
            return (
              <React.Fragment key={s.id}>
                <button
                  onClick={() => reachable && go(s.id)}
                  disabled={!reachable}
                  className={cx(
                    "flex items-center gap-1.5 whitespace-nowrap rounded-lg px-2.5 py-2 text-[11px] font-bold transition",
                    active
                      ? "bg-brand-600 text-white shadow-sm"
                      : done
                        ? "bg-ink-100 text-ink-700 hover:bg-ink-200"
                        : reachable
                          ? "text-ink-500 hover:bg-ink-100"
                          : "cursor-not-allowed text-ink-300",
                  )}
                >
                  <span
                    className={cx(
                      "flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold",
                      active
                        ? "bg-white/25"
                        : done
                          ? "bg-emerald-500 text-white"
                          : "bg-ink-200 text-ink-500",
                    )}
                  >
                    {done ? "✓" : s.num}
                  </span>
                  {s.label}
                </button>
                {i < STAGES.length - 1 && (
                  <span className="h-px w-2.5 shrink-0 bg-ink-200" />
                )}
              </React.Fragment>
            );
          })}
          <span className="ml-auto hidden shrink-0 rounded-full bg-brand-50 px-3 py-1 text-xs font-bold text-brand-700 sm:block">
            Step {STAGES.findIndex((x) => x.id === stage) + 1} of 8
          </span>
        </div>
      </Card>

      <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-12">
        {/* LEFT: canvas + history */}
        <div className="space-y-4 xl:col-span-7">
          <Card className="p-4">
            <div className="mb-3 flex items-center justify-between gap-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-ink-700">
                Label Canvas · Bounding Box View
              </span>
              <div className="flex items-center gap-2">
                {twoPanels && (
                  <div className="flex overflow-hidden rounded-lg border border-ink-200 text-[11px] font-bold">
                    <button
                      onClick={() => setCanvasSide("front")}
                      className={cx(
                        "px-2.5 py-1 transition-colors",
                        canvasSide === "front"
                          ? "bg-ink-950 text-white"
                          : "bg-white text-ink-500 hover:bg-ink-50",
                      )}
                    >
                      Front
                    </button>
                    <button
                      onClick={() => setCanvasSide("back")}
                      className={cx(
                        "px-2.5 py-1 transition-colors",
                        canvasSide === "back"
                          ? "bg-ink-950 text-white"
                          : "bg-white text-ink-500 hover:bg-ink-50",
                      )}
                    >
                      Back
                    </button>
                  </div>
                )}
                <span className="rounded-full bg-ink-100 px-2 py-1 text-[10px] font-bold text-ink-500">
                  {twoPanels ? `${(data?.regions ?? regions).filter((r) => r.side === canvasSide).length} boxes · ${zoom.toFixed(1)}×` : `${zoom.toFixed(1)}×`}
                </span>
              </div>
            </div>

            <div
              className="relative select-none overflow-hidden rounded-xl bg-ink-950"
              style={{ aspectRatio: "4/3" }}
            >
              <div
                className="absolute inset-0"
                style={{
                  transition:
                    "transform .5s cubic-bezier(.22,1,.36,1), transform-origin .5s cubic-bezier(.22,1,.36,1)",
                  transformOrigin: `${origin.x}% ${origin.y}%`,
                  transform: `scale(${zoom})`,
                }}
              >
                <img
                  src={canvasImage}
                  alt="Label"
                  className="absolute inset-0 h-full w-full object-cover"
                  draggable={false}
                />
                {visibleRegions.map((r) => {
                  const status =
                    stage === "processing" ? "reveal" : statusFor(r);
                  const color =
                    status === "reveal" ? "#22d3ee" : BOX_COLORS[status] ?? BOX_COLORS.not_applicable;
                  const dashed = status === "missing" || status === "not_applicable";
                  const sel =
                    selectedRule === r.ruleCode && interactive;
                  return (
                    <div
                      key={r.id}
                      onClick={() => interactive && setSelectedRule(r.ruleCode) && zoomTo(r.ruleCode)}
                      className={cx(
                        "absolute rounded transition-all duration-200",
                        interactive && "cursor-pointer hover:brightness-125 hover:scale-[1.02]",
                      )}
                      style={{
                        left: `${r.x * 100}%`,
                        top: `${r.y * 100}%`,
                        width: `${r.w * 100}%`,
                        height: `${r.h * 100}%`,
                        border: `2px ${dashed ? "dashed" : "solid"} ${color}`,
                        background:
                          status === "missing"
                            ? "rgba(244,63,94,0.10)"
                            : hexA(color, sel ? 0.3 : 0.14),
                        boxShadow: sel
                          ? `0 0 0 3px ${hexA(color, 0.55)}, 0 0 18px 2px ${hexA(color, 0.35)}`
                          : undefined,
                      }}
                    >
                      <span
                        className="absolute left-0 whitespace-nowrap rounded px-1.5 py-0.5 text-[8px] font-bold leading-tight"
                        style={{
                          top: -17,
                          background: color,
                          color:
                            status === "fail" || status === "missing"
                              ? "#fff"
                              : "#0f172a",
                        }}
                      >
                        {(FIELD_LABELS[r.field] || r.field).toUpperCase()}
                        {r.found && status !== "reveal"
                          ? ` · ${r.confidence}%`
                          : r.found
                            ? ""
                            : " · NOT FOUND"}
                      </span>
                    </div>
                  );
                })}
              </div>

              {stage === "processing" && (
                <div className="animate-scan-line absolute left-0 h-[3px] w-full bg-gradient-to-r from-transparent via-brand-300 to-transparent shadow-[0_0_16px_2px_rgba(116,189,174,0.7)]" />
              )}
              <div className="absolute left-2 top-2 rounded-lg bg-ink-950/85 px-2.5 py-1 font-mono text-[10px] text-brand-200 backdrop-blur">
                MODE: {stageMeta.mode}
              </div>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <button
                onClick={() =>
                  setZoom((z) =>
                    Math.max(1, +(z / 1.25).toFixed(2)),
                  )
                }
                className="h-8 w-8 rounded-lg border border-ink-200 font-bold text-ink-600 hover:bg-ink-50"
              >
                −
              </button>
              <button
                onClick={() =>
                  setZoom((z) => Math.min(4, +(z * 1.25).toFixed(2)))
                }
                className="h-8 w-8 rounded-lg border border-ink-200 font-bold text-ink-600 hover:bg-ink-50"
              >
                +
              </button>
              <button
                onClick={() => {
                  setZoom(1);
                  setOrigin({ x: 50, y: 50 });
                }}
                className="h-8 rounded-lg border border-ink-200 px-3 text-xs font-semibold text-ink-600 hover:bg-ink-50"
              >
                Reset view
              </button>
            </div>
            <div className="mt-3 flex flex-wrap gap-3 text-[10px] font-semibold text-ink-500">
              {[
                ["Pass", "border-emerald-400 bg-emerald-400/20"],
                ["Warning", "border-amber-400 bg-amber-400/20"],
                ["Fail", "border-rose-500 bg-rose-500/20"],
                ["Not applicable", "border-dashed border-ink-400"],
                ["Not found", "border-dashed border-rose-500"],
              ].map(([label, cls]) => (
                <span key={label} className="flex items-center gap-1">
                  <span className={cx("h-2.5 w-2.5 rounded-sm border-2", cls)} />
                  {label}
                </span>
              ))}
            </div>
          </Card>

          {/* Scan history */}
          <Card className="p-5">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-bold text-ink-950">Scan History</h3>
              <span className="rounded-full bg-ink-100 px-2 py-0.5 text-[10px] font-bold text-ink-500">
                {history.length}
              </span>
            </div>
            {history.length === 0 ? (
              <p className="py-4 text-center text-xs text-ink-400">
                No scans yet — complete a scan to build your audit trail.
              </p>
            ) : (
              <div className="space-y-2">
                {history.map((h) => (
                  <a
                    key={h.id}
                    href={`/reports?id=${h.id}`}
                    className="flex items-center gap-3 rounded-xl border border-ink-100 bg-ink-50/70 px-3 py-2.5 transition-colors hover:bg-ink-100"
                  >
                    <span
                      className={cx(
                        "flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-extrabold",
                        h.score >= 90
                          ? "bg-emerald-100 text-emerald-700"
                          : h.score >= 70
                            ? "bg-amber-100 text-amber-700"
                            : "bg-rose-100 text-rose-700",
                      )}
                    >
                      {h.score}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-xs font-bold text-ink-800">
                          {h.productName}
                        </span>
                        <ResultBadge result={h.result} />
                      </div>
                      <div className="mt-0.5 text-[10px] text-ink-400">
                        {h.id.slice(0, 8)} · {timeAgo(h.createdAt)}
                      </div>
                    </div>
                    <span className="shrink-0 text-[11px] font-bold text-brand-600">
                      View
                    </span>
                  </a>
                ))}
              </div>
            )}
          </Card>
        </div>

        {/* RIGHT: stage panel */}
        <div className="xl:col-span-5">
          <Card className="overflow-hidden">
            <div className="flex items-center justify-between gap-2 border-b border-ink-100 px-5 py-3.5">
              <h3 className="text-sm font-bold text-ink-950">
                {stageMeta.num} · {stageMeta.label}
              </h3>
              <span className="text-[10px] font-bold text-ink-400">
                {stageMeta.mode}
              </span>
            </div>
            <div className="p-5">
              {/* 1 UPLOAD */}
              {stage === "upload" && (
                <div className="space-y-4">
                  <div>
                    <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-ink-500">
                      Master product (optional)
                    </label>
                   <select
                    className="w-full rounded-xl border border-ink-200 bg-ink-50 px-3 py-2.5 text-sm font-medium focus:border-brand-500 focus:bg-white focus:outline-none"
                    value={productId}
                    onChange={(e) => setProductId(e.target.value)}
                  >
                    <option value="">No reference product — identify from label</option>

                    {products.map((p) => (
                      <option key={p.id} value={p.id}>
                       {p.name} ({p.netQuantity})
                      </option>
                    ))}
                  </select>
                    {selected && (
                      <div className="mt-2 rounded-lg border border-brand-100 bg-brand-50 p-2.5 text-[11px] leading-relaxed text-brand-900">
                        <strong>Master spec:</strong> Net Qty{" "}
                        <b>{selected.netQuantity}</b> · MRP ₹
                        {selected.mrp != null
                          ? (selected.mrp / 100).toFixed(2)
                          : "—"}{" "}
                        · {selected.manufacturerName}
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-ink-500">
                      Label source
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        ["/images/label-1.jpg", "Almonds 500g"],
                        ["/images/label-2.jpg", "Basmati 1kg"],
                        ["/images/label-3.jpg", "Milk 2L"],
                      ].map(([url, label]) => (
                        <button
                          key={url}
                          onClick={() => {
                            setFile(url);
                            setFileMeta({ name: `${label} (sample label)`, size: 0 });
                          }}
                          className={cx(
                            "rounded-lg border p-2 text-[11px] font-semibold transition-colors",
                            file === url
                              ? "border-brand-500 bg-brand-50 text-brand-700"
                              : "border-ink-200 text-ink-700 hover:border-brand-400 hover:bg-brand-50",
                          )}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                    {file ? (
                      <div className="animate-scale-in mt-2 overflow-hidden rounded-xl border border-ink-200">
                        <div className="relative bg-ink-950">
                          <img
                            src={file}
                            alt="Label preview"
                            className="max-h-48 w-full object-contain"
                          />
                          <span className="absolute left-2 top-2 flex items-center gap-1 rounded-full bg-emerald-500/90 px-2 py-0.5 text-[10px] font-bold text-white shadow">
                            <Icon d={ICONS.check} className="h-3 w-3" strokeWidth={3} />
                            Preview ready
                          </span>
                        </div>
                        <div className="flex items-center justify-between gap-2 border-t border-ink-100 bg-white px-3 py-2">
                          <div className="min-w-0">
                            <div className="truncate text-xs font-semibold text-ink-800">
                              {fileMeta?.name ?? "label-image"}
                            </div>
                            {fileMeta && fileMeta.size > 0 && (
                              <div className="text-[10px] text-ink-400">
                                {(fileMeta.size / 1024).toFixed(0)} KB · JPG/PNG
                              </div>
                            )}
                          </div>
                          <div className="flex shrink-0 items-center gap-1.5">
                            <button
                              onClick={() => fileRef.current?.click()}
                              className="pressable rounded-lg border border-ink-200 px-2.5 py-1 text-[11px] font-semibold text-ink-600 hover:bg-ink-50"
                            >
                              Replace
                            </button>
                            <button
                              onClick={clearFile}
                              className="pressable rounded-lg px-2.5 py-1 text-[11px] font-semibold text-rose-600 hover:bg-rose-50"
                            >
                              Remove
                            </button>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div
                        onDragOver={(e) => {
                          e.preventDefault();
                          setDragOver(true);
                        }}
                        onDragLeave={() => setDragOver(false)}
                        onDrop={(e) => {
                          e.preventDefault();
                          setDragOver(false);
                          onFile(e.dataTransfer.files?.[0] ?? null);
                        }}
                        onClick={() => fileRef.current?.click()}
                        className={cx(
                          "mt-2 flex cursor-pointer items-center justify-center gap-2 rounded-lg border-2 border-dashed px-3 py-4 text-xs font-medium transition-colors",
                          dragOver
                            ? "border-brand-500 bg-brand-50 text-brand-700"
                            : "border-ink-200 text-ink-500 hover:border-ink-300 hover:bg-ink-50",
                        )}
                      >
                        <Icon d={ICONS.upload} className="h-4 w-4" />
                        Drop or click to upload label photo
                      </div>
                    )}
                    <input
                      ref={fileRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        onFile(e.target.files?.[0] ?? null);
                        e.target.value = "";
                      }}
                    />
                  </div>

                  {/* Optional back panel */}
                  <div className="rounded-xl border border-dashed border-ink-200 bg-ink-50/50 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-[11px] font-bold uppercase tracking-wider text-ink-500">
                        Back side <span className="normal-case font-medium text-ink-400">(optional)</span>
                      </div>
                      {backFile && (
                        <button
                          onClick={clearBackFile}
                          className="pressable text-[11px] font-semibold text-rose-600 hover:underline"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                    <p className="mt-1 text-[11px] leading-relaxed text-ink-500">
                      A single front <em>or</em> back image verifies all 10 rules. Add the
                      back panel to merge both sides for complete coverage.
                    </p>
                    <div className="mt-2 flex items-center gap-3">
                      {backFile ? (
                        <div className="animate-scale-in flex items-center gap-2 overflow-hidden rounded-lg border border-ink-200 bg-white">
                          <img src={backFile} alt="Back panel" className="h-12 w-12 object-cover" />
                          <span className="max-w-[120px] truncate pr-2 text-[11px] font-semibold text-ink-700">
                            {backFileMeta?.name ?? "back-panel"}
                          </span>
                        </div>
                      ) : (
                        <button
                          onClick={() => backFileRef.current?.click()}
                          className="pressable flex items-center gap-2 rounded-lg border border-ink-200 bg-white px-3 py-2 text-xs font-semibold text-ink-600 hover:border-brand-400 hover:text-brand-700"
                        >
                          <Icon d={ICONS.upload} className="h-4 w-4" />
                          Add back panel
                        </button>
                      )}
                    </div>
                    <input
                      ref={backFileRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        onBackFile(e.target.files?.[0] ?? null);
                        e.target.value = "";
                      }}
                    />
                  </div>

                  {/* Camera */}
                  <div className="space-y-2 rounded-xl border border-ink-200 p-3">
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-ink-500">
                        <Icon d={ICONS.camera} className="h-3.5 w-3.5 text-rose-500" />
                        Live camera
                        {cameraOn && (
                          <span className="flex items-center gap-1 rounded-full bg-rose-50 px-1.5 py-0.5 text-[10px] font-bold text-rose-600">
                            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-rose-500" />
                            LIVE
                          </span>
                        )}
                      </span>
                      <Button
                        variant={cameraOn ? "secondary" : "primary"}
                        className="!px-2.5 !py-1 !text-[11px]"
                        loading={cameraStarting}
                        onClick={cameraOn ? stopCamera : startCamera}
                      >
                        {cameraOn ? "Stop" : "Start camera"}
                      </Button>
                    </div>
                    {cameraError && (
                      <div className="rounded-lg border border-rose-200 bg-rose-50 p-2.5 text-[11px] text-rose-700">
                        {cameraError}
                      </div>
                    )}
                    {cameraOn && (
                      <div className="relative overflow-hidden rounded-lg bg-ink-950">
                        <video
                          ref={videoRef}
                          autoPlay
                          playsInline
                          muted
                          className="aspect-video w-full object-cover"
                        />
                        <div className="animate-scan-line absolute left-[4%] h-[3px] w-[92%] rounded-full bg-gradient-to-r from-transparent via-cyan-300 to-transparent" />
                      </div>
                    )}
                    {cameraOn && (
                      <Button variant="danger" className="w-full !py-2 !text-xs" onClick={captureFrame}>
                        <Icon d={ICONS.camera} className="h-3.5 w-3.5" />
                        Capture label frame
                      </Button>
                    )}
                  </div>

                  <Button className="w-full !py-2.5" onClick={() => go("preview")}>
                    Continue to Preview
                  </Button>
                </div>
              )}

              {/* 2 PREVIEW */}
              {stage === "preview" && (
                <div className="space-y-4">
                  <div className="space-y-1.5 rounded-xl border border-ink-100 bg-ink-50 p-3 text-xs text-ink-600">
                    <div className="flex justify-between gap-2">
                      <span className="text-ink-400">Product</span>
                      <span className="truncate text-right font-bold text-ink-800">
                        {data?.detectedProductName ?? selected?.name ?? "Product not identified"}
                      </span>
                    </div>

                    <div className="flex justify-between gap-2">
                      <span className="text-ink-400">Detected category</span>
                      <span className="text-right font-bold text-ink-800">
                        {data?.detectedCategory
                          ? `${data.detectedCategory} ${
                              data.categoryConfidence != null
                                ? `(${data.categoryConfidence}% confidence)`
                                : ""
                            }`
                          : "—"}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-ink-400">Declared net qty</span>
                      <span className="font-bold text-ink-800">
                        {selected?.netQuantity ?? "—"}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-ink-400">MRP</span>
                      <span className="font-bold text-ink-800">
                        {selected?.mrp != null
                          ? `₹${(selected.mrp / 100).toFixed(2)}`
                          : "—"}
                      </span>
                    </div>
                    <div className="flex justify-between gap-2">
                      <span className="text-ink-400">Manufacturer</span>
                      <span className="truncate text-right font-bold text-ink-800">
                        {selected?.manufacturerName ?? "—"}
                      </span>
                    </div>
                  </div>
                  <p className="rounded-xl border border-brand-100 bg-brand-50 p-3 text-[11px] leading-relaxed text-ink-600">
                    On scan, the AI overlays <strong>bounding boxes</strong> on
                    the canvas around every detected statutory declaration,
                    then evaluates 10 Legal Metrology rules with per-region
                    OCR evidence.
                  </p>
                  <div className="flex gap-2">
                    <Button variant="secondary" className="flex-1 !py-2.5 !text-xs" onClick={() => go("upload")}>
                      Back
                    </Button>
                    <Button className="flex-[2] !py-2.5 !text-xs" onClick={startScan}>
                      <Icon d={ICONS.scanner} className="h-4 w-4" />
                      Start AI Scan
                    </Button>
                  </div>
                </div>
              )}

              {/* 3 PROCESSING */}
              {stage === "processing" && (
                <div className="space-y-4">
                  <div className="h-2.5 w-full overflow-hidden rounded-full bg-ink-100">
                    <div
                      className="h-full rounded-full bg-brand-600 transition-all duration-300"
                      style={{
                        width: `${Math.round(((stageIdx + 1) / OCR_STAGES.length) * 100)}%`,
                      }}
                    />
                  </div>
                  <p className="text-center text-xs font-semibold text-ink-600">
                    {OCR_STAGES[stageIdx]}
                  </p>
                  <div className="space-y-2 text-[11px]">
                    {OCR_STAGES.map((s, i) => (
                      <div
                        key={s}
                        className={cx(
                          "flex items-center gap-2",
                          i < stageIdx
                            ? "text-ink-400 line-through"
                            : i === stageIdx
                              ? "text-ink-700"
                              : "text-ink-400",
                        )}
                      >
                        <span
                          className={cx(
                            "h-2 w-2 shrink-0 rounded-full",
                            i < stageIdx
                              ? "bg-emerald-500"
                              : i === stageIdx
                                ? "animate-pulse bg-brand-600"
                                : "bg-ink-300",
                          )}
                        />
                        {s}
                      </div>
                    ))}
                  </div>
                  <p className="text-center text-[10px] text-ink-400">
                    Bounding boxes appear on the canvas as each region is detected…
                  </p>
                </div>
              )}

              {/* 4 EXTRACTED */}
              {stage === "extracted" && data && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-ink-700">
                      Declarations extracted by OCR
                    </span>
                    <span className="font-bold text-emerald-600">
                      OCR confidence {data.confidence}%
                    </span>
                  </div>
                  <div>
                    {data.regions.map((r) => (
                      <div
                        key={r.id}
                        className="flex items-center gap-2.5 border-b border-ink-100 py-2 last:border-0"
                      >
                        <span
                          className={cx(
                            "h-2 w-2 shrink-0 rounded-full",
                            r.found ? "bg-emerald-500" : "bg-rose-500",
                          )}
                        />
                        <span className="w-28 shrink-0 text-[10px] font-bold uppercase text-ink-500">
                          {FIELD_LABELS[r.field] || r.field}
                        </span>
                        <span className="flex-1 truncate font-mono text-[11px] text-ink-800">
                          {r.found ? data.extracted[r.field] : "NOT DETECTED"}
                        </span>
                        <span className="shrink-0 text-[10px] font-bold text-ink-400">
                          {r.found ? `${r.confidence}%` : "—"}
                        </span>
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <Button variant="secondary" className="flex-1 !py-2.5 !text-xs" onClick={() => go("preview")}>
                      Back
                    </Button>
                    <Button className="flex-[2] !py-2.5 !text-xs" onClick={() => go("evaluation")}>
                      Compliance Evaluation
                    </Button>
                  </div>
                </div>
              )}

              {/* 5 EVALUATION */}
              {stage === "evaluation" && data && final && (
                <div className="space-y-4">
                  <div className="flex items-center gap-4 rounded-xl border border-ink-200 p-4">
                    <ScoreRing score={final.score} size={64} stroke={6} />
                    <div>
                      <ResultBadge result={final.result} />
                      <div className="mt-1.5 text-[11px] text-ink-500">
                        {final.passed} pass · {final.failed} fail ·{" "}
                        {final.warnings} warning
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-2.5">
                    <Icon d={ICONS.check} className="h-4 w-4 shrink-0 text-emerald-600" strokeWidth={3} />
                    <div className="text-[11px] font-semibold text-emerald-800">
                      {data.result === "compliant"
                        ? `All ${data.findings.length} applicable rules verified`
                        : data.result === "non_compliant"
                          ? `${data.failed} rule${data.failed !== 1 ? "s" : ""} require correction`
                          : `${data.warnings} rule${data.warnings !== 1 ? "s" : ""} require manual review`}
                      {data.panels === 2
                        ? " from both front + back panels (merged)"
                        : " from the single scanned image"}
                    </div>
                  </div>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-ink-400">
                    Rule checks · click to locate on canvas
                  </div>
                  <div className="max-h-60 space-y-1.5 overflow-y-auto pr-1">
                    {data.findings.map((f) => (
                      <button
                        key={f.ruleCode}
                        onClick={() => {
                          setSelectedRule(f.ruleCode);
                          zoomTo(f.ruleCode);
                        }}
                        className={cx(
                          "flex w-full items-center gap-2 rounded-lg border px-2.5 py-2 text-left transition-colors",
                          selectedRule === f.ruleCode
                            ? "border-brand-400 bg-brand-50/60"
                            : "border-ink-100 hover:border-brand-300 hover:bg-brand-50/40",
                        )}
                      >
                        <span
                          className={cx(
                            "h-2 w-2 shrink-0 rounded-full",
                            f.status === "pass"
                              ? "bg-emerald-500"
                              : f.status === "fail"
                                ? "bg-rose-500"
                                : f.status === "warning"
                                  ? "bg-amber-500"
                                  : "bg-ink-400",
                          )}
                        />
                        <span className="w-14 shrink-0 font-mono text-[10px] font-bold text-ink-400">
                          {f.ruleCode}
                        </span>
                        <span className="flex-1 truncate text-[11px] font-semibold text-ink-700">
                          {f.detail}
                        </span>
                        <span
                          className={cx(
                            "shrink-0 text-[9px] font-bold uppercase",
                            f.status === "pass"
                              ? "text-emerald-600"
                              : f.status === "fail"
                                ? "text-rose-600"
                                : f.status === "warning"
                                  ? "text-amber-600"
                                  : "text-ink-400",
                          )}
                        >
                          {f.status.replace("_", " ")}
                        </span>
                      </button>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <Button variant="secondary" className="flex-1 !py-2.5 !text-xs" onClick={() => go("extracted")}>
                      Back
                    </Button>
                    <Button className="flex-[2] !py-2.5 !text-xs" onClick={() => go("evidence")}>
                      Open Evidence Viewer
                    </Button>
                  </div>
                </div>
              )}

              {/* 6 EVIDENCE */}
              {stage === "evidence" && data && (
                <div className="space-y-4">
                  <p className="text-[11px] text-ink-500">
                    Select any rule below <strong>or a box on the canvas</strong>{" "}
                    — the view zooms to the exact OCR region with its forensic
                    evidence.
                  </p>
                  <div className="max-h-40 space-y-1.5 overflow-y-auto pr-1">
                    {data.findings.map((f) => (
                      <button
                        key={f.ruleCode}
                        onClick={() => {
                          setSelectedRule(f.ruleCode);
                          zoomTo(f.ruleCode);
                        }}
                        className={cx(
                          "flex w-full items-center gap-2 rounded-lg border px-2.5 py-1.5 text-left transition-colors",
                          selectedRule === f.ruleCode
                            ? "border-brand-400 bg-brand-50/60"
                            : "border-ink-100 hover:border-brand-300",
                        )}
                      >
                        <span
                          className={cx(
                            "h-2 w-2 shrink-0 rounded-full",
                            f.status === "pass"
                              ? "bg-emerald-500"
                              : f.status === "fail"
                                ? "bg-rose-500"
                                : f.status === "warning"
                                  ? "bg-amber-500"
                                  : "bg-ink-400",
                          )}
                        />
                        <span className="w-14 shrink-0 font-mono text-[10px] font-bold text-ink-400">
                          {f.ruleCode}
                        </span>
                        <span className="flex-1 truncate text-[11px] font-semibold text-ink-700">
                          {f.detail}
                        </span>
                      </button>
                    ))}
                  </div>
                  {(() => {
                    const f = data.findings.find(
                      (x) => x.ruleCode === selectedRule,
                    );
                    const region = data.regions.find(
                      (r) => r.ruleCode === selectedRule,
                    );
                    if (!f)
                      return (
                        <p className="py-4 text-center text-xs text-ink-400">
                          Select a rule to inspect its OCR evidence.
                        </p>
                      );
                    return (
                      <div className="space-y-2 rounded-xl border border-ink-200 p-3.5">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-bold text-ink-800">
                            {f.ruleCode}
                          </span>
                          <Badge
                            tone={
                              f.status === "pass"
                                ? "emerald"
                                : f.status === "fail"
                                  ? "rose"
                                  : f.status === "warning"
                                    ? "amber"
                                    : "slate"
                            }
                          >
                            {f.status.replace("_", " ")}
                          </Badge>
                        </div>
                        <p className="text-xs leading-relaxed text-ink-600">
                          {f.detail}
                        </p>
                        <div className="rounded-lg bg-ink-950 p-2.5 font-mono text-[11px] leading-relaxed text-ink-100">
                          <span className="font-bold text-brand-300">
                            OCR EVIDENCE:
                          </span>{" "}
                          {f.evidence}
                        </div>
                        {region && (
                          <div className="flex flex-wrap gap-x-3 text-[10px] font-semibold text-ink-400">
                            <span>
                              Region: {(region.x * 100).toFixed(0)}%,
                              {(region.y * 100).toFixed(0)}% ·{" "}
                              {Math.round(region.w * 100)}×
                              {Math.round(region.h * 100)}%
                            </span>
                            <span>
                              Confidence:{" "}
                              {region.found ? `${region.confidence}%` : "n/a"}
                            </span>
                          </div>
                        )}
                      </div>
                    );
                  })()}
                  <div className="flex gap-2">
                    <Button variant="secondary" className="flex-1 !py-2.5 !text-xs" onClick={() => go("evaluation")}>
                      Back
                    </Button>
                    <Button className="flex-[2] !py-2.5 !text-xs" onClick={() => go("manual")}>
                      Manual Verification
                    </Button>
                  </div>
                </div>
              )}

              {/* 7 MANUAL */}
              {stage === "manual" && data && final && (
                <div className="space-y-4">
                  <p className="text-[11px] text-ink-500">
                    Inspector override — confirm AI findings, mark false
                    positives, or dispute passes before finalizing.
                  </p>
                  <div className="max-h-72 space-y-2.5 overflow-y-auto pr-1">
                    {data.findings.map((f) => {
                      const o = overrides[f.ruleCode];
                      const eff = effectiveStatus(f, o);
                      return (
                        <div
                          key={f.ruleCode}
                          className={cx(
                            "rounded-xl border p-3",
                            o && o.action !== "confirm"
                              ? "border-brand-300 bg-brand-50/50"
                              : "border-ink-100",
                          )}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[11px] font-bold text-ink-700">
                              {f.ruleCode}
                            </span>
                            <Badge
                              tone={
                                eff === "pass"
                                  ? "emerald"
                                  : eff === "fail"
                                    ? "rose"
                                    : eff === "warning"
                                      ? "amber"
                                      : "slate"
                              }
                            >
                              {eff.replace("_", " ")}
                              {o && o.action !== "confirm" ? " · insp" : ""}
                            </Badge>
                          </div>
                          <p className="mt-1 text-[11px] text-ink-500">
                            {f.detail}
                          </p>
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            {(() => {
                              const actions: [Override["action"], string][] = [
                                ["confirm", "✓ AI correct"],
                              ];
                              if (f.status === "fail" || f.status === "warning")
                                actions.push(["false_positive", "↺ False positive"]);
                              if (f.status === "pass")
                                actions.push(["dispute", "⚑ Dispute"]);
                              return actions.map(([action, label]) => (
                              <button
                                key={action}
                                onClick={() =>
                                  setOverrides((prev) => {
                                    const next = { ...prev };
                                    const cur = next[f.ruleCode];
                                    if (cur && cur.action === action) {
                                      delete next[f.ruleCode];
                                    } else {
                                      next[f.ruleCode] = {
                                        action,
                                        note: cur?.note ?? "",
                                      };
                                    }
                                    return next;
                                  })
                                }
                                className={cx(
                                  "rounded-lg border px-2.5 py-1 text-[10px] font-bold transition-colors",
                                  (o?.action ?? "confirm") === action
                                    ? "border-brand-600 bg-brand-600 text-white"
                                    : "border-ink-200 bg-white text-ink-500 hover:border-brand-300 hover:text-brand-600",
                                )}
                              >
                                {label}
                              </button>
                              ))})()}
                          </div>
                          <input
                            value={o?.note ?? ""}
                            onChange={(e) =>
                              setOverrides((prev) => ({
                                ...prev,
                                [f.ruleCode]: {
                                  action: prev[f.ruleCode]?.action ?? "confirm",
                                  note: e.target.value,
                                },
                              }))
                            }
                            placeholder="Inspector note (optional)…"
                            className="mt-2 w-full rounded-lg border border-ink-200 px-2.5 py-1.5 text-[11px] focus:border-brand-400 focus:outline-none"
                          />
                        </div>
                      );
                    })}
                  </div>
                  <div className="flex items-center justify-between rounded-xl bg-ink-950 px-4 py-3 text-white">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-ink-300">
                      Final verdict preview
                    </span>
                    <span className="text-xs font-bold">
                      {final.result.replace("_", " ").toUpperCase()} ·{" "}
                      {final.score}/100
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="secondary" className="flex-1 !py-2.5 !text-xs" onClick={() => go("evidence")}>
                      Back
                    </Button>
                    <Button
                      className="flex-[2] !bg-emerald-600 !py-2.5 !text-xs hover:!bg-emerald-700"
                      onClick={() => {
                        setFarthest(7);
                        go("report");
                      }}
                    >
                      Finalize Report ✓
                    </Button>
                  </div>
                </div>
              )}

              {/* 8 REPORT */}
              {stage === "report" && data && final && (
                <div className="space-y-4">
                  <div
                    className={cx(
                      "rounded-xl border p-4 text-center",
                      final.result === "compliant"
                        ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                        : final.result === "non_compliant"
                          ? "border-rose-200 bg-rose-50 text-rose-800"
                          : "border-amber-200 bg-amber-50 text-amber-800",
                    )}
                  >
                    <div className="text-3xl font-extrabold">
                      {final.score}
                      <span className="text-sm font-bold opacity-50">/100</span>
                    </div>
                    <div className="mt-1 text-sm font-extrabold uppercase tracking-wide">
                      {final.result.replace("_", " ")}
                    </div>
                    <div className="mt-1 text-[11px] opacity-80">
                      {final.passed} pass · {final.failed} fail ·{" "}
                      {final.warnings} warning ·{" "}
                      {Object.values(overrides).filter(
                        (o) => o.action !== "confirm",
                      ).length}{" "}
                      override(s)
                    </div>
                    <div className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-white/60 px-2.5 py-1 text-[10px] font-bold">
  {data.panels === 2
    ? "Front + Back · 2 panels merged"
    : "Single image · manual review required"}
</div>
                  </div>

                  <p className="rounded-xl border border-ink-100 bg-ink-50 p-3 text-xs leading-relaxed text-ink-600">
                    {data.summary}
                    {Object.values(overrides).some((o) => o.action !== "confirm") &&
                      " Inspector overrides applied to the final verdict."}
                  </p>

                  <div className="grid grid-cols-1 gap-2">
                    <Button
                      onClick={() => {
                        window.location.href = data.verificationId
                          ? `/reports?id=${data.verificationId}`
                          : "/reports";
                      }}
                    >
                      <Icon d={ICONS.reports} className="h-4 w-4" />
                      View Full Evidence Report
                    </Button>
                    <Button
                      variant="secondary"
                      onClick={() => {
                        const txt = [
                          "============================================================",
                          `  SCANSURE — LEGAL METROLOGY ${final.result === "compliant" ? "COMPLIANCE CERTIFICATE" : "COMPLIANCE REPORT"}`,
                          "============================================================",
                          `Scan ID        : ${data.scanId}`,
                          "Product SKU    : " + (selected?.name ?? ""),
                          `Verdict        : ${final.result.toUpperCase()} (Score: ${final.score}/100)`,
                          `Pass/Fail      : ${final.passed} Passed / ${final.failed} Failed / ${final.warnings} Warnings`,
                          "",
                          "SUMMARY:",
                          data.summary,
                          "",
                          "FORENSIC RULE-LEVEL FINDINGS:",
                          "------------------------------------------------------------",
                          ...final.eff.map(
                            (f) =>
                              `[${f.eff.toUpperCase()}] ${f.ruleCode} — ${f.detail}\n  Evidence: ${f.evidence}\n`,
                          ),
                          "------------------------------------------------------------",
                          "Verified under Legal Metrology (Packaged Commodities) Rules 2011",
                          "Generated via ScanSure 8-Stage AI Compliance Pipeline",
                        ].join("\n");
                        const blob = new Blob([txt], { type: "text/plain" });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement("a");
                        a.href = url;
                        a.download = `ScanSure-Report-${data.scanId.slice(0, 8)}.txt`;
                        a.click();
                        URL.revokeObjectURL(url);
                        toast("success", "Report downloaded");
                      }}
                    >
                      <Icon d={ICONS.download} className="h-4 w-4" />
                      Download Report (TXT)
                    </Button>
                    <Button variant="ghost" onClick={newScan}>
                      <Icon d={ICONS.plus} className="h-4 w-4" />
                      New Scan
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}
