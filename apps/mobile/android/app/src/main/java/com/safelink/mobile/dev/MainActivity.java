package com.safelink.mobile.dev;

import android.Manifest;
import android.os.Build;
import android.os.Bundle;

import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;

import com.getcapacitor.BridgeActivity;

import java.util.ArrayList;
import java.util.List;

/**
 * 단일 앱 셸: 배포된 SAFE-LINK 웹앱 전체를 first-party WebView로 호스팅.
 * 웹앱의 라이브 통역·1:1 대화가 WebView 안에서 getUserMedia(마이크)를 호출하므로,
 * 실행 시 런타임 권한을 미리 요청한다. Capacitor 브릿지 WebChromeClient는 앱이
 * 해당 Android 권한을 보유한 경우 WebView의 미디어 권한 요청을 grant 한다.
 */
public class MainActivity extends BridgeActivity {

    private static final int PERMISSION_REQUEST_CODE = 1001;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        requestMediaPermissions();
    }

    private void requestMediaPermissions() {
        List<String> needed = new ArrayList<>();

        addIfMissing(needed, Manifest.permission.RECORD_AUDIO);
        addIfMissing(needed, Manifest.permission.MODIFY_AUDIO_SETTINGS);
        addIfMissing(needed, Manifest.permission.CAMERA);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            addIfMissing(needed, Manifest.permission.POST_NOTIFICATIONS);
        }

        if (!needed.isEmpty()) {
            ActivityCompat.requestPermissions(
                this,
                needed.toArray(new String[0]),
                PERMISSION_REQUEST_CODE
            );
        }
    }

    private void addIfMissing(List<String> list, String permission) {
        if (ContextCompat.checkSelfPermission(this, permission)
                != android.content.pm.PackageManager.PERMISSION_GRANTED) {
            list.add(permission);
        }
    }
}
