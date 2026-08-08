"use client";

import { useState, useEffect } from "react";
import {
  getWarehouseMovementsAction,
  getWarehouseProductsAction,
  createWarehouseMovementAction,
} from "../actions/warehouse";
import { WarehouseMovementInput } from "@/lib/validation/warehouse";
import {
  ArrowDownRight,
  ArrowUpRight,
  Plus,
  Search,
  RefreshCw,
  Boxes,
  Calendar,
  User,
  X,
  CheckCircle2,
  AlertCircle,
  FileSpreadsheet,
} from "lucide-react";
import { BulkMovementDialog } from "./BulkMovementDialog";

export function WarehouseMovementsManager() {
  const [movements, setMovements] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const [showModal, setShowModal] = useState(false);
  const [productId, setProductId] = useState("");
  const [type, setType] = useState<"ENTRY" | "EXIT">("ENTRY");
  const [unitsCount, setUnitsCount] = useState<number>(1);
  const [reason, setReason] = useState("");

  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fetchMovementsAndProducts = async () => {
    setLoading(true);
    const [resMovs, resProds] = await Promise.all([
      getWarehouseMovementsAction(search),
      getWarehouseProductsAction(""),
    ]);

    if (resMovs.success && resMovs.data) {
      setMovements(resMovs.data);
    }
    if (resProds.success && resProds.data) {
      setProducts(resProds.data);
    }
    setLoading(false);
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchMovementsAndProducts();
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const handleOpenCreate = (initialType: "ENTRY" | "EXIT" = "ENTRY") => {
    setType(initialType);
    setProductId(products.length > 0 ? products[0].id : "");
    setUnitsCount(1);
    setReason(initialType === "ENTRY" ? "RecepciÃ³n de mercancÃ­a" : "Traslado / Salida de inventario");
    setErrorMsg(null);
    setShowModal(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!productId) {
      setErrorMsg("Por favor seleccione un producto.");
      return;
    }
    if (!reason.trim()) {
      setErrorMsg("Por favor ingrese el motivo del movimiento.");
      return;
    }

    setSaving(true);

    try {
      const payload: WarehouseMovementInput = {
        productId,
        type,
        unitsCount: Number(unitsCount) || 1,
        reason: reason.trim(),
      };

      const res = await createWarehouseMovementAction(payload);
      if (res.success) {
        setShowModal(false);
        fetchMovementsAndProducts();
      } else {
        setErrorMsg(res.error || "Error al registrar movimiento");
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Error al procesar la solicitud");
    } finally {
      setSaving(false);
    }
  };

  const selectedProductObj = products.find((p) => p.id === productId);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white p-6 rounded-xl border border-slate-200 shadow-xs">
        <div className="flex items-center gap-3.5">
          <div className="p-3 bg-[#5750f1]/10 text-[#5750f1] rounded-xl border border-[#5750f1]/20">
            <Boxes className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-800 tracking-tight">
              Movimientos de AlmacÃ©n (Entradas & Salidas)
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Registro de ingresos, salidas de cajas, ajustes de stock y trazabilidad en tiempo real
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <BulkMovementDialog products={products} type="ENTRY" onComplete={fetchMovementsAndProducts} />
          <BulkMovementDialog products={products} type="EXIT" onComplete={fetchMovementsAndProducts} />
        </div>
      </div>

      {/* Search & Refresh */}
      <div className="bg-white border border-slate-200 p-4 rounded-xl shadow-2xs flex items-center justify-between gap-4">
        <div className="relative w-full sm:w-96">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por producto, motivo o usuario..."
            className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-2 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-[#5750f1]"
          />
        </div>

        <button
          onClick={fetchMovementsAndProducts}
          className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl transition-colors"
          title="Recargar movimientos"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {/* Movements Table */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-2xs overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-500 space-y-3">
            <RefreshCw className="w-7 h-7 animate-spin mx-auto text-[#5750f1]" />
            <p className="text-xs font-semibold">Cargando movimientos de almacÃ©n...</p>
          </div>
        ) : movements.length === 0 ? (
          <div className="p-12 text-center text-slate-500 space-y-3">
            <Boxes className="w-10 h-10 text-slate-300 mx-auto" />
            <p className="text-sm font-bold text-slate-700">No hay movimientos registrados</p>
            <p className="text-xs text-slate-500">
              Registra una Entrada o Salida para llevar la bitÃ¡cora del inventario.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-50 text-slate-600 font-bold text-[11px] uppercase border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3">Tipo</th>
                  <th className="px-4 py-3">Fecha & Hora</th>
                  <th className="px-4 py-3">Producto / CÃ³digo</th>
                  <th className="px-4 py-3 text-center">Impacto Unidades</th>
                  <th className="px-4 py-3">Motivo / RazÃ³n</th>
                  <th className="px-4 py-3">Registrado Por</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {movements.map((m) => {
                  const formattedDate = new Date(m.createdAt).toLocaleString("es-DO", {
                    dateStyle: "medium",
                    timeStyle: "short",
                  });

                  return (
                    <tr key={m.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-4 py-3.5">
                        <span
                          className={`inline-flex items-center gap-1 font-bold text-xs px-2.5 py-1 rounded-full border ${
                            m.type === "ENTRY"
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                              : "bg-rose-50 text-rose-700 border-rose-200"
                          }`}
                        >
                          {m.type === "ENTRY" ? (
                            <>
                              <ArrowDownRight className="w-3.5 h-3.5" /> ENTRADA
                            </>
                          ) : (
                            <>
                              <ArrowUpRight className="w-3.5 h-3.5" /> SALIDA
                            </>
                          )}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-slate-500 font-medium whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 text-slate-400" />
                          <span>{formattedDate}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3.5">
                        <span className="font-bold text-slate-800 block text-xs">
                          {m.product?.name || "Producto eliminado"}
                        </span>
                        <span className="text-[11px] font-mono text-slate-500">
                          {m.product?.code || "-"}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-center">
                        <span
                          className={`font-extrabold ${
                            m.type === "ENTRY" ? "text-emerald-600" : "text-rose-600"
                          }`}
                        >
                          {m.type === "ENTRY" ? `+${m.totalUnits}` : `-${m.totalUnits}`} uds
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-slate-700 font-medium">
                        {m.reason}
                      </td>
                      <td className="px-4 py-3.5 text-slate-600 font-medium">
                        <div className="flex items-center gap-1">
                          <User className="w-3.5 h-3.5 text-slate-400" />
                          <span>{m.createdBy || "Usuario"}</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal Form */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
                {type === "ENTRY" ? (
                  <span className="text-emerald-600 flex items-center gap-1">
                    <ArrowDownRight className="w-5 h-5" /> Nueva Entrada de AlmacÃ©n
                  </span>
                ) : (
                  <span className="text-rose-600 flex items-center gap-1">
                    <ArrowUpRight className="w-5 h-5" /> Nueva Salida de AlmacÃ©n
                  </span>
                )}
              </h2>
              <button
                onClick={() => setShowModal(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="p-6 space-y-4">
              {errorMsg && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Seleccionar Producto <span className="text-red-500">*</span>
                </label>
                <select
                  value={productId}
                  onChange={(e) => setProductId(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 focus:outline-none focus:border-[#5750f1]"
                >
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.code} â€” {p.name} (Stock: {p.boxes} cajas)
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Cantidad de Unidades {type === "ENTRY" ? "(a Ingresar)" : "(a Retirar)"}{" "}
                  <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  min={1}
                  value={unitsCount}
                  onChange={(e) => setUnitsCount(Number(e.target.value))}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-extrabold text-slate-800 focus:outline-none focus:border-[#5750f1]"
                />
              </div>

              {selectedProductObj && (
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs space-y-1">
                  <div className="text-slate-500">
                    Unidades disponibles: <strong>{selectedProductObj.totalUnits}</strong> | Sueltas:{" "}
                    <strong>{selectedProductObj.looseUnits || 0}</strong>
                  </div>
                  <div className="font-bold text-slate-800">
                    Impacto en Unidades Totales:{" "}
                    <strong className={type === "ENTRY" ? "text-emerald-600" : "text-rose-600"}>
                      {type === "ENTRY" ? "+" : "-"}
                      {Number(unitsCount) || 1} uds
                    </strong>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Motivo / RazÃ³n <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Ej. RecepciÃ³n de proveedor, Venta mayorista, Traslado..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-[#5750f1]"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-xs"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className={`px-5 py-2 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-md disabled:opacity-50 ${
                    type === "ENTRY"
                      ? "bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/20"
                      : "bg-rose-600 hover:bg-rose-700 shadow-rose-600/20"
                  }`}
                >
                  {saving ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4" />
                  )}
                  Registrar Movimiento
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
