"use client";

import React, { ReactNode } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Info,
  SlidersHorizontal,
  Trash2,
  X,
  Loader2,
  LucideIcon,
} from "lucide-react";

export type ConfirmDialogVariant = "danger" | "warning" | "success" | "info" | "primary";

export interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  title: string;
  description?: string;
  children?: ReactNode;
  confirmText?: string;
  cancelText?: string | null;
  variant?: ConfirmDialogVariant;
  icon?: LucideIcon;
  isLoading?: boolean;
}

export function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  children,
  confirmText = "Aceptar",
  cancelText = "Cancelar",
  variant = "primary",
  icon: CustomIcon,
  isLoading = false,
}: ConfirmDialogProps) {
  if (!isOpen) return null;

  const getVariantStyles = () => {
    switch (variant) {
      case "danger":
        return {
          iconBg: "bg-red-50 text-red-600 border-red-200",
          icon: CustomIcon || Trash2,
          btnConfirm: "bg-red-600 hover:bg-red-700 text-white focus:ring-red-500",
        };
      case "warning":
        return {
          iconBg: "bg-amber-50 text-amber-600 border-amber-200",
          icon: CustomIcon || AlertTriangle,
          btnConfirm: "bg-amber-600 hover:bg-amber-700 text-white focus:ring-amber-500",
        };
      case "success":
        return {
          iconBg: "bg-emerald-50 text-emerald-600 border-emerald-200",
          icon: CustomIcon || CheckCircle2,
          btnConfirm: "bg-emerald-600 hover:bg-emerald-700 text-white focus:ring-emerald-500",
        };
      case "info":
        return {
          iconBg: "bg-sky-50 text-sky-600 border-sky-200",
          icon: CustomIcon || Info,
          btnConfirm: "bg-sky-600 hover:bg-sky-700 text-white focus:ring-sky-500",
        };
      case "primary":
      default:
        return {
          iconBg: "bg-[#5750f1]/10 text-[#5750f1] border-[#5750f1]/20",
          icon: CustomIcon || SlidersHorizontal,
          btnConfirm: "bg-[#5750f1] hover:bg-[#4840d6] text-white focus:ring-[#5750f1]",
        };
    }
  };

  const { iconBg, icon: IconComponent, btnConfirm } = getVariantStyles();

  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div
        className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden flex flex-col animate-in zoom-in-95 duration-150"
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="px-6 pt-6 pb-2 flex items-start justify-between">
          <div className={`p-3 rounded-2xl border shrink-0 ${iconBg}`}>
            <IconComponent className="w-6 h-6" />
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors disabled:opacity-50 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="px-6 py-3 space-y-2">
          <h3 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">
            {title}
          </h3>
          {description && (
            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed whitespace-pre-line">
              {description}
            </p>
          )}
          {children && <div className="mt-2 text-xs sm:text-sm">{children}</div>}
        </div>

        {/* Actions Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-2.5">
          {cancelText && (
            <button
              type="button"
              onClick={onClose}
              disabled={isLoading}
              className="px-4 py-2 text-xs sm:text-sm font-semibold text-slate-600 hover:text-slate-800 bg-white border border-slate-300 rounded-xl hover:bg-slate-100 transition-colors disabled:opacity-50 shadow-2xs cursor-pointer"
            >
              {cancelText}
            </button>
          )}
          <button
            type="button"
            onClick={onConfirm}
            disabled={isLoading}
            className={`px-4 py-2 text-xs sm:text-sm font-bold rounded-xl transition-all shadow-2xs inline-flex items-center gap-2 disabled:opacity-50 cursor-pointer ${btnConfirm}`}
          >
            {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
