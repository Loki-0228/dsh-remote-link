package com.dsh.remote;
public class NotificationTextTest {
    static void check(boolean ok,String message) { if(!ok) throw new AssertionError(message); }
    public static void main(String[] args) {
        check(NotificationText.title("task-completed","导出报表","DSH","123").equals("本轮结束 · 导出报表"),"task name");
        check(NotificationText.body("task-completed","共 20 行","长内容",true).equals("共 20 行"),"brief uses summary");
        check(NotificationText.body("task-completed","共 20 行","长内容",false).equals("长内容"),"expanded content");
        check(!NotificationText.body("task-completed","","",true).isEmpty(),"legacy payload fallback");
        check(NotificationText.compact("# 完成\n- **报表** [文件](https://example.test)",100).equals("完成 报表 文件"),"plain text");
        String text=String.join("",java.util.Collections.nCopies(200,"😀"));
        check(NotificationText.compact(text,160).codePointCount(0,NotificationText.compact(text,160).length())==160,"unicode-safe length");
        check(NotificationText.kind("new-plugin-kind").equals("info"),"unknown kinds use plugin switch");
        System.out.println("7 notification presentation checks passed");
    }
}