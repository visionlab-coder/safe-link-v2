package com.safelink.v3.audit;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.Map;
import org.junit.jupiter.api.Test;

class AuditServiceTest {
    @Test
    void appendsRequestIdWithoutMutatingCallerMetadata() {
        Map<String, String> metadata = Map.of("roles", "[SITE_ADMIN]");

        Map<String, Object> enriched = AuditService.withRequestId(metadata, "qa-request-123");

        assertThat(enriched)
            .containsEntry("roles", "[SITE_ADMIN]")
            .containsEntry("request_id", "qa-request-123");
        assertThat(metadata).doesNotContainKey("request_id");
    }

    @Test
    void omitsBlankRequestId() {
        assertThat(AuditService.withRequestId(Map.of("source", "server_api"), " "))
            .containsExactlyEntriesOf(Map.of("source", "server_api"));
    }
}
