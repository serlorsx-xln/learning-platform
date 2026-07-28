"use client";

import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export type CookieEntry = { id: string; key: string; value: string };

export function createCookieEntry(key = "", value = ""): CookieEntry {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    key,
    value,
  };
}

export function cookieEntriesToRecord(entries: CookieEntry[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const entry of entries) {
    const key = entry.key.trim();
    if (!key) continue;
    out[key] = entry.value;
  }
  return out;
}

interface CookieEntriesProps {
  entries: CookieEntry[];
  onChange: (entries: CookieEntry[]) => void;
}

export function CookieEntries({ entries, onChange }: CookieEntriesProps) {
  function update(id: string, patch: Partial<Pick<CookieEntry, "key" | "value">>) {
    onChange(entries.map((row) => (row.id === id ? { ...row, ...patch } : row)));
  }

  function remove(id: string) {
    if (entries.length <= 1) {
      onChange([createCookieEntry()]);
      return;
    }
    onChange(entries.filter((row) => row.id !== id));
  }

  return (
    <div className="space-y-3">
      <div className="flex items-end justify-between gap-3">
        <div className="space-y-1">
          <Label>Cookies</Label>
          <p className="text-caption text-muted-foreground">
            Set each cookie name and value yourself. Add as many rows as you need.
          </p>
        </div>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => onChange([...entries, createCookieEntry()])}
        >
          <Plus className="size-4" strokeWidth={1.75} />
          Add
        </Button>
      </div>

      <div className="space-y-2">
        {entries.map((row) => (
          <div key={row.id} className="grid grid-cols-[1fr_1fr_auto] gap-2">
            <Input
              placeholder="Cookie name"
              value={row.key}
              onChange={(e) => update(row.id, { key: e.target.value })}
              autoComplete="off"
              spellCheck={false}
            />
            <Input
              placeholder="Value"
              value={row.value}
              onChange={(e) => update(row.id, { value: e.target.value })}
              autoComplete="off"
              spellCheck={false}
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="Remove cookie"
              onClick={() => remove(row.id)}
            >
              <Trash2 className="size-4" strokeWidth={1.75} />
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}
