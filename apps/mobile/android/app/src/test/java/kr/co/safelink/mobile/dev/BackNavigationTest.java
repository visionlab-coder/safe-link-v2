package kr.co.safelink.mobile.dev;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import org.junit.Test;

public class BackNavigationTest {
    private static final class History implements BackNavigation.PageHistory {
        final String url;
        final boolean previous;
        int calls;
        History(String url, boolean previous) { this.url = url; this.previous = previous; }
        public String currentUrl() { return url; }
        public boolean canGoBack() { return previous; }
        public void goBack() { calls++; }
    }

    @Test public void detailNavigatesBackExactlyOnce() {
        for (String path : new String[]{"/worker/chat/123", "/worker/tbm/123", "/worker/tbm/create", "/admin/tbm/create", "/auth/temporary", "/worker/upgrade", "/auth/setup"}) {
            History history = new History("https://app.safe-link.co.kr" + path, true);
            BackNavigation.handle(history);
            assertEquals(path, 1, history.calls);
        }
    }

    @Test public void homeDoesNotReturnToLoginOrFinish() {
        for (String path : new String[]{"/worker", "/worker/temporary", "/admin", "/control", "/system"}) {
            History history = new History("https://app.safe-link.co.kr" + path + "/?lang=en", true);
            BackNavigation.handle(history);
            assertEquals(path, 0, history.calls);
        }
    }

    @Test public void directEntryWithoutHistoryRemainsOpen() {
        History history = new History("https://app.safe-link.co.kr/worker/tbm/123", false);
        BackNavigation.handle(history);
        assertEquals(0, history.calls);
    }

    @Test public void nullOrMalformedLocationDoesNotCrash() {
        BackNavigation.handle(null);
        assertFalse(BackNavigation.isHome(null));
        assertFalse(BackNavigation.isHome("bad url"));
        assertFalse(BackNavigation.isHome("https://app.safe-link.co.kr/worker/chat?next=/worker"));
    }
}
