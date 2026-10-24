# Mobile V2 — Primera entrega operativa de Control de Calidad

## Fase preparada

Implementación local del primer flujo QC en React Native Community CLI y TypeScript: consultar equipos asignados, buscar/escanear IMEI, revisar, adjuntar fotos y consultar el historial. APK candidata `2.0.0-preview.6`, paquete independiente `com.sdigitalcore.mobilev2`.

**Publicación autorizada por Micael el 23 de octubre de 2026.** La verificación del esquema remoto fue correcta: existen los campos y ambos índices únicos necesarios. El despliegue y su comprobación final se realizan después de esta preparación. La aprobación de lotes, asignaciones, solicitudes, penalidades y pagos continúan en la web; esta entrega no declara equivalencia completa del módulo QC.

## Comportamiento implementado

- La bandeja consulta páginas de 20 equipos directamente en el servidor; QC ve sus asignaciones y ADMIN los lotes activos. Busca IMEI, serie, marca o modelo; permite escaneo y actualización manual/al volver a la aplicación.
- El detalle conserva el historial existente: revisor original, resultado, fecha de República Dominicana, grado, batería y observaciones funcionales/físicas. Las fotos se consultan mediante los lectores actuales.
- El formulario registra resultado, grado A–E, batería opcional 0–100, observaciones y hasta cuatro fotos nuevas por envío. Para marcar funcional debe completarse el mismo checklist de ocho puntos que la web. El guardado pide confirmación visible con IMEI, resultado y cuenta del revisor.
- Cada envío móvil tiene UUID y versión esperada del equipo/lote. Un reintento del mismo comando devuelve su registro existente; un cambio de asignación, lote o versión impide sobrescribir silenciosamente la revisión.
- La revisión Web y móvil comparten `reviewDeviceAction` y `recordReview`: inspección, estado del equipo, contadores y auditoría se guardan en una transacción. Se bloquean las filas del lote y equipo antes de recalcular. Las correcciones conservan el historial; un reingreso no hereda como propia la revisión del lote anterior.
- Las fotos se envían después de confirmar la inspección, una por operación. Si falla una carga, se reintentan las pendientes sin registrar otra inspección. La operación de cada foto tiene un identificador estable. Una pérdida de permiso descarta el comando local antes de habilitar otro formulario.
- Android reduce la imagen antes de enviarla. El servidor decodifica el contenido real, admite JPEG/PNG/WebP y normaliza a WebP de hasta 1600 px sin metadatos. Se mantienen los proveedores actuales de Storage/Drive y sus credenciales exclusivamente en servidor.
- No hay operaciones financieras nuevas. El guardado no envía el lote para pago, no lo aprueba y no acredita wallets. Se conserva la actualización de tareas/avisos que ya realizaba la acción web.
- El modo demo no llama estas rutas reales. No se agregan borradores reales persistentes ni una cola offline en esta fase.

## Archivos creados o modificados

| Área | Archivos |
| --- | --- |
| Contratos y validación | `lib/mobile/qc-contract.ts`, `lib/validation/revision-batch.ts` |
| Lectura y protección HTTP | `lib/mobile/qc-data.ts`, `lib/mobile/qc-http.ts`, `proxy.ts` |
| API | `app/api/mobile/qc/route.ts`, `app/api/mobile/qc/review/route.ts`, `app/api/mobile/qc/photo/route.ts` |
| Negocio existente | `modules/qc/actions/revision-batch.ts`, `modules/qc/actions/device-photos.ts`, `modules/qc/lib/record-review.ts`, `modules/qc/lib/photo-input.ts` |
| Checklist compartido Web | `modules/qc/components/ReviewDeviceModal.tsx` |
| Android y navegación | `apps/mobile/App.tsx`, `src/navigation/types.ts`, `src/screens/WorkspaceScreens.tsx`, `src/screens/QcScreens.tsx`, `src/state/AppContext.tsx`, `src/services/native.ts`, `src/services/qc.ts`, `CoreNative.kt` |
| Versión y distribución local | `apps/mobile/package.json`, `package-lock.json`, `android/app/build.gradle`, `src/screens/MoreScreens.tsx`, `scripts/build-android.ps1`, `scripts/serve-preview.cjs`, `README.md` |
| Pruebas | `scripts/mobile-qc.test.mjs`, `apps/mobile/__tests__/QcLive.test.tsx`, `apps/mobile/jest.setup.js` |

Se preservaron los cambios previos del repositorio, incluido `modules/qc/actions/penalties.ts`. No se realizó commit/push general del árbol local, que ya contenía otros cambios y fuentes móviles sin seguimiento.

## Migraciones y configuración

- Migraciones generadas: **ninguna**. No se editó `schema.prisma` ni una migración aplicada.
- Variables nuevas: **ninguna**. Se reutilizan Auth.js, Prisma y el almacenamiento existentes.
- No se hicieron escrituras de prueba ni correcciones históricas en producción.
- Los comandos reutilizan campos e índices que ya declara Prisma: `QcInspection.sourceSystem/sourceRecordId` y `supersedesId`; las fotos utilizan un ID explícito. La comprobación remota de solo lectura fue satisfactoria el 23 de octubre de 2026: están las columnas `source_system`, `source_record_id`, `supersedes_id` y los índices únicos `qc_inspection_source_system_source_record_id_key` y `qc_inspection_supersedes_id_key`. No se modificó la base de datos.
- No hay dependencias Expo/EAS instaladas ni un servicio nuevo de compilación de pago. La compilación se realiza localmente con el SDK y Gradle existentes. El almacenamiento continúa consumiendo los recursos actuales del proyecto.

