package com.safelink.v3.health;

import static org.assertj.core.api.Assertions.assertThat;

import com.safelink.v3.storage.DisabledObjectStorageService;
import java.nio.file.Path;
import org.junit.jupiter.api.Test;
import org.springframework.boot.actuate.health.Status;

class StorageHealthIndicatorTest {
    @Test
    void reportsLocalFallbackAsUnknown() {
        var health = new StorageHealthIndicator(
            new DisabledObjectStorageService(Path.of("build/test-storage"))
        ).health();

        assertThat(health.getStatus()).isEqualTo(Status.UNKNOWN);
        assertThat(health.getDetails())
            .containsEntry("objectStorage", "not_configured")
            .containsEntry("mode", "LOCAL_FALLBACK");
    }
}
