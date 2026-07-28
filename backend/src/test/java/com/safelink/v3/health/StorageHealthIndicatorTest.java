package com.safelink.v3.health;

import static org.assertj.core.api.Assertions.assertThat;

import com.safelink.v3.storage.DisabledObjectStorageService;
import com.safelink.v3.storage.ObjectStorageService;
import java.net.URI;
import java.nio.file.Path;
import java.time.Duration;
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

    @Test
    void reportsConfiguredStorageAsUpAfterProbe() {
        var health = new StorageHealthIndicator(configuredStorage(false)).health();

        assertThat(health.getStatus()).isEqualTo(Status.UP);
        assertThat(health.getDetails()).containsEntry("objectStorage", "configured");
    }

    @Test
    void reportsConfiguredStorageAsDownWhenProbeFails() {
        var health = new StorageHealthIndicator(configuredStorage(true)).health();

        assertThat(health.getStatus()).isEqualTo(Status.DOWN);
        assertThat(health.getDetails())
            .containsEntry("objectStorage", "unavailable")
            .containsEntry("reason", "IllegalStateException");
    }

    private static ObjectStorageService configuredStorage(boolean failProbe) {
        return new ObjectStorageService() {
            @Override public URI createUploadUrl(String objectKey, String contentType, Duration ttl) { return URI.create("https://example.invalid/upload"); }
            @Override public URI createDownloadUrl(String objectKey, Duration ttl) { return URI.create("https://example.invalid/download"); }
            @Override public void putObject(String objectKey, String contentType, byte[] bytes) {}
            @Override public StoredObject getObject(String objectKey) { return new StoredObject("text/plain", new byte[0]); }
            @Override public boolean isConfigured() { return true; }
            @Override public void verifyAvailable() {
                if (failProbe) throw new IllegalStateException("offline");
            }
        };
    }
}
