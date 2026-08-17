export type Shipment = {
  id: string;
  code: string;
  title: string;
  origin: string;
  destination: string;
  vehicleLabel: string | null;
  notes: string | null;
  status: "DRAFT" | "READY" | "IN_TRANSIT" | "PAUSED" | "DELIVERED" | "CANCELLED";
  driver: { id: string; name: string | null; username: string | null } | null;
  startedAt: string | null;
  deliveredAt: string | null;
  lastLocation: LocationPoint | null;
  locations: LocationPoint[];
  stops: ShipmentStop[];
};

export type ShipmentStop = {
  id: string;
  name: string;
  address: string;
  mapsUrl: string | null;
  latitude: number;
  longitude: number;
  status: "PENDING" | "ARRIVED";
  arrivedAt: string | null;
};

export type LocationPoint = { latitude: number; longitude: number; accuracyMeters: number | null; speedMps: number | null; heading: number | null; recordedAt: string };
