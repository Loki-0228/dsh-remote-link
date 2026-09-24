package com.dsh.remote;

/** Plain-text presentation, also exercised by JVM regression tests. */
final class NotificationText {
    static String kind(String value) {
        for (String known : new String[]{"task-started","task-completed","task-failed","approval","question","info"})
            if (known.equals(value)) return known;
        return "info";
    }
    static String label(String value) {
        switch(kind(value)) {
            case "task-started": return "任务开始";
            case "task-completed": return "本轮结束";
            case "task-failed": return "任务失败";
            case "approval": return "等待审批";
            case "question": return "等待回答";
            default: return "插件消息";
        }
    }
    static String compact(String value, int max) {
        String text = (value == null ? "" : value).replaceAll("(?is)<think>.*?</think>", "")
            .replaceAll("(?s)\\x60{3}.*?\\x60{3}", " [代码] ").replaceAll("!\\[[^\\]]*\\]\\([^)]*\\)", "")
            .replaceAll("\\[([^\\]]+)\\]\\([^)]*\\)", "$1").replaceAll("(?m)^\\s{0,3}(?:#{1,6}|>|[-*+]|\\d+\\.)\\s+", "")
            .replaceAll("(\\*\\*|__)(.*?)\\1", "$2").replaceAll("\\x60([^\\x60]+)\\x60", "$1").replaceAll("\\s+", " ").trim();
        return text.codePointCount(0,text.length()) > max ? text.substring(0,text.offsetByCodePoints(0,max-1)) + "…" : text;
    }
    static String title(String kind, String task, String original, String session) {
        task = compact(task,48);
        if (!task.isEmpty()) return label(kind) + " · " + task;
        String title = compact(original,72);
        if (!session.isEmpty()) return (title.isEmpty() ? label(kind) : title) + " · " + compact(session,8);
        return title.isEmpty() ? label(kind) : title;
    }
    static String body(String kind, String summary, String body, boolean brief) {
        String value = brief && summary != null && !summary.trim().isEmpty() ? summary : body;
        value = compact(value, brief ? 160 : 1200);
        if (!value.isEmpty()) return value;
        if ("task-completed".equals(kind)) return "本轮已结束。电脑未提供摘要，点击查看详情并打开远程会话。";
        if ("approval".equals(kind)) return "有操作需要你审批，点击查看操作内容。";
        if ("question".equals(kind)) return "任务需要你补充信息，点击打开会话回答。";
        return "点击查看任务详情。";
    }
}