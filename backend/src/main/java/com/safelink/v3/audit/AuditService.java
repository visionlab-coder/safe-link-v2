package com.safelink.v3.audit;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.LinkedHashMap;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.slf4j.MDC;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;

@Service
public class AuditService {
    private static final Logger log = LoggerFactory.getLogger(AuditService.class);
    private final JdbcClient jdbc;
    private final ObjectMapper objectMapper;

    public AuditService(JdbcClient jdbc, ObjectMapper objectMapper) {
        this.jdbc = jdbc;
        this.objectMapper = objectMapper;
    }

    public void record(Long actorUserId, Long siteId, String action, String resourceType, String resourceId, String decision, String reason, Map<String, ?> metadata) {
        String metadataJson = "{}";
        try {
            metadataJson = objectMapper.writeValueAsString(withRequestId(metadata, MDC.get("requestId")));
            jdbc.sql("""
                    insert into audit_logs(actor_user_id, site_id, action, resource_type, resource_id, decision, reason, metadata)
                    values (:actorUserId, :siteId, :action, :resourceType, :resourceId, :decision, :reason, cast(:metadata as jsonb))
                """)
                .param("actorUserId", actorUserId)
                .param("siteId", siteId)
                .param("action", action)
                .param("resourceType", resourceType)
                .param("resourceId", resourceId)
                .param("decision", decision)
                .param("reason", reason)
                .param("metadata", metadataJson)
                .update();
        } catch (JsonProcessingException e) {
            throw new IllegalArgumentException("audit_metadata_invalid", e);
        } catch (RuntimeException e) {
            log.warn("audit_log_write_failed action={} decision={} reason={} metadata={}", action, decision, reason, metadataJson, e);
        }
    }

    static Map<String, Object> withRequestId(Map<String, ?> metadata, String requestId) {
        Map<String, Object> enriched = new LinkedHashMap<>();
        if (metadata != null) {
            enriched.putAll(metadata);
        }
        if (requestId != null && !requestId.isBlank()) {
            enriched.put("request_id", requestId);
        }
        return enriched;
    }
}
