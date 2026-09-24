package com.dsh.remote;

import android.app.*;
import android.content.*;
import android.content.pm.ActivityInfo;
import android.content.res.Configuration;
import android.os.*;
import android.graphics.Bitmap;
import android.service.notification.StatusBarNotification;
import android.view.*;
import android.webkit.WebView;
import android.widget.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicReference;
import java.lang.reflect.*;
import org.json.*;

public class RegressionInstrumentation extends Instrumentation {
    private Context context;
    private NotificationManager manager;
    private MainActivity main;
    private final String base="http://127.0.0.1:48775";
    private int checks;
    private void check(boolean value,String message) { if(!value)throw new AssertionError(message);checks++; }
    interface Check { boolean run() throws Exception; }
    private void until(Check check) throws Exception {
        long end=System.currentTimeMillis()+10000;
        while(!check.run()) { if(System.currentTimeMillis()>end)throw new AssertionError("Timed out");Thread.sleep(100); }
    }
    private void invoke(Object target,String method) {
        try { Method m=target.getClass().getDeclaredMethod(method); m.setAccessible(true);m.invoke(target); }
        catch(Exception e){throw new RuntimeException(e);}
    }
    private WebView web() throws Exception {
        Field field=MainActivity.class.getDeclaredField("web");field.setAccessible(true);return (WebView)field.get(main);
    }
    private String js(String script) throws Exception {
        CountDownLatch done=new CountDownLatch(1);AtomicReference<String> value=new AtomicReference<>();
        WebView view=web();runOnMainSync(()->view.evaluateJavascript(script,result->{value.set(result);done.countDown();}));
        if(!done.await(5,TimeUnit.SECONDS))throw new AssertionError("JavaScript callback missing");return value.get();
    }
    private void emit(String kind,String title) throws Exception {
        Api.call(base+"/emit","emulator-test",new JSONObject().put("kind",kind).put("title","DeepSeek 本轮已结束")
            .put("taskTitle",title).put("summary","报表已导出，共 120 行。").put("body","报表已导出，共 120 行。文件：report.csv。")
            .put("sessionId","test-session").put("id",title));
    }
    private StatusBarNotification find(String text) {
        for(StatusBarNotification n:manager.getActiveNotifications())
            if(n.getNotification().extras.getString(Notification.EXTRA_TITLE,"").contains(text))return n;
        return null;
    }
    private View findView(View root,String label) {
        if(root instanceof TextView && label.contentEquals(((TextView)root).getText()))return root;
        if(root instanceof ViewGroup)for(int i=0;i<((ViewGroup)root).getChildCount();i++){
            View found=findView(((ViewGroup)root).getChildAt(i),label);if(found!=null)return found;
        }
        return null;
    }
    private void screenshot(String name) throws Exception {
        Bitmap image=getUiAutomation().takeScreenshot();
        try(java.io.FileOutputStream out=new java.io.FileOutputStream(new java.io.File(context.getExternalFilesDir(null),name))) {
            image.compress(Bitmap.CompressFormat.PNG,100,out);
        } image.recycle();
    }
    @Override public void onCreate(Bundle args) { super.onCreate(args);start(); }
    @Override public void onStart() {
        Bundle result=new Bundle();
        try {
            context=getTargetContext();manager=context.getSystemService(NotificationManager.class);
            // This runner is invoked only on the disposable emulator named by test-device.ps1.
            context.stopService(new Intent(context,NotificationService.class));
            ConnectionStore.save(context,base,"emulator-test");
            NotificationPreferences.prefs(context).edit().clear().commit();
            main=(MainActivity)startActivitySync(new Intent(context,MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK));
            context.startForegroundService(new Intent(context,NotificationService.class));
            emit("task-completed","导出季度报表");
            until(()->find("导出季度报表")!=null);
            StatusBarNotification completed=find("导出季度报表");
            check(completed.getNotification().extras.getString(Notification.EXTRA_TEXT).equals("报表已导出，共 120 行。"),"brief summary");
            check("tasks".equals(completed.getNotification().getChannelId()),"native task channel");
            check(completed.getNotification().publicVersion!=null,"private lock screen");
            Activity settings=startActivitySync(new Intent(context,NotificationSettingsActivity.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK));
            AtomicReference<View> toggle=new AtomicReference<>();
            runOnMainSync(()->toggle.set(findView(settings.getWindow().getDecorView(),"任务结束")));
            check(toggle.get() instanceof Switch,"completion switch exists");
            runOnMainSync(()->toggle.get().performClick());
            until(()->find("导出季度报表")==null);
            check(!NotificationPreferences.enabled(context,"task-completed"),"switch saves and removes old notifications");
            emit("task-completed","应被过滤");emit("approval","审批应保留");
            until(()->find("审批应保留")!=null);
            check(find("应被过滤")==null,"disabled event type is filtered");
            check("attention".equals(find("审批应保留").getNotification().getChannelId()),"approval uses native attention channel");
            runOnMainSync(()->{
                View brief=findView(settings.getWindow().getDecorView(),"简略通知");brief.performClick();
            });
            check(!NotificationPreferences.brief(context),"brief switch persists");
            getUiAutomation().waitForIdle(500,5000); screenshot("notification-settings.png");
            runOnMainSync(settings::finish);waitForIdleSync();
            ConnectionStore.save(context,base,"emulator-test");
            check(!NotificationPreferences.enabled(context,"task-completed"),"re-pair preserves notification choices");
            context.stopService(new Intent(context,NotificationService.class)); manager.cancelAll();
            runOnMainSync(()->invoke(main,"openWeb"));
            until(()->web()!=null && js("document.readyState").equals("\"complete\"") && js("!!document.getElementById('draft')").equals("true"));
            WebView original=web();
            js("document.getElementById('draft').value='旋转后保留这段草稿';window.instance");
            String instance=js("window.instance");
            runOnMainSync(()->main.setRequestedOrientation(ActivityInfo.SCREEN_ORIENTATION_LANDSCAPE));
            until(()->main.getResources().getConfiguration().orientation==Configuration.ORIENTATION_LANDSCAPE && original.getWidth()>original.getHeight());
            check(web()==original,"rotation keeps WebView instance");
            check(js("document.getElementById('draft').value").contains("旋转后保留"),"draft preserved");
            check(js("window.instance").equals(instance),"page not reloaded");
            check(original.getHeight()>200,"landscape has usable content height");
            getUiAutomation().waitForIdle(500,5000); screenshot("remote-landscape.png");
            runOnMainSync(()->main.setRequestedOrientation(ActivityInfo.SCREEN_ORIENTATION_PORTRAIT));
            until(()->main.getResources().getConfiguration().orientation==Configuration.ORIENTATION_PORTRAIT && original.getWidth()<original.getHeight() && js("innerWidth<innerHeight").equals("true"));
            check(web()==original && js("window.instance").equals(instance),"return to portrait keeps page");
            getUiAutomation().waitForIdle(500,5000); screenshot("remote-portrait.png");
            context.stopService(new Intent(context,NotificationService.class));manager.cancelAll();
            result.putString("stream",checks+" Android integration checks passed\n");
            finish(Activity.RESULT_OK,result);
        } catch(Throwable e) {
            result.putString("stream",android.util.Log.getStackTraceString(e));finish(Activity.RESULT_CANCELED,result);
        }
    }
}