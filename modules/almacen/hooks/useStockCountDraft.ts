"use client";

import { useState, useEffect, useCallback } from "react";
import { StockCountInput } from "@/lib/validation/stock-count";

const DRAFT_KEY = "sd_stock_count_draft_v1";

export function useStockCountDraft() {
  const [draft, setDraft] = useState<StockCountInput | null>(null);
  const [hasSavedDraft, setHasSavedDraft] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(DRAFT_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed && parsed.formData && Array.isArray(parsed.formData.items) && parsed.formData.items.length > 0) {
          setDraft(parsed.formData);
          setHasSavedDraft(true);
          if (parsed.savedAt) {
            setLastSavedAt(new Date(parsed.savedAt));
          }
        }
      }
    } catch (err) {
      console.warn("Error leyendo borrador de conteo:", err);
    }
  }, []);

  const saveDraft = useCallback((formData: StockCountInput) => {
    try {
      const hasContent =
        (formData.title && formData.title.trim() !== "") ||
        formData.items.some((i) => i.description && i.description.trim() !== "");

      if (!hasContent) return;

      const now = new Date();
      localStorage.setItem(
        DRAFT_KEY,
        JSON.stringify({
          formData,
          savedAt: now.toISOString(),
        })
      );
      setHasSavedDraft(true);
      setLastSavedAt(now);
    } catch (err) {
      console.warn("Error guardando borrador de conteo:", err);
    }
  }, []);

  const clearDraft = useCallback(() => {
    try {
      localStorage.removeItem(DRAFT_KEY);
      setDraft(null);
      setHasSavedDraft(false);
      setLastSavedAt(null);
    } catch (err) {
      console.warn("Error limpiando borrador de conteo:", err);
    }
  }, []);

  return {
    savedDraftData: draft,
    hasSavedDraft,
    lastSavedAt,
    saveDraft,
    clearDraft,
  };
}
