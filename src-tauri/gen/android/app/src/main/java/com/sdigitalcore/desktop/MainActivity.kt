package com.sdigitalcore.desktop

import android.Manifest
import android.content.pm.PackageManager
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.util.Log
class MainActivity : TauriActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        prepareNotificationIntent(intent)
        super.onCreate(savedInstanceState)
        Handler(Looper.getMainLooper()).postDelayed({ requestLocationPermissionIfNeeded() }, 900)
    }

    override fun onNewIntent(intent: Intent) {
        prepareNotificationIntent(intent)
        setIntent(intent)
        super.onNewIntent(intent)
    }

    private fun prepareNotificationIntent(intent: Intent?) {
        val notificationIntent = intent ?: return
        val route = notificationIntent.getStringExtra("route")
            ?: notificationIntent.getStringExtra("data.route")
            ?: notificationIntent.getStringExtra("gcm.n.route")
            ?: notificationIntent.data?.getQueryParameter("route")
            ?: return
        if (!route.startsWith("/") || route.startsWith("//")) {
            Log.w("NotificationTap", "Se rechazo una ruta no interna")
            return
        }

        notificationIntent.action = Intent.ACTION_VIEW
        notificationIntent.data = Uri.parse("sdigitalcore://notification")
            .buildUpon()
            .appendQueryParameter("route", route)
            .build()
        Log.i("NotificationTap", "Ruta FCM preparada para Tauri")
    }

    private fun requestLocationPermissionIfNeeded() {
        if (android.os.Build.VERSION.SDK_INT < android.os.Build.VERSION_CODES.M) return
        val fineGranted = checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED
        val coarseGranted = checkSelfPermission(Manifest.permission.ACCESS_COARSE_LOCATION) == PackageManager.PERMISSION_GRANTED
        if (!fineGranted && !coarseGranted) {
            requestPermissions(
                arrayOf(Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION),
                LOCATION_PERMISSION_REQUEST_CODE,
            )
        }
    }

    companion object {
        private const val LOCATION_PERMISSION_REQUEST_CODE = 401
    }
}
