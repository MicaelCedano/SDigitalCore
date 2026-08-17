package com.sdigitalcore.desktop

import android.Manifest
import android.content.pm.PackageManager
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.os.Handler
import android.os.Looper
class MainActivity : TauriActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        prepareNotificationIntent(intent)
        super.onCreate(savedInstanceState)
        Handler(Looper.getMainLooper()).postDelayed({ requestLocationPermissionIfNeeded() }, 900)
    }

    override fun onNewIntent(intent: Intent) {
        prepareNotificationIntent(intent)
        super.onNewIntent(intent)
    }

    private fun prepareNotificationIntent(intent: Intent?) {
        val route = intent?.getStringExtra("route") ?: return
        if (!route.startsWith("/") || route.startsWith("//")) return
        intent.data = Uri.parse("sdigitalcore://notification")
            .buildUpon()
            .appendQueryParameter("route", route)
            .build()
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
