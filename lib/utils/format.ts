/**
 * Formatear fecha a la zona horaria de República Dominicana.
 * Siempre guardar en UTC en la base de datos, presentar en RD.
 */
export function formatDateRD(
  date: Date | string,
  options?: Intl.DateTimeFormatOptions
): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString("es-DO", {
    timeZone: "America/Santo_Domingo",
    ...options,
  });
}

/**
 * Formatear fecha y hora completa en zona RD.
 */
export function formatDateTimeRD(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleString("es-DO", {
    timeZone: "America/Santo_Domingo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Retorna la fecha actual en UTC (para guardar en BD).
 */
export function nowUTC(): Date {
  return new Date();
}

/**
 * Formatear moneda en DOP.
 */
export function formatCurrency(
  amount: number,
  currency: string = "DOP"
): string {
  return new Intl.NumberFormat("es-DO", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(amount);
}
