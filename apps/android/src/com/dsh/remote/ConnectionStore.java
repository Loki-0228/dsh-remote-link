package com.dsh.remote;

import android.content.Context;
import android.content.SharedPreferences;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;
import android.util.Base64;
import java.security.KeyStore;
import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;

final class ConnectionStore {
    static SharedPreferences prefs(Context c) { return c.getSharedPreferences("connection", Context.MODE_PRIVATE); }
    private static SecretKey key() throws Exception {
        KeyStore ks = KeyStore.getInstance("AndroidKeyStore"); ks.load(null);
        if (!ks.containsAlias("dsh-device")) {
            KeyGenerator gen = KeyGenerator.getInstance("AES", "AndroidKeyStore");
            gen.init(new KeyGenParameterSpec.Builder("dsh-device", KeyProperties.PURPOSE_ENCRYPT | KeyProperties.PURPOSE_DECRYPT)
                .setBlockModes(KeyProperties.BLOCK_MODE_GCM).setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE).build());
            gen.generateKey();
        }
        return (SecretKey) ks.getKey("dsh-device", null);
    }
    static void save(Context c, String base, String device) throws Exception {
        Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding"); cipher.init(Cipher.ENCRYPT_MODE, key());
        String value = Base64.encodeToString(cipher.getIV(), Base64.NO_WRAP) + "." + Base64.encodeToString(cipher.doFinal(device.getBytes("UTF-8")), Base64.NO_WRAP);
        prefs(c).edit().clear().putString("base", base).putString("device", value).putBoolean("enabled", true).commit();
    }
    static String device(Context c) throws Exception {
        String value = prefs(c).getString("device", ""); if (value.isEmpty()) return "";
        String[] parts = value.split("\\.");
        Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding"); cipher.init(Cipher.DECRYPT_MODE, key(), new GCMParameterSpec(128, Base64.decode(parts[0], Base64.NO_WRAP)));
        return new String(cipher.doFinal(Base64.decode(parts[1], Base64.NO_WRAP)), "UTF-8");
    }
    static String base(Context c) { return prefs(c).getString("base", ""); }
}
