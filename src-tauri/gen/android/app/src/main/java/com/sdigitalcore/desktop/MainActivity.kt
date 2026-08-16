package com.sdigitalcore.desktop

import android.content.Intent
import android.net.Uri
import android.os.Bundle
class MainActivity : TauriActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        prepareNotificationIntent(intent)
        super.onCreate(savedInstanceState)
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
}
