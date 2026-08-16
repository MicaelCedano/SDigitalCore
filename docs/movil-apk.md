# APK Android de SDigitalCore

## Estado

La aplicación de escritorio usa Tauri 2 y carga la aplicación Next.js publicada en
Vercel. La misma base puede generar una aplicación Android, pero el proyecto todavía
no contiene el target Android generado porque el equipo de desarrollo debe tener un
Android SDK configurado.

## Inicialización local

Instalar Android Studio con Android SDK, Platform-Tools, Build-Tools y un JDK
compatible con la versión de Gradle instalada. Después configurar `ANDROID_HOME` o
`ANDROID_SDK_ROOT` apuntando al SDK y ejecutar:

```powershell
npm.cmd run mobile:android:init
npm.cmd run mobile:android:build
```

El APK se generará dentro de `src-tauri/gen/android/app/build/outputs/apk/`.

## Notificaciones

La APK por sí sola no convierte las notificaciones internas de la web en push del
sistema operativo. La segunda fase debe registrar el dispositivo autenticado y
conectarlo a un proveedor push nativo, preferiblemente Firebase Cloud Messaging
(FCM). Las credenciales del proveedor deben permanecer únicamente en el servidor.

El flujo previsto es:

1. El usuario inicia sesión en la APK.
2. Android entrega un token FCM al dispositivo.
3. La aplicación registra el token en `POST /api/mobile/push-token` después del login.
4. El servidor guarda el token asociado al usuario, plataforma y fecha de último uso.
5. Cuando ocurre una alerta relevante, el servidor envía el push al token correspondiente.
6. Al tocar la alerta, la APK abre la ruta interna relacionada.

### Configuración Firebase pendiente

La integración nativa usa `tauri-plugin-fcm`. Para activar el registro real del
dispositivo hace falta crear una aplicación Android en Firebase con el identificador
`com.sdigitalcore.desktop` y descargar `google-services.json`. Ese archivo debe
colocarse localmente en:

```text
src-tauri/gen/android/app/google-services.json
```

No se debe subir ese archivo al repositorio sin revisar la política del proyecto
Firebase. El build Android también debe aplicar el plugin Google Services en el
proyecto Gradle generado.

La migración
`prisma/migrations/20260816170000_add_push_devices/migration.sql` debe aplicarse
manualmente en Supabase antes de probar el registro de tokens en producción.

No se agregan todavía tablas ni credenciales de producción. La inicialización del
target Android y la integración FCM deben validarse en un teléfono Android real.
