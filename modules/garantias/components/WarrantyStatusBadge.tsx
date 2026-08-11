import { getWarrantyStatusLabel, WARRANTY_STATUS_TONES } from "@/modules/garantias/lib/status-machine";
import type { WarrantyStatus } from "@prisma/client";

export function WarrantyStatusBadge({ status }: { status: WarrantyStatus }) {
  return <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-bold ${WARRANTY_STATUS_TONES[status]}`}>{getWarrantyStatusLabel(status)}</span>;
}
