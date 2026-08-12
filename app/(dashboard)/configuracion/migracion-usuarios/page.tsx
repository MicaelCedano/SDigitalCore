import { DatabaseZap } from "lucide-react";
import { getLegacyMigrationDashboard } from "@/modules/wallet/data";
import { LegacyMigrationManager } from "@/modules/wallet/components/LegacyMigrationManager";

export default async function LegacyMigrationPage() {
  const data = await getLegacyMigrationDashboard();
  if (!data.schemaReady) {
    return (
      <div className="mx-auto max-w-3xl rounded-3xl border border-indigo-200 bg-white p-8 shadow-sm">
        <DatabaseZap className="h-10 w-10 text-indigo-600" />
        <h1 className="mt-5 text-2xl font-black text-slate-950">Migración preparada</h1>
        <p className="mt-3 leading-7 text-slate-600">
          La interfaz ya está publicada, pero las tablas de identidad y wallet todavía no se han aplicado. Por seguridad, aquí se muestran cero registros hasta ejecutar la migración manual en Supabase.
        </p>
      </div>
    );
  }
  return <LegacyMigrationManager identities={data.identities} users={data.users} batches={data.batches} />;
}
