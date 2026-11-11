"use client";

import { useCallback, useMemo, useState, useSyncExternalStore } from "react";
import { z } from "zod";

const draftChanged = "sdigital:warehouse-request-draft-changed";

const formSchema = z.object({
  type: z.enum(["ENTRY", "EXIT"]),
  branch: z.string(),
  reason: z.string(),
  items: z.array(z.object({
    productId: z.string(),
    label: z.string(),
    measure: z.enum(["BOXES", "UNITS"]),
    quantity: z.string(),
  })),
});

const draftSchema = z.object({ form: formSchema, savedAt: z.iso.datetime() });

export type WarehouseRequestFormData = z.infer<typeof formSchema>;
type Draft = z.infer<typeof draftSchema>;

export const emptyWarehouseRequest: WarehouseRequestFormData = {
  type: "EXIT",
  branch: "",
  reason: "",
  items: [],
};

function readDraft(value: string | null) {
  if (!value) return null;
  try {
    const parsed = draftSchema.safeParse(JSON.parse(value));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

const getServerSnapshot = () => undefined;

export function useWarehouseRequestDraft(ownerId?: string) {
  const key = ownerId ? `sd_warehouse_request_draft_v1:${ownerId}` : null;
  const [unsavedDraft, setUnsavedDraft] = useState<{ draft: Draft | null } | null>(null);

  const subscribe = useCallback((notify: () => void) => {
    if (!key) return () => {};
    function onStorage(event: StorageEvent) {
      if (event.key === key || event.key === null) notify();
    }
    window.addEventListener("storage", onStorage);
    window.addEventListener(draftChanged, notify);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener(draftChanged, notify);
    };
  }, [key]);

  const getSnapshot = useCallback(() => {
    if (!key) return null;
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  }, [key]);

  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const savedDraft = useMemo(() => readDraft(snapshot ?? null), [snapshot]);

  function writeDraft(draft: Draft | null) {
    if (!key) return;
    try {
      if (draft) localStorage.setItem(key, JSON.stringify(draft));
      else localStorage.removeItem(key);
      setUnsavedDraft(null);
      window.dispatchEvent(new Event(draftChanged));
    } catch {
      setUnsavedDraft({ draft });
    }
  }

  function saveDraft(update: (form: WarehouseRequestFormData) => WarehouseRequestFormData) {
    const latest = unsavedDraft ? unsavedDraft.draft : readDraft(getSnapshot());
    const form = update(latest?.form ?? emptyWarehouseRequest);
    const hasContent = form.type !== "EXIT" || form.branch !== "" || form.reason !== "" || form.items.length > 0;
    writeDraft(hasContent ? { form, savedAt: new Date().toISOString() } : null);
  }

  function clearDraftAfterSend() {
    // A submission from this tab must not erase newer edits made in another tab.
    if (getSnapshot() === snapshot) writeDraft(null);
    else setUnsavedDraft(null);
  }

  return {
    draft: unsavedDraft ? unsavedDraft.draft : savedDraft,
    ready: snapshot !== undefined,
    storageError: unsavedDraft !== null,
    saveDraft,
    discardDraft: () => writeDraft(null),
    clearDraftAfterSend,
  };
}
