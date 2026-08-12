"use client";

import { useState } from "react";
import { ReceiptText } from "lucide-react";
import { BaucherViewerModal } from "@/modules/wallet/components/BaucherViewerModal";

interface BaucherEntry {
  id: string;
  description: string;
  accountName: string;
  amount: string;
  occurredAt: string;
  secureToken: string | null;
}

export function BaucherEntryButton({
  entry,
  ownerName,
}: {
  entry: BaucherEntry;
  ownerName: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-indigo-200 bg-indigo-50 px-2.5 py-1.5 text-[11px] font-bold text-indigo-700 transition hover:bg-indigo-100"
      >
        <ReceiptText className="h-3.5 w-3.5" /> Ver baucher
      </button>
      {open ? (
        <BaucherViewerModal
          entry={{ ...entry, ownerName }}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </>
  );
}
