/**
 * Mantiene Marca y Modelo como campos independientes.
 * Ejemplo: Marca "Samsung" + Modelo "Samsung Galaxy S25 Edge"
 * se guarda como "Samsung" + "Galaxy S25 Edge".
 */
export function normalizeModelName(model: string, brand?: string | null) {
  const cleanModel = model.replace(/\s+/g, " ").trim();
  const cleanBrand = brand?.replace(/\s+/g, " ").trim();
  if (!cleanModel || !cleanBrand) return cleanModel;

  const prefix = `${cleanBrand} `;
  if (cleanModel.slice(0, prefix.length).toLocaleLowerCase() !== prefix.toLocaleLowerCase()) {
    return cleanModel;
  }

  const withoutBrand = cleanModel.slice(prefix.length).trim();
  return withoutBrand || cleanModel;
}
