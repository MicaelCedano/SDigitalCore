const fs = require('fs');
const path = require('path');

const subPages = [
  { dir: 'configuracion/usuarios', name: 'Usuarios & Permisos', parent: 'Configuración' },
  { dir: 'configuracion/sucursales', name: 'Sucursales', parent: 'Configuración' },
  { dir: 'configuracion/general', name: 'Ajustes Generales', parent: 'Configuración' },
  { dir: 'inventario/imeis', name: 'IMEIs & Series', parent: 'Inventario' },
  { dir: 'inventario/ajustes', name: 'Ajustes de Stock', parent: 'Inventario' },
  { dir: 'ventas/ordenes', name: 'Órdenes de Venta', parent: 'Ventas' },
  { dir: 'ventas/cobros', name: 'Cobros & Pagos', parent: 'Ventas' },
  { dir: 'taller/diagnosticos', name: 'Diagnósticos', parent: 'Taller' },
  { dir: 'taller/entregas', name: 'Entregas', parent: 'Taller' },
];

const base = 'app/(dashboard)';
subPages.forEach(p => {
  const fullDir = path.join(base, p.dir);
  fs.mkdirSync(fullDir, { recursive: true });
  const content = `import type { Metadata } from "next";

export const metadata: Metadata = { title: "${p.name} | SDigitalCore" };

export default function Page() {
  return (
    <div className="space-y-4 max-w-5xl">
      <div className="p-6 bg-white border border-slate-200 rounded-2xl shadow-xs">
        <span className="text-xs font-semibold text-indigo-600 font-mono">${p.parent} / ${p.name}</span>
        <h1 className="text-xl font-bold text-slate-900 mt-1">${p.name}</h1>
        <p className="text-xs text-slate-500 mt-1">Sub-módulo oficial de ${p.parent}.</p>
      </div>
    </div>
  );
}
`;
  fs.writeFileSync(path.join(fullDir, 'page.tsx'), content);
});
console.log('Sub-pages created!');
