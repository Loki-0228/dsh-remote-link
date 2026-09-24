package com.dsh.remote;

import android.Manifest;
import android.app.*;
import android.content.*;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.*;
import android.provider.Settings;
import android.view.*;
import android.webkit.*;
import android.widget.*;
import org.json.*;

public class MainActivity extends Activity {
    private LinearLayout layout;
    private EditText link;
    private TextView status;
    private WebView web;
    private Button connect;
    private final Handler ui = new Handler(Looper.getMainLooper());
    private final java.util.concurrent.ExecutorService worker = java.util.concurrent.Executors.newSingleThreadExecutor();
    private String openedRequest = "";
    private final Runnable refresh = new Runnable() { public void run() { if (status != null) status.setText(ConnectionStore.prefs(MainActivity.this).getString("status", "尚未连接")); ui.postDelayed(this, 2000); } };

    @Override public void onCreate(Bundle state) {
        super.onCreate(state); getWindow().setStatusBarColor(0xfff7f8fb); getWindow().setNavigationBarColor(0xfff7f8fb);
        getWindow().getDecorView().setSystemUiVisibility(View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR | View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR);
        if (state != null) openedRequest = state.getString("openedRequest","");
        if (state != null && state.getBundle("remoteWeb") != null) openWeb(state.getBundle("remoteWeb"));
        else home();
        handleIntent(getIntent());
    }
    private int dp(int n) { return (int)(n * getResources().getDisplayMetrics().density); }
    private TextView text(String value, int size) { TextView v = new TextView(this); v.setText(value); v.setTextSize(size); v.setTextColor(0xff202734); v.setPadding(0, dp(8), 0, dp(8)); return v; }
    private Button button(String value, Runnable run) { Button b = new Button(this); b.setText(value); b.setAllCaps(false); b.setMinHeight(dp(48)); b.setOnClickListener(v -> run.run()); return b; }
    private void home() {
        if (web != null) { web.destroy(); web = null; }
        ScrollView scroll = new ScrollView(this); scroll.setFillViewport(true);
        layout = new LinearLayout(this); layout.setOrientation(LinearLayout.VERTICAL); layout.setPadding(dp(24), dp(24), dp(24), dp(24)); layout.setBackgroundColor(0xfff7f8fb);
        scroll.addView(layout); setContentView(scroll);
        scroll.setOnApplyWindowInsetsListener((v, insets) -> { v.setPadding(insets.getSystemWindowInsetLeft(), insets.getSystemWindowInsetTop(), insets.getSystemWindowInsetRight(), insets.getSystemWindowInsetBottom()); return insets; });
        layout.addView(text("DSH Remote", 28)); layout.addView(text("接收电脑上的任务进度、审批与提问。", 16));
        status = text(ConnectionStore.prefs(this).getString("status", "尚未连接"), 16); layout.addView(status);
        if (!ConnectionStore.base(this).isEmpty()) layout.addView(text(ConnectionStore.base(this), 14));
        layout.addView(text("电脑上的「远程链接」生成配对链接后，粘贴到这里。也可在手机浏览器中将链接分享给 DSH Remote。", 15));
        link = new EditText(this); link.setHint("粘贴完整配对链接"); link.setInputType(android.text.InputType.TYPE_CLASS_TEXT | android.text.InputType.TYPE_TEXT_VARIATION_URI); link.setSingleLine(true); link.setMinHeight(dp(56)); layout.addView(link);
        connect = button("配对并接收通知", this::pair); layout.addView(connect);
        layout.addView(button("继续接收通知", this::enable));
        layout.addView(button("查看待审批与提问", () -> showPending("")));
        layout.addView(button("打开远程会话", this::openWeb));
        layout.addView(button("通知设置", () -> startActivity(new Intent(this, NotificationSettingsActivity.class))));
        layout.addView(button("通知权限设置", () -> startActivity(new Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS).putExtra(Settings.EXTRA_APP_PACKAGE, getPackageName()))));
        layout.addView(button("电池与后台设置", () -> startActivity(new Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS))));
        layout.addView(button("停止接收通知", () -> { ConnectionStore.prefs(this).edit().putBoolean("enabled", false).putString("status", "已停止接收通知").apply(); stopService(new Intent(this, NotificationService.class)); status.setText("已停止接收通知"); }));
        layout.addView(text("启用后，通知栏会显示连接状态。电脑需保持运行；外网访问需开启隧道。系统强行停止应用后，请重新打开并点击继续接收。", 14));
    }
    private void error(String message) { if (!isFinishing()) new AlertDialog.Builder(this).setTitle("DSH Remote").setMessage(message).setPositiveButton("知道了", null).show(); }
    private void pair() {
        String value = link.getText().toString().trim(); Uri url = Uri.parse(value);
        if (!url.isHierarchical()) { error("链接无效，请粘贴完整配对链接。"); return; }
        String scheme = url.getScheme(), host = url.getHost(), token = url.getQueryParameter("pair");
        if (!("http".equals(scheme) || "https".equals(scheme)) || host == null || url.getUserInfo() != null || token == null || token.isEmpty()) { error("链接无效。请从电脑的远程链接面板复制完整配对链接。"); return; }
        String base = scheme + "://" + url.getEncodedAuthority();
        Runnable submit = () -> {
            connect.setEnabled(false); status.setText("正在配对…");
            worker.execute(() -> { try {
                JSONObject result = Api.call(base + "/api/pair/accept", "", new JSONObject().put("token", token));
                String device = result.getString("deviceId");
                Api.call(base + "/api/remote-notifications/poll?wait=0", device, null);
                stopService(new Intent(this, NotificationService.class)); ConnectionStore.save(this, base, device);
                ui.post(() -> { home(); enable(); });
            } catch (Exception e) { ui.post(() -> { connect.setEnabled(true); status.setText("配对失败"); error(e instanceof Api.Failure && ((Api.Failure)e).status == 503 ? "电脑未启用原生通知，请用新版 DSH-Web.exe 启动。" : "无法配对。请确认网络可达，并在电脑上刷新配对链接。"); }); } });
        };
        if ("http".equals(scheme)) new AlertDialog.Builder(this).setTitle("此连接未加密").setMessage("HTTP 会明文传输设备凭据与审批内容。仅在可信网络使用；外网建议配置 HTTPS 地址。是否连接？").setNegativeButton("取消", null).setPositiveButton("连接", (d,w) -> submit.run()).show();
        else submit.run();
    }
    private void enable() {
        try { if (ConnectionStore.device(this).isEmpty()) { error("请先配对电脑。"); return; } } catch (Exception e) { error("设备凭据无法读取，请重新配对。"); return; }
        if (Build.VERSION.SDK_INT >= 33 && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) { requestPermissions(new String[]{Manifest.permission.POST_NOTIFICATIONS}, 1); return; }
        if (!getSystemService(NotificationManager.class).areNotificationsEnabled()) { error("通知权限已关闭，请先在通知权限设置中启用。"); return; }
        ConnectionStore.prefs(this).edit().putBoolean("enabled", true).apply(); startForegroundService(new Intent(this, NotificationService.class));
    }
    @Override public void onRequestPermissionsResult(int request, String[] permissions, int[] results) { super.onRequestPermissionsResult(request, permissions, results); if (request == 1 && results.length > 0 && results[0] == PackageManager.PERMISSION_GRANTED) enable(); else error("未获得通知权限。可在设置中开启后继续接收。"); }
    private void showPending(String wanted) {
        worker.execute(() -> { try {
            JSONObject result = Api.call(ConnectionStore.base(this) + "/api/remote-notifications/poll?wait=0", ConnectionStore.device(this), null);
            JSONArray requests = result.getJSONArray("pending");
            ui.post(() -> {
                if (requests.length() == 0) { error("当前没有待审批或待回答的请求。"); return; }
                for (int i=0; i<requests.length(); i++) if (requests.optJSONObject(i).optString("id").equals(wanted)) { review(requests.optJSONObject(i)); return; }
                if (!wanted.isEmpty()) { error("这条请求已处理或已取消。"); return; }
                String[] titles = new String[requests.length()]; for(int i=0;i<titles.length;i++) titles[i] = requests.optJSONObject(i).optString("title") + " · " + requests.optJSONObject(i).optString("sessionId");
                new AlertDialog.Builder(this).setTitle("待处理请求").setItems(titles, (d,w) -> review(requests.optJSONObject(w))).setNegativeButton("关闭",null).show();
            });
        } catch (Exception e) { ui.post(() -> error("无法读取待处理请求。请确认连接状态。")); } });
    }
    private void review(JSONObject request) {
        AlertDialog.Builder dialog = new AlertDialog.Builder(this).setTitle(request.optString("title"))
            .setMessage(request.optString("body") + "\n\n会话：" + request.optString("sessionId"));
        if ("approval".equals(request.optString("kind"))) {
            dialog.setPositiveButton("允许本次", (d,w) -> new AlertDialog.Builder(this).setTitle("确认审批").setMessage("确认允许刚才显示的操作执行一次？").setNegativeButton("取消", null).setPositiveButton("允许", (x,y) -> respond(request, "allowed-once")).show());
            dialog.setNegativeButton("拒绝", (d,w) -> respond(request, "rejected")); dialog.setNeutralButton("稍后",null);
        } else { dialog.setPositiveButton("打开会话回答", (d,w) -> openWeb()); dialog.setNegativeButton("稍后",null); }
        dialog.show();
    }
    private void respond(JSONObject request, String value) {
        worker.execute(() -> { try {
            Api.call(ConnectionStore.base(this) + "/api/remote-notifications/respond", ConnectionStore.device(this), new JSONObject().put("id",request.getString("id")).put("value",value));
            getSystemService(NotificationManager.class).cancel(request.getString("id"),2);
            ui.post(() -> Toast.makeText(this,"审批已提交",Toast.LENGTH_SHORT).show());
        } catch (Exception e) { ui.post(() -> error(e instanceof Api.Failure && ((Api.Failure)e).status == 409 ? "请求已处理或取消。" : "提交失败，请确认连接后重试。")); } });
    }
    private void fitWindow(View root) {
        root.setOnApplyWindowInsetsListener((v,insets) -> {
            if (Build.VERSION.SDK_INT >= 30) {
                android.graphics.Insets safe = insets.getInsets(WindowInsets.Type.systemBars() | WindowInsets.Type.displayCutout() | WindowInsets.Type.ime());
                v.setPadding(safe.left,safe.top,safe.right,safe.bottom);
            } else v.setPadding(insets.getSystemWindowInsetLeft(),insets.getSystemWindowInsetTop(),insets.getSystemWindowInsetRight(),insets.getSystemWindowInsetBottom());
            return insets;
        });
        root.requestApplyInsets();
    }
    private void openWeb() { openWeb(null); }
    private void openWeb(Bundle savedWeb) {
        try {
            String base = ConnectionStore.base(this), device = ConnectionStore.device(this); if (base.isEmpty() || device.isEmpty()) { error("请先配对电脑。"); return; }
            if (web != null) { web.destroy(); web = null; }
            status = null;
            LinearLayout shell = new LinearLayout(this); shell.setOrientation(LinearLayout.VERTICAL); shell.setBackgroundColor(0xfff7f8fb);
            LinearLayout toolbar = new LinearLayout(this); toolbar.setGravity(Gravity.CENTER_VERTICAL);
            toolbar.addView(button("返回",this::home),new LinearLayout.LayoutParams(-2,dp(48)));
            TextView heading = text("远程会话",16); heading.setPadding(dp(12),0,0,0); toolbar.addView(heading,new LinearLayout.LayoutParams(0,dp(48),1));
            shell.addView(toolbar,new LinearLayout.LayoutParams(-1,dp(48)));
            web = new WebView(this); web.getSettings().setJavaScriptEnabled(true); web.getSettings().setDomStorageEnabled(true); web.getSettings().setUseWideViewPort(true); web.getSettings().setLoadWithOverviewMode(true);
            web.getSettings().setAllowFileAccess(false); web.getSettings().setAllowContentAccess(false); web.getSettings().setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
            web.setWebViewClient(new WebViewClient() {
                @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                    Uri uri = request.getUrl(); String origin = uri.getScheme() + "://" + uri.getEncodedAuthority();
                    if (base.equals(origin)) return false;
                    if ("https".equals(uri.getScheme()) || "http".equals(uri.getScheme())) try { startActivity(new Intent(Intent.ACTION_VIEW, uri)); } catch (Exception ignored) {}
                    return true;
                }
                @Override public void onReceivedError(WebView view, WebResourceRequest req, WebResourceError err) { if (req.isForMainFrame()) error("远程页面加载失败，请检查网络后重新打开。"); }
            });
            shell.addView(web,new LinearLayout.LayoutParams(-1,0,1)); setContentView(shell);
            fitWindow(shell);
            if (savedWeb == null || web.restoreState(savedWeb) == null) web.loadUrl(base + "/pair-app?device=" + Uri.encode(device));
        } catch (Exception e) { error("无法打开会话，请重新配对。"); }
    }
    private void handleIntent(Intent intent) {
        if (Intent.ACTION_SEND.equals(intent.getAction())) { String value=intent.getStringExtra(Intent.EXTRA_TEXT); if(value!=null) { if(web!=null) home(); link.setText(value.trim()); } }
        String eventJson=intent.getStringExtra("notification");
        intent.removeExtra("notification");
        String request=intent.getStringExtra("requestId");
        if(eventJson!=null && (request==null || request.isEmpty())) {
            try {
                JSONObject event=new JSONObject(eventJson);
                String title=NotificationText.title(event.optString("kind"),event.optString("taskTitle"),event.optString("title"),event.optString("sessionId"));
                String body=NotificationText.body(event.optString("kind"),event.optString("summary"),event.optString("body"),false);
                String session=event.optString("sessionId");
                new AlertDialog.Builder(this).setTitle(title).setMessage(body+(session.isEmpty() ? "" : "\n\n会话："+session))
                    .setPositiveButton("打开远程会话",(d,w)->openWeb()).setNegativeButton("关闭",null).show();
            } catch(JSONException ignored) {}
        } if(request!=null && !request.isEmpty() && !request.equals(openedRequest)) { openedRequest=request; showPending(request); }
    }
    @Override public void onConfigurationChanged(android.content.res.Configuration config) {
        super.onConfigurationChanged(config);
        if (web != null) { web.requestLayout(); web.invalidate(); }
        getWindow().getDecorView().requestApplyInsets();
    }
    @Override protected void onSaveInstanceState(Bundle state) {
        super.onSaveInstanceState(state); state.putString("openedRequest",openedRequest);
        if (web != null) { Bundle savedWeb=new Bundle(); web.saveState(savedWeb); state.putBundle("remoteWeb",savedWeb); }
    }
    @Override protected void onNewIntent(Intent intent) { super.onNewIntent(intent); setIntent(intent); handleIntent(intent); }
    @Override protected void onResume() { super.onResume(); ui.post(refresh); }
    @Override protected void onPause() { ui.removeCallbacks(refresh); super.onPause(); }
    @Override public void onBackPressed() { if(web!=null) { if(web.canGoBack()) web.goBack(); else home(); } else super.onBackPressed(); }
    @Override protected void onDestroy() { ui.removeCallbacksAndMessages(null); if(web!=null) web.destroy(); worker.shutdownNow(); super.onDestroy(); }
}