## Rutas y permisos

| Ruta | Validaciones |
| --- | --- |
| `GET /api/mobile/qc?q=&page=1` | Usuario persistido activo, `qc.read`, alcance por asignación salvo ADMIN |
| `GET /api/mobile/qc?deviceId=…` | Usuario activo, `qc.read`; mantiene el alcance histórico de lectura de QC de la web; `canReview` se calcula por separado |
| `POST /api/mobile/qc/review` | Usuario activo, `qc.write`, Origin del sitio, cabecera móvil, JSON acotado, Zod, asignación/ADMIN, lote vigente, versión del equipo, checklist y comando UUID |
| `POST /api/mobile/qc/photo` | Usuario activo, `qc.write`, Origin/cabecera móvil, JSON acotado, Zod, acceso al equipo, imagen decodificable y UUID |

Se conservan los permisos actuales por módulo; no se inventan permisos granulares nuevos ni Supabase Auth. Las respuestas llevan `private, no-store`. Una sesión vencida devuelve JSON 401 y Android elimina la sesión local cifrada. Los cambios de permisos actualizan el catálogo y bloquean el formulario.

## Pruebas ejecutadas

- **5 suites / 20 pruebas móviles**: confirmación antes del envío, historial del revisor original, consulta sin formulario cuando no corresponde, sesión vencida, permisos revocados, nuevo formulario después de un rechazo, aislamiento de demo, repetición del mismo UUID y reintento de fotos sin repetir la inspección; además de las pruebas previas de catálogo y búsqueda.
- `scripts/mobile-qc.test.mjs`: ejecuta el servicio y las rutas con adaptadores aislados; verifica transacción/auditoría, correcciones, reingresos, asignación, versión, repetición de comandos, checklist, validación de imagen real, límites, CSRF y lectura paginada por rol. Los casos simultáneos usan un adaptador serializado; **no equivalen a un ensayo concurrente contra PostgreSQL real**.
- Regresiones correctas: `imei-search-qc-details.test.mjs`, `mobile-workspace.test.mjs`, `navigation-performance.test.mjs`.
- TypeScript móvil y web correctos. ESLint de los archivos nuevos del servidor sin errores; móvil sin errores y una advertencia previa del icono de las pestañas.
- **Build Web correcto** con `npm run build -- --webpack`. Se generaron las tres rutas nuevas sin alterar el esquema de la base de datos.
- **Build Android release correcto**, ARM64 y x86_64. La actualización fue aceptada mediante `adb install -r` en el emulador Android 16; `versionCode=6`, mínimo API 24, objetivo API 36.
- HTTP local: `/login` devuelve 200; las tres rutas nuevas devuelven JSON 401 sin sesión, con `private, no-store`.
- El lockfile móvil no contiene paquetes Expo/EAS. El bundle de la APK no contiene los nombres de las claves secretas del servidor comprobadas.

## Errores o pendientes

1. Autorización recibida: publicar exclusivamente los archivos de esta entrega sobre el último `main`, sin sobrescribir cambios ajenos. La comprobación final del despliegue se registra en la evidencia de entrega.
2. Esquema remoto verificado. Completar smoke test autenticado de lectura después del despliegue.
3. Probar el formulario y la cámara en Samsung A17. La instalación y las pruebas de componentes no acreditan una validación visual del formulario en Android.
4. El guardado real y la lectura posterior requieren un equipo de prueba autorizado. No se ha creado una revisión ni subido una foto real para QA.
5. Completar el resto del módulo QC en entregas posteriores; los otros módulos siguen en consulta nativa y operaciones Web.
6. La APK usa firma de prueba. El enlace LAN requiere servidor/PC y red disponibles; el script está preparado para preview.6, pero esta entrega no anuncia todavía un enlace activo para la revisión real.

## Comandos de verificación

```powershell
npm run mobile:v2:check
npm run mobile:v2:test
npm --prefix apps/mobile run lint
node scripts/mobile-qc.test.mjs
node scripts/imei-search-qc-details.test.mjs
node scripts/mobile-workspace.test.mjs
node scripts/navigation-performance.test.mjs
npx tsc --noEmit --pretty false
npm run build -- --webpack
npm run mobile:v2:build
```

El archivo final de prueba se encuentra en `artifacts/mobile-v2/SDigitalCore-MobileV2-2.0.0-preview.6.apk`; el SHA-256 se genera junto a la APK en el archivo `.apk.sha256`.

APK final: 45,751,445 bytes. SHA-256: `129d8df748b08b6cf459b45ab91eaf02badcc4110480bfc8e496d744bf86d674`. Actualización final aceptada con `adb install -r`; metadatos Android confirman versión 6. Evidencia resumida: `artifacts/mobile-v2/preview6-validation.json`.
