package kr.co.safelink.mobile.dev;

import java.net.URI;
import java.net.URISyntaxException;

/** Back is navigation, never an implicit logout or activity finish. */
final class BackNavigation {
    interface PageHistory {
        String currentUrl();
        boolean canGoBack();
        void goBack();
    }

    static void handle(PageHistory history) {
        if (history == null || isHome(history.currentUrl())) return;
        if (history.canGoBack()) history.goBack();
        // No previous page: keep the current WebView/session alive.
    }

    static boolean isHome(String url) {
        if (url == null) return false;
        try {
            String path = new URI(url).getPath();
            if (path == null) return false;
            path = path.replaceAll("/+$", "");
            return path.equals("/worker") || path.equals("/worker/temporary")
                || path.equals("/admin") || path.equals("/control") || path.equals("/system");
        } catch (URISyntaxException ignored) {
            return false;
        }
    }
}
