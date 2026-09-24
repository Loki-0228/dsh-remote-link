package com.dsh.remote;

import android.app.Activity;
import android.content.Intent;
import android.os.Bundle;
import android.provider.Settings;
import android.view.View;
import android.widget.*;

public class NotificationSettingsActivity extends Activity {
    private int dp(int value) { return (int)(value * getResources().getDisplayMetrics().density); }
    private TextView text(String value,int size) {
        TextView v=new TextView(this); v.setText(value); v.setTextSize(size); v.setTextColor(0xff202734); v.setPadding(0,dp(8),0,dp(8)); return v;
    }
    private Button button(String value,Runnable run) {
        Button b=new Button(this); b.setText(value); b.setAllCaps(false); b.setMinHeight(dp(48)); b.setOnClickListener(v->run.run()); return b;
    }
    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        getWindow().setStatusBarColor(0xfff7f8fb); getWindow().setNavigationBarColor(0xfff7f8fb);
        getWindow().getDecorView().setSystemUiVisibility(View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR | View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR);
        ScrollView scroll=new ScrollView(this); scroll.setFillViewport(true);
        LinearLayout body=new LinearLayout(this); body.setOrientation(LinearLayout.VERTICAL); body.setPadding(dp(24),dp(16),dp(24),dp(24)); body.setBackgroundColor(0xfff7f8fb);
        scroll.addView(body); setContentView(scroll);
        scroll.setOnApplyWindowInsetsListener((v,i)->{ v.setPadding(i.getSystemWindowInsetLeft(),i.getSystemWindowInsetTop(),i.getSystemWindowInsetRight(),i.getSystemWindowInsetBottom()); return i; });
        body.addView(button("返回",this::finish));
        body.addView(text("通知设置",28));
        body.addView(text("接收哪些通知",20));
        String[] labels={"任务开始","任务结束","任务失败","操作审批","需要回答的问题","其他插件消息"};
        for(int n=0;n<NotificationPreferences.KINDS.length;n++) {
            final String kind=NotificationPreferences.KINDS[n];
            Switch item=new Switch(this); item.setText(labels[n]); item.setTextSize(16); item.setTextColor(0xff202734); item.setMinHeight(dp(56));
            item.setChecked(NotificationPreferences.enabled(this,kind));
            item.setOnCheckedChangeListener((v,checked)->NotificationPreferences.setEnabled(this,kind,checked)); body.addView(item);
        }
        body.addView(text("开关立即保存，只影响这台手机的提醒。关闭审批或提问通知后，仍可在首页查看待处理请求。连接状态通知随后台接收服务一起启停。",14));
        body.addView(text("通知内容",20));
        Switch brief=new Switch(this); brief.setText("简略通知"); brief.setTextSize(16); brief.setTextColor(0xff202734); brief.setMinHeight(dp(56)); brief.setChecked(NotificationPreferences.brief(this));
        brief.setOnCheckedChangeListener((v,checked)->NotificationPreferences.prefs(this).edit().putBoolean("brief",checked).apply()); body.addView(brief);
        body.addView(text("默认显示任务名称和回答摘要；关闭后，展开通知可阅读较长内容。点击任务通知可查看详情。",14));
        body.addView(button("系统通知设置",()->startActivity(new Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS).putExtra(Settings.EXTRA_APP_PACKAGE,getPackageName()))));
    }
}