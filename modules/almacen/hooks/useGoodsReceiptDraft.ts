"use client";

import { useState, useEffect, useCallback } from "react";
import { GoodsReceiptInput } from "@/lib/validation/goods-receipt";

const DRAFT_KEY = "sd_goods_receipt_draft_v1";

export function useGoodsReceiptDraft() {
  const [draft, setDraft] = useState<GoodsReceiptInput | null>(null);
  const [hasSavedDraft, setHasSavedDraft] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);

  // Cargar borrador inicial si existe
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
      console.warn("Error leyendo borrador de localStorage:", err);
    }
  }, []);

  // Guardar borrador en localStorage
  const saveDraft = useCallback((formData: GoodsReceiptInput) => {
    try {
      // Solo guardar si hay proveedor o al menos 1 ítem con descripción
      const hasContent =
        (formData.supplierName && formData.supplierName.trim() !== "") ||
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
      console.warn("Error guardando borrador en localStorage:", err);
    }
  }, []);

  // Limpiar borrador
  const clearDraft = useCallback(() => {
    try {
      localStorage.removeItem(DRAFT_KEY);
      setDraft(null);
      setHasSavedDraft(false);
      setLastSavedAt(null);
    } catch (err) {
      console.warn("Error limpiando borrador de localStorage:", err);
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
