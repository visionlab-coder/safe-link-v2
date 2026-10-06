package com.safelink.v3.auth;

import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class EnglishNameTest {
    @Test void validatesOnlyRomanSpelling() {
        assertEquals("HONG GILDONG", EnglishName.require(" Hong  Gildong "));
        for (String name : new String[]{"O'NEILL", "JEAN-PIERRE", "HJ.JONG", "A"}) assertEquals(name, EnglishName.require(name));
        for (String name : new String[]{"", " ", "홍길동", "김 (KIM)", "Nguyễn", "1234", "A_", "A\nB", "A".repeat(81), "💙"})
            assertThrows(IllegalArgumentException.class, () -> EnglishName.require(name), name);
        assertThrows(IllegalArgumentException.class, () -> EnglishName.require(null));
    }
    @Test void workerRegistrationPathsRejectNativeNames() {
        assertThrows(IllegalArgumentException.class, () -> TemporaryWorkerService.validate("홍길동", "01012345678", true, TemporaryWorkerService.CONSENT_VERSION));
        assertThrows(IllegalArgumentException.class, () -> WorkerUpgradeService.validate(new WorkerUpgradeService.Application("홍길동", "01012345678", 2L, "123", true, WorkerUpgradeService.CONSENT_VERSION)));
        assertDoesNotThrow(() -> WorkerUpgradeService.validate(new WorkerUpgradeService.Application("HONG GILDONG", "01012345678", 2L, "123", true, WorkerUpgradeService.CONSENT_VERSION)));
    }
    @Test void localSuggestionsAreValidAndNotStored() {
        var limiter = mock(LoginAttemptRateLimiter.class);
        var controller = new NameRomanizationController(limiter);
        var request = new MockHttpServletRequest();
        for (String name : new String[]{"홍길동", "张伟", "Nguyễn Văn An", "Иван", "สมชาย", "राम", "محمد", "José"}) {
            var response = controller.suggest(new NameRomanizationController.Input(name), request);
            assertEquals(200, response.getStatusCode().value(), name);
            assertNotNull(response.getBody());
            assertDoesNotThrow(() -> EnglishName.require(response.getBody().get("romanized")), name);
            assertEquals("no-store", response.getHeaders().getCacheControl());
        }
        verify(limiter, times(8)).consumeNameSuggestion(anyString());
    }
    @Test void rejectsNoiseAndDoesNotDropUnconvertedLetters() {
        var controller = new NameRomanizationController(mock(LoginAttemptRateLimiter.class));
        var request = new MockHttpServletRequest();
        for (String name : new String[]{"<script>", "A\nB", "A123", "A".repeat(81)})
            assertThrows(IllegalArgumentException.class, () -> controller.suggest(new NameRomanizationController.Input(name), request));
        for (String name : new String[]{"សុខ", "မောင်မောင်"}) {
            var response = controller.suggest(new NameRomanizationController.Input(name), request);
            if (response.getStatusCode().is2xxSuccessful()) assertDoesNotThrow(() -> EnglishName.require(response.getBody().get("romanized")));
            else assertEquals(422, response.getStatusCode().value());
        }
    }
}
