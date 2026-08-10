import { getWarrantyStatusLabel, WARRANTY_STATUS_TONES } from "@/modules/garantias/lib/status-machine";
import type { WarrantyStatus } from "@prisma/client";

export function WarrantyStatusBadge({ status }: { status: WarrantyStatus }) {
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ${WARRANTY_STATUS_TONES[status]}`}>{getWarrantyStatusLabel(status)}</span>;
}
