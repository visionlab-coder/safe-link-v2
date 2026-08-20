package kr.co.safelink.mobile.dev;

import android.Manifest;
import android.os.Build;
import android.os.Bundle;
import android.webkit.CookieManager;

import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;

import com.getcapacitor.BridgeActivity;

import java.util.ArrayList;
import java.util.List;

/**
 * The production web app runs inside this first-party WebView. Keep its
 * authenticated session cookies and media permissions available to the same
 * web routes used in a regular browser (TBM, chat, camera and voice input).
 */
public class MainActivity extends BridgeActivity {

    private static final int PERMISSION_REQUEST_CODE = 1001;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        CookieManager cookies = CookieManager.getInstance();
        cookies.setAcceptCookie(true);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            cookies.setAcceptThirdPartyCookies(getBridge().getWebView(), true);
        }
        cookies.flush();

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
            ActivityCompat.requestPermissions(this, needed.toArray(new String[0]), PERMISSION_REQUEST_CODE);
        }
    }

    private void addIfMissing(List<String> list, String permission) {
        if (ContextCompat.checkSelfPermission(this, permission)
                != android.content.pm.PackageManager.PERMISSION_GRANTED) {
            list.add(permission);
        }
    }
}
