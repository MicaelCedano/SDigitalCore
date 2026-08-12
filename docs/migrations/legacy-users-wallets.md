# Migración de usuarios y wallets desde SDigitalSystem

## Alcance

- Importa todos los usuarios anteriores, activos e inactivos, como identidades de referencia.
- Conserva las transacciones anteriores como historial inmutable. No copia `secure_token` y ese historial no altera el saldo de Core.
- Sugiere coincidencias por correo exacto normalizado y luego por nombre de usuario exacto normalizado.
- Nunca enlaza por nombre visible ni aprueba automáticamente una coincidencia.
- Al confirmar un enlace, conserva rol, correo, contraseña, estado y módulos actuales de Core.
- Wallet solo se concede, de forma individual y con confirmación administrativa, cuando la identidad anterior tiene rol `control_calidad` o `qc`. No aparece en el selector general de módulos y nunca se asigna automáticamente a todos los usuarios QC.
- En el corte final acredita el saldo vigente de la fuente como un único asiento idempotente.

## Variables de entorno de servidor

```env
SOURCE_DATABASE_URL="postgresql://...base-anterior..."
DATABASE_URL="postgresql://...sdigitalcore..."
```

No usar estas variables en componentes cliente ni prefijarlas con `NEXT_PUBLIC_`.

## Orden operativo

1. Aplicar manualmente `prisma/migrations/20260811233000_add_legacy_identity_wallet_bridge/migration.sql` en Supabase.
2. Ejecutar `npm run migration:legacy-wallets:dry-run`. Este comando no escribe datos.
3. Confirmar que `balancesReconcile` sea `true` y revisar candidatos/conflictos.
4. Ejecutar `npm run migration:legacy-wallets:apply` para archivar usuarios/transacciones y poblar la pantalla administrativa.
5. Confirmar manualmente cada enlace en `/configuracion/migracion-usuarios` o durante la aprobación de una solicitud nueva.
6. Programar el corte. Antes de iniciarlo, bloquear todas las escrituras del wallet anterior.
7. Con el sistema anterior congelado, configurar temporalmente `LEGACY_WALLET_WRITES_FROZEN=YES` y ejecutar `npm run migration:legacy-wallets:cutover`.
8. Validar totales por usuario, total global, cantidad de enlazados y asientos de apertura antes de habilitar operaciones nuevas.

Si se confirma un enlace después del corte, Core crea de inmediato su asiento de apertura contra el lote de corte ya completado. Repetir el comando de corte no duplica saldos: devuelve el lote previamente completado.

El script aborta si el saldo de cabecera de wallets no coincide con la suma de todas sus subcuentas. La bandera de congelación es obligatoria para impedir un corte accidental mientras el sistema anterior todavía recibe movimientos.

## Bloqueo pendiente en SDigitalSystem

El repositorio anterior está fuera del alcance de escritura de este checkout. Antes del corte debe agregarse un helper único `assertWalletWritesEnabled()` controlado por `WALLET_MAINTENANCE`, y llamarlo antes de cada mutación detectada en:

- `app/actions/wallet.ts`
- `app/actions/wallets.ts`
- `app/actions/lotes.ts`
- `app/actions/desbloqueos.ts`
- `app/actions/admin-payments.ts`
- `app/actions/garantias.ts`
- `app/api/telegram-webhook/route.ts`

El bloqueo debe rechazar la operación antes de crear transacciones o actualizar `wallet`/`wallet_account`; las lecturas deben permanecer disponibles.

## Reversión

La reversión no elimina datos. Crea un asiento opuesto por cada apertura del lote y devuelve las identidades a `LINKED_PENDING_CUTOVER`.

```powershell
$env:CONFIRM_LEGACY_WALLET_REVERSAL='YES'
npm.cmd run migration:legacy-wallets:reverse -- --batch=<id-del-lote>
```

Solo puede revertirse un lote `CUTOVER` completado. El comando es idempotente por `external_key`.

## Consultas de verificación

```sql
SELECT match_status, COUNT(*), SUM(source_wallet_balance)
FROM legacy_user_identity
GROUP BY match_status
ORDER BY match_status;

SELECT b.id, b.status, b.source_balance_total, b.transferred_balance_total,
       COUNT(e.id) AS opening_entries, COALESCE(SUM(e.amount), 0) AS opening_total
FROM legacy_migration_batch b
LEFT JOIN wallet_ledger_entry e
  ON e.batch_id = b.id AND e.type = 'LEGACY_OPENING_BALANCE'
GROUP BY b.id
ORDER BY b.created_at DESC;

SELECT w.id, w.user_id, w.balance, COALESCE(SUM(e.amount), 0) AS ledger_total
FROM wallet w
LEFT JOIN wallet_ledger_entry e ON e.wallet_id = w.id AND e.status = 'POSTED'
GROUP BY w.id
HAVING w.balance <> COALESCE(SUM(e.amount), 0);
```
