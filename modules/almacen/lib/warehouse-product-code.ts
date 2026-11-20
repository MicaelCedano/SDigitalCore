import { randomBytes } from "node:crypto";

export function generateWarehouseProductCode() {
  return `ALM-${randomBytes(8).toString("hex").toUpperCase()}`;
}
