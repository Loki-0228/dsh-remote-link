package com.dsh.remote;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.content.Context;

/** Stable channel IDs preserve sound choices made in Android settings. */
final class NotificationChannels {
    static void ensure(Context context) {
        NotificationManager manager = context.getSystemService(NotificationManager.class);
        if (manager.getNotificationChannel(NotificationService.CONNECTION) == null) {
            NotificationChannel channel = new NotificationChannel(NotificationService.CONNECTION, "后台连接", NotificationManager.IMPORTANCE_LOW);
            channel.setSound(null, null);
            manager.createNotificationChannel(channel);
        }
        if (manager.getNotificationChannel(NotificationService.TASKS) == null) {
            NotificationChannel channel = new NotificationChannel(NotificationService.TASKS, "任务开始、结束与错误", NotificationManager.IMPORTANCE_DEFAULT);
            channel.setDescription("任务开始、结束、错误和插件消息。");
            manager.createNotificationChannel(channel);
        }
        if (manager.getNotificationChannel(NotificationService.ATTENTION) == null) {
            NotificationChannel channel = new NotificationChannel(NotificationService.ATTENTION, "审批与提问", NotificationManager.IMPORTANCE_HIGH);
            channel.setDescription("需要人工审批或回答的问题。");
            manager.createNotificationChannel(channel);
        }
    }
}