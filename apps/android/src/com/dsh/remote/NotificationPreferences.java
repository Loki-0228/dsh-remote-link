package com.dsh.remote;

import android.app.NotificationManager;
import android.content.Context;
import android.content.SharedPreferences;
import android.service.notification.StatusBarNotification;

final class NotificationPreferences {
    static final String EXTRA_KIND = "dsh.notification.kind";
    static final String[] KINDS = {"task-started","task-completed","task-failed","approval","question","info"};
    static SharedPreferences prefs(Context c) { return c.getSharedPreferences("notification-preferences", Context.MODE_PRIVATE); }
    static boolean enabled(Context c, String kind) { return prefs(c).getBoolean("show." + NotificationText.kind(kind), true); }
    static boolean brief(Context c) { return prefs(c).getBoolean("brief", true); }
    static void setEnabled(Context c, String kind, boolean enabled) {
        prefs(c).edit().putBoolean("show." + kind, enabled).apply();
        if (!enabled) {
            NotificationManager manager = c.getSystemService(NotificationManager.class);
            for (StatusBarNotification active : manager.getActiveNotifications())
                if (kind.equals(active.getNotification().extras.getString(EXTRA_KIND))) manager.cancel(active.getTag(),active.getId());
        }
    }
}