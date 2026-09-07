"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Button,
  Card,
  Icon,
  ICONS,
  Badge,
  EmptyState,
  Skeleton,
  Modal,
  Field,
  inputCls,
  cx,
  ResultBadge,
  Reveal,
} from "@/components/ui";
import { PageHeader } from "@/components/shell";
import { useToast } from "@/components/toast";
import {
  Product,
  Verification,
  CATEGORIES,
  formatMRP,
  formatDate,
  timeAgo,
} from "@/lib/types";

type State = {
  products: Product[];
  latest: Record<string, Verification>;
  loading: boolean;
  search: string;
  cat: string;
};

const emptyForm = (today: string) => ({
  name: "",
  category: "food",
  hsnCode: "",
  declaredWeight: "",
  packagingUnit: "g",
  netQuantity: "",
  manufacturerName: "",
  manufacturerAddress: "",
  mfgDate: today,
  expDate: "",
  mfgLicense: "",
  countryOfOrigin: "India",
  mrp: "",
  notes: "",
});

export function ProductsClient() {
  const toast = useToast();
  const [products, setProducts] = useState<Product[]>([]);
  const [latest, setLatest] = useState<Record<string, Verification>>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [cat, setCat] = useState("all");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [deleting, setDeleting] = useState<Product | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(emptyForm(new Date().toISOString().slice(0, 10)));

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      fetch("/api/products").then((r) => r.json()),
      fetch("/api/verifications").then((r) => r.json()),
    ])
      .then(([p, v]) => {
        setProducts(p.products ?? []);
        setLatest(v.latestByProduct ?? {});
      })
      .catch(() => toast("error", "Failed to load products"))
      .finally(() => setLoading(false));
  }, [toast]);

  useEffect(load, [load]);

  const filtered = useMemo(
    () =>
      products.filter((p) => {
        const q = search.toLowerCase();
        const matchQ =
          !q ||
          p.name.toLowerCase().includes(q) ||
          p.manufacturerName.toLowerCase().includes(q) ||
          (p.hsnCode ?? "").toLowerCase().includes(q);
        const matchC = cat === "all" || p.category === cat;
        return matchQ && matchC;
      }),
    [products, search, cat],
  );

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm(new Date().toISOString().slice(0, 10)));
    setModalOpen(true);
  };

  const openEdit = (p: Product) => {
    setEditing(p);
    setForm({
      name: p.name,
      category: p.category,
      hsnCode: p.hsnCode ?? "",
      declaredWeight: p.declaredWeight,
      packagingUnit: p.packagingUnit,
      netQuantity: p.netQuantity,
      manufacturerName: p.manufacturerName,
      manufacturerAddress: p.manufacturerAddress,
      mfgDate: p.mfgDate,
      expDate: p.expDate ?? "",
      mfgLicense: p.mfgLicense ?? "",
      countryOfOrigin: p.countryOfOrigin,
      mrp: p.mrp != null ? String(p.mrp / 100) : "",
      notes: p.notes ?? "",
    });
    setModalOpen(true);
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const payload = {
      ...form,
      hsnCode: form.hsnCode || null,
      expDate: form.expDate || null,
      mfgLicense: form.mfgLicense || null,
      mrp: form.mrp ? Math.round(parseFloat(form.mrp) * 100) : null,
      notes: form.notes || null,
    };
    try {
      const url = editing ? `/api/products/${editing.id}` : "/api/products";
      const res = await fetch(url, {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Save failed");
      toast(
        "success",
        editing ? "Product updated" : "Product added to catalogue",
      );
      setModalOpen(false);
      load();
    } catch (err: any) {
      toast("error", err.message);
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    const target = deleting;
    setDeleting(null);
    // optimistic removal
    setProducts((ps) => ps.filter((p) => p.id !== target.id));
    toast("info", `Removing ${target.name}…`);
    try {
      const res = await fetch(`/api/products/${target.id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Delete failed");
      toast("success", "Product deleted");
    } catch {
      toast("error", "Delete failed — restoring");
      load();
    }
  };

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <>
      <PageHeader
        title="Products"
        subtitle="Your product master — declared values the AI checks every label against"
        action={
          <Button onClick={openCreate}>
            <Icon d={ICONS.plus} className="h-4 w-4" />
            New product
          </Button>
        }
      />

      {/* Filters */}
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Icon
            d={ICONS.search}
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400"
          />
          <input
            className={cx(inputCls, "pl-9")}
            placeholder="Search by name, manufacturer or HSN…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select
          className={cx(inputCls, "sm:w-48")}
          value={cat}
          onChange={(e) => setCat(e.target.value)}
        >
          <option value="all">All categories</option>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c[0].toUpperCase() + c.slice(1)}
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i} className="p-5">
              <Skeleton className="h-5 w-2/3" />
              <Skeleton className="mt-2 h-4 w-1/3" />
              <Skeleton className="mt-6 h-3 w-full" />
              <Skeleton className="mt-2 h-3 w-4/5" />
              <Skeleton className="mt-6 h-8 w-full" />
            </Card>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <EmptyState
            icon={ICONS.products}
            title={search || cat !== "all" ? "No matching products" : "No products yet"}
            message={
              search || cat !== "all"
                ? "Try adjusting your search or category filter."
                : "Add your first product to start scanning labels against its declared values."
            }
            action={
              !search && cat === "all" ? (
                <Button onClick={openCreate}>
                  <Icon d={ICONS.plus} className="h-4 w-4" />
                  Add product
                </Button>
              ) : undefined
            }
          />
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((p, i) => {
            const v = latest[p.id];
            return (
              <Reveal key={p.id} delay={Math.min(i, 8) * 55}>
              <Card
                className="lift flex h-full flex-col p-5"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="truncate text-[15px] font-semibold text-ink-950">
                      {p.name}
                    </h3>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5">
                      <Badge tone="brand">
                        {p.category[0].toUpperCase() + p.category.slice(1)}
                      </Badge>
                      <Badge tone="slate">{p.netQuantity}</Badge>
                      {p.hsnCode && <Badge tone="slate">HSN {p.hsnCode}</Badge>}
                    </div>
                  </div>
                  {v && <ResultBadge result={v.result} />}
                </div>

                <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
                  <div>
                    <dt className="text-ink-400">MRP</dt>
                    <dd className="mt-0.5 font-semibold text-ink-800">
                      {formatMRP(p.mrp)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-ink-400">Mfg date</dt>
                    <dd className="mt-0.5 font-semibold text-ink-800">
                      {formatDate(p.mfgDate)}
                    </dd>
                  </div>
                  <div className="col-span-2">
                    <dt className="text-ink-400">Manufacturer</dt>
                    <dd className="mt-0.5 truncate font-semibold text-ink-800">
                      {p.manufacturerName}
                    </dd>
                  </div>
                </dl>

                <div className="mt-auto flex items-center gap-2 pt-4">
                  <a
                    href={`/scanner?product=${p.id}`}
                    className="pressable inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-brand-50 py-2 text-sm font-semibold text-brand-700 transition-colors hover:bg-brand-100"
                  >
                    <Icon d={ICONS.scanner} className="h-4 w-4" />
                    Scan label
                  </a>
                  <button
                    onClick={() => openEdit(p)}
                    className="pressable rounded-lg p-2 text-ink-400 transition-colors hover:bg-ink-100 hover:text-ink-700"
                    title="Edit"
                  >
                    <Icon d={ICONS.edit} className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => setDeleting(p)}
                    className="pressable rounded-lg p-2 text-ink-400 transition-colors hover:bg-rose-50 hover:text-rose-600"
                    title="Delete"
                  >
                    <Icon d={ICONS.trash} className="h-4 w-4" />
                  </button>
                </div>
              </Card>
              </Reveal>
            );
          })}
        </div>
      )}

      {/* Create / edit modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? "Edit product" : "New product"}
        wide
      >
        <form onSubmit={save} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Field label="Product name" required>
                <input
                  className={inputCls}
                  value={form.name}
                  onChange={(e) => set("name", e.target.value)}
                  required
                  placeholder="Roasted Almonds Premium"
                />
              </Field>
            </div>
            <Field label="Category" required>
              <select
                className={inputCls}
                value={form.category}
                onChange={(e) => set("category", e.target.value)}
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c[0].toUpperCase() + c.slice(1)}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="HSN code" hint="optional">
              <input
                className={inputCls}
                value={form.hsnCode}
                onChange={(e) => set("hsnCode", e.target.value)}
                placeholder="0802"
              />
            </Field>
            <Field label="Declared weight" required>
              <input
                className={inputCls}
                value={form.declaredWeight}
                onChange={(e) => set("declaredWeight", e.target.value)}
                required
                placeholder="500"
              />
            </Field>
            <Field label="Unit" required>
              <select
                className={inputCls}
                value={form.packagingUnit}
                onChange={(e) => set("packagingUnit", e.target.value)}
              >
                {["g", "kg", "mg", "L", "ml", "pcs"].map((u) => (
                  <option key={u} value={u}>
                    {u}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Net quantity (as printed)" required>
              <input
                className={inputCls}
                value={form.netQuantity}
                onChange={(e) => set("netQuantity", e.target.value)}
                required
                placeholder="500 g"
              />
            </Field>
            <Field label="MRP (₹, incl. taxes)">
              <input
                className={inputCls}
                type="number"
                min="0"
                step="0.01"
                value={form.mrp}
                onChange={(e) => set("mrp", e.target.value)}
                placeholder="899.00"
              />
            </Field>
            <div className="sm:col-span-2">
              <Field label="Manufacturer / packer / importer" required>
                <input
                  className={inputCls}
                  value={form.manufacturerName}
                  onChange={(e) => set("manufacturerName", e.target.value)}
                  required
                  placeholder="SpiceWala Foods Pvt Ltd"
                />
              </Field>
            </div>
            <div className="sm:col-span-2">
              <Field label="Complete address (with PIN code)" required>
                <textarea
                  className={cx(inputCls, "min-h-[70px] resize-y")}
                  value={form.manufacturerAddress}
                  onChange={(e) => set("manufacturerAddress", e.target.value)}
                  required
                  placeholder="B-14, Okhla Industrial Area Phase II, New Delhi 110020"
                />
              </Field>
            </div>
            <Field label="Mfg. licence (FSSAI etc.)" hint="14-digit">
              <input
                className={inputCls}
                value={form.mfgLicense}
                onChange={(e) => set("mfgLicense", e.target.value)}
                placeholder="10023456789123"
              />
            </Field>
            <Field label="Country of origin" required>
              <input
                className={inputCls}
                value={form.countryOfOrigin}
                onChange={(e) => set("countryOfOrigin", e.target.value)}
                required
              />
            </Field>
            <Field label="Date of manufacture" required>
              <input
                type="date"
                className={inputCls}
                value={form.mfgDate}
                onChange={(e) => set("mfgDate", e.target.value)}
                required
              />
            </Field>
            <Field label="Best before / expiry" hint="perishables">
              <input
                type="date"
                className={inputCls}
                value={form.expDate}
                onChange={(e) => set("expDate", e.target.value)}
              />
            </Field>
            <div className="sm:col-span-2">
              <Field label="Notes" hint="optional">
                <textarea
                  className={cx(inputCls, "min-h-[56px] resize-y")}
                  value={form.notes}
                  onChange={(e) => set("notes", e.target.value)}
                  placeholder="Internal notes…"
                />
              </Field>
            </div>
          </div>
          <div className="flex justify-end gap-2 border-t border-ink-100 pt-4">
            <Button type="button" variant="secondary" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={saving}>
              {editing ? "Save changes" : "Add product"}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Delete confirm */}
      <Modal
        open={!!deleting}
        onClose={() => setDeleting(null)}
        title="Delete product?"
      >
        <p className="text-sm text-ink-600">
          <span className="font-semibold text-ink-900">{deleting?.name}</span>{" "}
          will be removed along with its scans and inspection reports. This
          cannot be undone.
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setDeleting(null)}>
            Cancel
          </Button>
          <Button variant="danger" onClick={confirmDelete}>
            <Icon d={ICONS.trash} className="h-4 w-4" />
            Delete
          </Button>
        </div>
      </Modal>
    </>
  );
}
