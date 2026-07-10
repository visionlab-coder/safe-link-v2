package com.safelink.v3.audit;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
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
            metadataJson = objectMapper.writeValueAsString(metadata == null ? Map.of() : metadata);
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
}
