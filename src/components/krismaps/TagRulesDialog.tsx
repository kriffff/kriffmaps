import { useState } from "react";
import { Plus, RotateCcw, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { TagRule } from "@/lib/krismaps/tags";

interface Props {
  open: boolean;
  rules: TagRule[];
  counts: Record<string, number>;
  onClose: () => void;
  onAdd: (label: string) => void;
  onUpdate: (id: string, patch: Partial<Omit<TagRule, "id">>) => void;
  onRemove: (id: string) => void;
  onReset: () => void;
}

export function TagRulesDialog({
  open,
  rules,
  counts,
  onClose,
  onAdd,
  onUpdate,
  onRemove,
  onReset,
}: Props) {
  const [newTag, setNewTag] = useState("");
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  return (
    <Dialog open={open} onOpenChange={(next) => (next ? undefined : onClose())}>
      <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto sm:max-w-2xl">
        <DialogTitle className="font-display text-lg tracking-wide">Tag rules</DialogTitle>
        <DialogDescription className="text-xs">
          Maps are tagged automatically by matching these keywords against file names and folder
          names. Everything runs on this device and is remembered between sessions.
        </DialogDescription>

        <div className="flex items-end gap-2">
          <div className="flex-1">
            <Label htmlFor="new-tag" className="text-xs text-muted-foreground">
              New tag
            </Label>
            <Input
              id="new-tag"
              value={newTag}
              placeholder="e.g. Ambush"
              onChange={(e) => setNewTag(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && newTag.trim()) {
                  onAdd(newTag);
                  setNewTag("");
                }
              }}
            />
          </div>
          <Button
            onClick={() => {
              if (!newTag.trim()) return;
              onAdd(newTag);
              setNewTag("");
            }}
          >
            <Plus className="size-4" /> Add
          </Button>
        </div>

        <div className="space-y-4">
          {rules.map((rule) => (
            <div key={rule.id} className="rounded-lg border border-border bg-card p-3">
              <div className="flex items-center gap-2">
                <Input
                  value={rule.label}
                  aria-label={`Name for ${rule.label}`}
                  onChange={(e) => onUpdate(rule.id, { label: e.target.value })}
                  className="h-8 max-w-[220px]"
                />
                <span className="text-xs text-muted-foreground">
                  {counts[rule.id] ?? 0} map{(counts[rule.id] ?? 0) === 1 ? "" : "s"}
                </span>
                <button
                  type="button"
                  aria-label={`Delete ${rule.label}`}
                  onClick={() => onRemove(rule.id)}
                  className="ml-auto rounded p-1 text-muted-foreground hover:text-destructive"
                >
                  <X className="size-4" />
                </button>
              </div>
              <Label className="mt-3 block text-xs text-muted-foreground">
                Keywords (comma separated)
              </Label>
              <Input
                value={drafts[rule.id] ?? rule.keywords.join(", ")}
                onChange={(e) => {
                  const text = e.target.value;
                  setDrafts((prev) => ({ ...prev, [rule.id]: text }));
                  onUpdate(rule.id, {
                    keywords: text
                      .split(",")
                      .map((word) => word.trim().toLowerCase())
                      .filter(Boolean),
                  });
                }}
                onBlur={() =>
                  setDrafts((prev) => {
                    const next = { ...prev };
                    delete next[rule.id];
                    return next;
                  })
                }
                className="mt-1"
              />
            </div>
          ))}
        </div>

        <div className="flex justify-between">
          <Button variant="secondary" onClick={onReset}>
            <RotateCcw className="size-4" /> Reset to defaults
          </Button>
          <Button onClick={onClose}>Done</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
