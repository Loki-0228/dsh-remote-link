package com.dsh.remote;

import java.net.HttpURLConnection;
import java.net.URL;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import org.json.JSONObject;

final class Api {
    static class Failure extends Exception { final int status; Failure(int status) { super("HTTP " + status); this.status = status; } }
    static JSONObject call(String address, String device, JSONObject body) throws Exception {
        HttpURLConnection c = (HttpURLConnection)new URL(address).openConnection();
        c.setConnectTimeout(12000); c.setReadTimeout(35000); c.setInstanceFollowRedirects(false);
        c.setRequestProperty("User-Agent", "DSH-Remote-Android/0.1");
        if (!device.isEmpty()) c.setRequestProperty("x-dsh-remote-device", device);
        try {
            if (body != null) {
                c.setRequestMethod("POST"); c.setDoOutput(true); c.setRequestProperty("Content-Type", "application/json");
                byte[] bytes = body.toString().getBytes("UTF-8"); c.setFixedLengthStreamingMode(bytes.length);
                try (java.io.OutputStream out = c.getOutputStream()) { out.write(bytes); }
            }
            int status = c.getResponseCode(); if (status != 200) throw new Failure(status);
            try (InputStream in = c.getInputStream(); ByteArrayOutputStream out = new ByteArrayOutputStream()) {
                byte[] buffer = new byte[8192]; int n;
                while ((n = in.read(buffer)) != -1) { out.write(buffer, 0, n); if (out.size() > 2 * 1024 * 1024) throw new Exception("response too large"); }
                return new JSONObject(out.toString("UTF-8"));
            }
        } finally { c.disconnect(); }
    }
}
