# Integración privada de SDigitalCore con ChatGPT

## Qué incluye

La API ofrece consultas bajo demanda para IMEI, solicitudes de Almacén y avance de revisión QC. La aprobación o el rechazo de una solicitud es la única operación que escribe datos. No hay sincronización programada ni lectura masiva en segundo plano.

La API usa los Route Handlers de Next.js y el Prisma ya configurado por Core. No añade un proveedor de IA, una base de datos, migraciones ni una dependencia pagada. Cada respuesta se limita al registro solicitado o a un máximo de 25 solicitudes/lotes.

## Herramientas expuestas

| Herramienta | Ruta | Acceso |
|---|---|---|
| Consultar IMEI y revisores QC | `GET /api/chatgpt/v1/imei?imei=...` | Solo IMEI de 15 dígitos; devuelve hasta 20 inspecciones vigentes |
| Listar solicitudes de Almacén | `GET /api/chatgpt/v1/warehouse/requests?status=PENDING&limit=15` | Predeterminado: pendientes; máximo 25 |
| Aprobar o rechazar solicitud | `POST /api/chatgpt/v1/warehouse/requests/{id}/decision` | Requiere código exacto, actor ADMIN activo, estado pendiente y stock válido |
| Consultar avance de compra/QC | `GET /api/chatgpt/v1/purchases/progress?query=...` | El porcentaje es revisados QC / total del lote, no avance monetario |

La API consulta únicamente esas entidades. No permite consultas SQL libres, lectura de todas las tablas ni exportación de la base.

## Costos y límites de la suscripción

SDigitalCore no llama a la API de OpenAI, así que no genera cargos de API ni sincroniza información automáticamente. ChatGPT solo solicita datos cuando se usa una herramienta. Esa conexión sí requiere internet, transfiere los datos devueltos y cuenta dentro de los límites normales de uso de ChatGPT; una conexión remota con transferencia cero no es posible.

La suscripción ChatGPT Plus no incluye facturación de la API, y ambas se cobran por separado. Esta integración evita la API pagada. OpenAI documenta que ChatGPT Sites está disponible en planes Plus y Pro dentro de límites específicos del plan, y que los plugins alojados en un Site pueden usar herramientas MCP. La cuenta personal puede usar esa vía sin crear un GPT personalizado. La disponibilidad y los límites dependen de lo que muestre tu cuenta.

Referencias oficiales: [crear y usar ChatGPT Sites](https://help.openai.com/en/articles/20001339-creating-and-using-chatgpt-sites), [alojar un plugin con ChatGPT Sites](https://help.openai.com/en/articles/20001547-hosting-a-plugin-with-chatgpt-sites), [configurar Actions](https://help.openai.com/en/articles/9442513) y [facturación de ChatGPT y la API](https://help.openai.com/en/articles/9039756-managing-billing-for-chatgpt-and-the-api-platform).

## Variables privadas

Configurar en el entorno del servidor y en Vercel cuando se publique:

- `CHATGPT_API_KEY`: token aleatorio de al menos 32 caracteres. Mantenerlo fuera del navegador y del repositorio.
- `CHATGPT_SITES_TOKEN`: token aleatorio de al menos 32 caracteres, exclusivo para el puente MCP alojado en ChatGPT Sites. Puede configurarse junto a `CHATGPT_API_KEY`; ambos se comparan en tiempo constante.
- `CHATGPT_ACTOR_USER_ID`: ID de una cuenta `ADMIN` activa de Core. Esa cuenta aparece como actor en auditoría.

Para generar un token localmente, ejecuta `node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"` y guarda el resultado directamente en el administrador de contraseñas y en las variables privadas. No lo pegues en conversaciones, documentos ni logs.

La API responde `503` hasta que ambas variables estén configuradas y el usuario siga activo con rol ADMIN. Si se rota la clave, actualizar también la credencial de la Action en ChatGPT.

## Conectar ChatGPT

1. Publicar la aplicación existente en HTTPS y configurar `CHATGPT_API_KEY`, `CHATGPT_ACTOR_USER_ID` y, para el plugin de Sites, `CHATGPT_SITES_TOKEN` como variables privadas.
2. Crear el Site privado `SDigitalCore Reportes` y alojar allí un servidor MCP puente. El puente llama a `https://TU-DOMINIO-DE-SDIGITALCORE/api/chatgpt/mcp` desde el servidor usando `CHATGPT_SITES_TOKEN`; guarda ese valor como secreto del entorno del Site, nunca en el navegador ni en el código fuente.
3. Publicar el Site como privado para que ChatGPT cree su plugin MCP, y conectar/instalar el plugin en la cuenta propietaria.
4. Probar primero `tools/list`; después, con una consulta expresamente solicitada, verificar una lectura de IMEI o solicitudes.
5. Para aprobar/rechazar, ChatGPT debe presentar los detalles de la solicitud y esperar confirmación explícita para esa solicitud. El servidor comprueba otra vez estado, código, inventario y actor antes de escribir.

Como alternativa, [`chatgpt-openapi.yaml`](./chatgpt-openapi.yaml) describe las mismas operaciones para GPT Actions en una cuenta que tenga acceso a editar un GPT con Actions.

No se usa OpenAI API desde SDigitalCore. ChatGPT consulta la API de Core solo cuando se invoca una herramienta. Cada llamada requiere conexión a internet y transmite los campos devueltos por la consulta; no existe una manera de tener respuesta remota con cero transferencia de datos.

## Seguridad de aprobación

La Action compara el código enviado con el código real de la solicitud. El servidor solo procesa registros `PENDING`; la transición y los movimientos de inventario ocurren dentro de una transacción. Las salidas vuelven a validar el stock. Dos aprobaciones simultáneas no pueden procesar la misma solicitud. Se añade auditoría con `source: chatgpt`, y se conserva el aviso al solicitante.

La clave está vinculada a un `ADMIN` configurado, así que el GPT debe permanecer privado. Si más usuarios van a usarlo, conviene sustituir este acceso de propietario por OAuth individual antes de compartirlo.

## Límites actuales

Core no tiene un modelo de orden de compra financiera separado en este alcance. La herramienta de avance consulta `QcRevisionBatch`; por eso informa el porcentaje de equipos revisados QC y no el monto comprado, pagado o recibido en dinero.

Las solicitudes de cambios en producción, configuración de variables Vercel y publicación del GPT se completan por separado. No se ejecutan migraciones ni se escriben registros durante una consulta de lectura.
