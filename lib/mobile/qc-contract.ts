/** Wire-only contract: no server code, database clients or credentials. */
export const QC_CHECKLIST = [
  { id: "pantalla", label: "Pantalla y táctil" },
  { id: "bateria", label: "Batería y carga" },
  { id: "camaras", label: "Cámaras frontal y posterior" },
  { id: "sensores", label: "Face ID / Touch ID" },
  { id: "audio", label: "Bocinas y micrófono" },
  { id: "botones", label: "Botones físicos" },
  { id: "conexion", label: "Wi-Fi y Bluetooth" },
  { id: "chasis", label: "Chasis y estética" },
] as const;
export type QcResult = "FUNCTIONAL" | "NON_FUNCTIONAL";
export type QcDevice = {
  id: string;
  imei: string;
  model: string;
  batchId: string | null;
  batchNumber: string | null;
  updatedAt: string;
  assignee: string | null;
  canReview: boolean;
  result: QcResult | null;
};
export type QcHistory = {
  id: string;
  result: string | null;
  grade: string | null;
  batteryHealth: number | null;
  functionalityNotes: string | null;
  physicalNotes: string | null;
  reviewerNameSnapshot: string;
  reviewedAt: string | null;
  createdAt: string;
  status: string;
};
export type QcPage = { devices: QcDevice[]; page: number; hasMore: boolean };
export type QcDetail = {
  device: QcDevice;
  inspections: QcHistory[];
  photos: Array<{ id: string; url: string }>;
};
export type QcCommand = {
  deviceId: string;
  result: QcResult;
  grade: string;
  notes: string | null;
  batteryHealth?: number;
  mobile: {
    commandId: string;
    expectedUpdatedAt: string;
    expectedBatchId: string;
    checklist: string[];
  };
};
