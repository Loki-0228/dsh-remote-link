package com.dsh.remote;

import android.app.*;
import android.content.*;
import android.os.*;
import org.json.*;
import java.util.*;

public class NotificationService extends Service {
    private volatile boolean stopped;
    private Thread worker;
    private NotificationManager manager;
    private Set<String> previousPending = new HashSet<>();
    private String lastStatus = "";
    static final String CONNECTION = "connection", TASKS = "tasks", ATTENTION = "attention";

    @Override public void onCreate() {
        super.onCreate(); manager = getSystemService(NotificationManager.class);
        NotificationChannels.ensure(this);
    }
    private PendingIntent open(String id) {
        Intent intent = new Intent(this, MainActivity.class).putExtra("requestId", id).addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        return PendingIntent.getActivity(this, id.hashCode(), intent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }
    private Notification connection(String text) {
        PendingIntent stop = PendingIntent.getService(this, 0, new Intent(this, NotificationService.class).setAction("stop"), PendingIntent.FLAG_IMMUTABLE);
        return new Notification.Builder(this, CONNECTION).setSmallIcon(R.drawable.ic_notification).setContentTitle("DSH Remote")
            .setContentText(text).setContentIntent(open("")).setOngoing(true).setOnlyAlertOnce(true)
            .addAction(new Notification.Action.Builder(null, "停止接收", stop).build()).build();
    }
    private void status(String text) {
        ConnectionStore.prefs(this).edit().putString("status", text).apply();
        if (!text.equals(lastStatus)) { lastStatus = text; manager.notify(1, connection(text)); }
    }
    @Override public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent != null && "stop".equals(intent.getAction())) {
            ConnectionStore.prefs(this).edit().putBoolean("enabled", false).putString("status", "已停止接收通知").apply(); stopSelf(); return START_NOT_STICKY;
        }
        if (!ConnectionStore.prefs(this).getBoolean("enabled", false) || ConnectionStore.base(this).isEmpty()) { stopSelf(); return START_NOT_STICKY; }
        startForeground(1, connection("正在连接电脑…"));
        if (worker == null) { worker = new Thread(this::poll, "dsh-notifications"); worker.start(); }
        return START_STICKY;
    }
    private void poll() {
        String base = ConnectionStore.base(this);
        int delay = 3000;
        while (!stopped && base.equals(ConnectionStore.base(this))) {
            try {
                String device = ConnectionStore.device(this);
                if (device.isEmpty()) break;
                android.content.SharedPreferences prefs = ConnectionStore.prefs(this);
                String epoch = prefs.getString("epoch", ""); long cursor = prefs.getLong("cursor", 0);
                JSONObject snapshot = Api.call(base + "/api/remote-notifications/poll?epoch=" + epoch + "&after=" + cursor, device, null);
                if (stopped || !base.equals(ConnectionStore.base(this))) break;
                deliver(snapshot);
                prefs.edit().putString("epoch", snapshot.getString("epoch")).putLong("cursor", snapshot.getLong("cursor"))
                    .putString("snapshot", snapshot.toString()).apply();
                status("已连接 · 正在接收任务通知"); delay = 3000;
            } catch (Api.Failure e) {
                if (e.status == 401 || e.status == 403) {
                    ConnectionStore.prefs(this).edit().remove("device").putBoolean("enabled", false).putString("status", "设备授权已失效，请重新配对").apply();
                    for (String id : previousPending) manager.cancel(id, 2);
                    manager.notify("auth", 2, new Notification.Builder(this, ATTENTION).setSmallIcon(R.drawable.ic_notification).setContentTitle("DSH 设备授权已失效").setContentText("打开应用重新配对").setContentIntent(open("")).setAutoCancel(true).build());
                    stopSelf(); return;
                }
                status(e.status == 503 ? "电脑尚未启用原生通知，正在重试" : "连接失败，正在重试");
                if (!pause(delay)) return; delay = Math.min(60000, delay * 2);
            } catch (Exception e) {
                status("电脑离线或网络中断，正在重连");
                if (!pause(delay)) return; delay = Math.min(60000, delay * 2);
            }
        }
    }
    private boolean pause(int millis) { try { Thread.sleep(millis); return !stopped; } catch (InterruptedException e) { return false; } }
    private void deliver(JSONObject snapshot) throws Exception {
        Set<String> pending = new HashSet<>(); JSONArray requests = snapshot.getJSONArray("pending");
        for (int i = 0; i < requests.length(); i++) pending.add(requests.getJSONObject(i).getString("id"));
        for (String id : previousPending) if (!pending.contains(id)) manager.cancel(id, 2);
        JSONArray events = snapshot.getJSONArray("events"); Set<String> delivered = new HashSet<>();
        for (int i = 0; i < events.length(); i++) {
            JSONObject event = events.getJSONObject(i); String request = event.optString("requestId");
            if (!request.isEmpty() && !pending.contains(request)) continue;
            if (snapshot.optBoolean("reset") && request.isEmpty() && System.currentTimeMillis() - event.optLong("time") > 300000) continue;
            notifyEvent(event, request); if (!request.isEmpty()) delivered.add(request);
        }
        for (int i = 0; i < requests.length(); i++) {
            JSONObject request = requests.getJSONObject(i); String id = request.getString("id");
            if (!previousPending.contains(id) && !delivered.contains(id)) notifyEvent(request, id);
        }
        previousPending = pending;
    }
    private PendingIntent openEvent(JSONObject event, String request) {
        String id = request.isEmpty() ? event.optString("id") : request;
        Intent intent = new Intent(this, MainActivity.class).setData(android.net.Uri.parse("dsh-notification:/" + android.net.Uri.encode(id)))
            .putExtra("requestId",request).putExtra("notification",event.toString())
            .addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        return PendingIntent.getActivity(this,0,intent,PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }
    private void notifyEvent(JSONObject event, String request) {
        String kind = NotificationText.kind(event.optString("kind"));
        if (!NotificationPreferences.enabled(this,kind)) return;
        boolean attention = "approval".equals(kind) || "question".equals(kind);
        String title = NotificationText.title(kind,event.optString("taskTitle"),event.optString("title"),event.optString("sessionId"));
        String body = NotificationText.body(kind,event.optString("summary"),event.optString("body"),NotificationPreferences.brief(this));
        String tag = request.isEmpty() ? event.optString("id") : request;
        Notification publicView = new Notification.Builder(this, attention ? ATTENTION : TASKS).setSmallIcon(R.drawable.ic_notification)
            .setContentTitle("DSH 有新消息").setContentText("解锁后查看").build();
        Bundle extras = new Bundle(); extras.putString(NotificationPreferences.EXTRA_KIND,kind);
        manager.notify(tag, 2, new Notification.Builder(this, attention ? ATTENTION : TASKS).setSmallIcon(R.drawable.ic_notification)
            .setContentTitle(title).setContentText(body).setSubText(NotificationText.label(kind)).addExtras(extras)
            .setStyle(new Notification.BigTextStyle().bigText(body)).setContentIntent(openEvent(event,request))
            .setVisibility(Notification.VISIBILITY_PRIVATE).setPublicVersion(publicView).setOnlyAlertOnce(true).setAutoCancel(true).build());
    }
    @Override public void onDestroy() { stopped = true; if (worker != null) worker.interrupt(); stopForeground(STOP_FOREGROUND_REMOVE); super.onDestroy(); }
    @Override public IBinder onBind(Intent intent) { return null; }
}
