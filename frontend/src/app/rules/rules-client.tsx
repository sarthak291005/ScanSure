"use client";

import React, { useCallback, useEffect, useState } from "react";
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
} from "@/components/ui";
import { PageHeader } from "@/components/shell";
import { useToast } from "@/components/toast";
import { Rule, SEVERITY_LABEL } from "@/lib/types";

const emptyForm = {
  code: "",
  title: "",
  description: "",
  legalReference: "",
  category: "Declaration",
  severity: "major" as "critical" | "major" | "minor",
  applicableTo: "all",
  active: true,
};

const SEV_TONE: Record<string, "rose" | "amber" | "slate"> = {
  critical: "rose",
  major: "amber",
  minor: "slate",
};

export function RulesClient() {
  const toast = useToast();
  const [rules, setRules] = useState<Rule[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Rule | null>(null);
  const [deleting, setDeleting] = useState<Rule | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [openRow, setOpenRow] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    fetch("/api/rules")
      .then((r) => r.json())
      .then((d) => setRules(d.rules ?? []))
      .catch(() => toast("error", "Failed to load rules"))
      .finally(() => setLoading(false));
  }, [toast]);

  useEffect(load, [load]);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setModalOpen(true);
  };

  const openEdit = (r: Rule) => {
    setEditing(r);
    setForm({
      code: r.code,
      title: r.title,
      description: r.description,
      legalReference: r.legalReference,
      category: r.category,
      severity: r.severity as "critical" | "major" | "minor",
      applicableTo: r.applicableTo,
      active: r.active,
    });
    setModalOpen(true);
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const url = editing ? `/api/rules/${editing.id}` : "/api/rules";
      const res = await fetch(url, {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Save failed");
      toast("success", editing ? "Rule updated" : "Rule added to library");
      setModalOpen(false);
      load();
    } catch (err: any) {
      toast("error", err.message);
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (r: Rule) => {
    // optimistic
    setRules((rs) =>
      rs.map((x) => (x.id === r.id ? { ...x, active: !x.active } : x)),
    );
    try {
      const res = await fetch(`/api/rules/${r.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: !r.active }),
      });
      if (!res.ok) throw new Error();
      toast(
        "success",
        r.active ? "Rule deactivated" : "Rule re-activated",
      );
    } catch {
      toast("error", "Toggle failed — reverting");
      load();
    }
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    const target = deleting;
    setDeleting(null);
    setRules((rs) => rs.filter((x) => x.id !== target.id));
    try {
      const res = await fetch(`/api/rules/${target.id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error();
      toast("success", "Rule deleted");
    } catch {
      toast("error", "Delete failed — restoring");
      load();
    }
  };

  return (
    <>
      <PageHeader
        title="Compliance Rules"
        subtitle="The Legal Metrology rule library the AI engine checks every label against"
        action={
          <Button onClick={openCreate}>
            <Icon d={ICONS.plus} className="h-4 w-4" />
            New rule
          </Button>
        }
      />

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Card key={i} className="p-5">
              <Skeleton className="h-5 w-1/2" />
              <Skeleton className="mt-2 h-4 w-2/3" />
            </Card>
          ))}
        </div>
      ) : rules.length === 0 ? (
        <Card>
          <EmptyState
            icon={ICONS.rules}
            title="No rules yet"
            message="Add Legal Metrology requirements so the scanner can verify labels against them."
            action={
              <Button onClick={openCreate}>
                <Icon d={ICONS.plus} className="h-4 w-4" />
                Add rule
              </Button>
            }
          />
        </Card>
      ) : (
        <div className="space-y-3">
          {rules.map((r) => (
            <Card key={r.id} className={cx(!r.active && "opacity-60")}>
              <button
                onClick={() => setOpenRow(openRow === r.id ? null : r.id)}
                className="flex w-full items-center gap-3 px-5 py-4 text-left"
              >
                <span className="hidden rounded-lg bg-ink-100 px-2 py-1 font-mono text-xs font-bold text-ink-600 sm:block">
                  {r.code}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold text-ink-950">
                      {r.title}
                    </span>
                    <Badge tone={SEV_TONE[r.severity]}>
                      {SEVERITY_LABEL[r.severity]}
                    </Badge>
                    <Badge tone="slate">{r.category}</Badge>
                  </div>
                  <div className="mt-0.5 truncate text-xs text-ink-400">
                    {r.legalReference}
                  </div>
                </div>
                <Icon
                  d={ICONS.chevronRight}
                  className={cx(
                    "h-4 w-4 shrink-0 text-ink-400 transition-transform",
                    openRow === r.id && "rotate-90",
                  )}
                />
              </button>
              {openRow === r.id && (
                <div className="animate-fade-up border-t border-ink-100 px-5 py-4">
                  <p className="text-sm leading-relaxed text-ink-600">
                    {r.description}
                  </p>
                  <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-ink-400">
                    <span>
                      Applies to:{" "}
                      <span className="font-semibold text-ink-600">
                        {r.applicableTo === "all"
                          ? "all categories"
                          : r.applicableTo}
                      </span>
                    </span>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Button
                      variant="secondary"
                      className="!py-1.5 text-xs"
                      onClick={() => openEdit(r)}
                    >
                      <Icon d={ICONS.edit} className="h-3.5 w-3.5" />
                      Edit rule
                    </Button>
                    <Button
                      variant="secondary"
                      className="!py-1.5 text-xs"
                      onClick={() => toggleActive(r)}
                    >
                      {r.active ? "Deactivate" : "Activate"}
                    </Button>
                    <Button
                      variant="ghost"
                      className="!py-1.5 text-xs !text-rose-600 hover:!bg-rose-50"
                      onClick={() => setDeleting(r)}
                    >
                      <Icon d={ICONS.trash} className="h-3.5 w-3.5" />
                      Delete
                    </Button>
                  </div>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? `Edit ${editing.code}` : "New compliance rule"}
        wide
      >
        <form onSubmit={save} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Rule code" required>
              <input
                className={inputCls}
                value={form.code}
                onChange={(e) =>
                  setForm((f) => ({ ...f, code: e.target.value }))
                }
                required
                placeholder="LM-011"
              />
            </Field>
            <Field label="Category" required>
              <select
                className={inputCls}
                value={form.category}
                onChange={(e) =>
                  setForm((f) => ({ ...f, category: e.target.value }))
                }
              >
                {["Declaration", "Presentation", "Pricing", "Integrity", "Other"].map(
                  (c) => (
                    <option key={c}>{c}</option>
                  ),
                )}
              </select>
            </Field>
            <div className="sm:col-span-2">
              <Field label="Title" required>
                <input
                  className={inputCls}
                  value={form.title}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, title: e.target.value }))
                  }
                  required
                  placeholder="e.g. Net Quantity Declared Clearly"
                />
              </Field>
            </div>
            <div className="sm:col-span-2">
              <Field label="Requirement description" required>
                <textarea
                  className={cx(inputCls, "min-h-[80px] resize-y")}
                  value={form.description}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, description: e.target.value }))
                  }
                  required
                  placeholder="What the label must declare, and in what form…"
                />
              </Field>
            </div>
            <Field label="Legal reference" required>
              <input
                className={inputCls}
                value={form.legalReference}
                onChange={(e) =>
                  setForm((f) => ({ ...f, legalReference: e.target.value }))
                }
                required
                placeholder="Rule 4(2)(a), LM (Packing Rules) 2011"
              />
            </Field>
            <Field label="Severity">
              <select
                className={inputCls}
                value={form.severity}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    severity: e.target.value as "critical" | "major" | "minor",
                  }))
                }
              >
                <option value="critical">Critical</option>
                <option value="major">Major</option>
                <option value="minor">Minor</option>
              </select>
            </Field>
            <div className="sm:col-span-2">
              <Field
                label="Applicable to"
                hint="'all' or comma-separated categories"
              >
                <input
                  className={inputCls}
                  value={form.applicableTo}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, applicableTo: e.target.value }))
                  }
                  placeholder="all · or: food,dairy,pharma"
                />
              </Field>
            </div>
            <label className="flex items-center gap-2 text-sm font-medium text-ink-800">
              <input
                type="checkbox"
                checked={form.active}
                onChange={(e) =>
                  setForm((f) => ({ ...f, active: e.target.checked }))
                }
                className="h-4 w-4 rounded border-ink-300 text-brand-600"
              />
              Active in engine
            </label>
          </div>
          <div className="flex justify-end gap-2 border-t border-ink-100 pt-4">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setModalOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" loading={saving}>
              {editing ? "Save changes" : "Add rule"}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        open={!!deleting}
        onClose={() => setDeleting(null)}
        title="Delete rule?"
      >
        <p className="text-sm text-ink-600">
          <span className="font-semibold text-ink-900">{deleting?.code}</span>{" "}
          — {deleting?.title} will be removed from the engine. Existing report
          findings keep their snapshots.
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
