/** Always display operational dates in the business timezone. */
export function formatInvoiceDate(value: Date | string): string {
  return new Intl.DateTimeFormat("es-DO", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "America/Santo_Domingo",
  }).format(new Date(value));
}
