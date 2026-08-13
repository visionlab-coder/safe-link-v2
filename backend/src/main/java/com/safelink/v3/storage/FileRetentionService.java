package com.safelink.v3.storage;

import java.util.ArrayList;
import java.util.List;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;

@Service
public class FileRetentionService {
    private final JdbcClient jdbc;
    private final ObjectStorageService storage;

    public FileRetentionService(JdbcClient jdbc, ObjectStorageService storage) {
        this.jdbc = jdbc;
        this.storage = storage;
    }

    public PurgeResult purgeDueFiles(int requestedLimit, boolean dryRun) {
        int limit = Math.max(1, Math.min(requestedLimit, 500));
        List<DueFile> due = jdbc.sql("""
                select id, object_key
                from file_objects
                where status = 'READY'
                  and legal_hold = false
                  and retention_until is not null
                  and retention_until <= now()
                order by retention_until, id
                limit :limit
            """)
            .param("limit", limit)
            .query((rs, rowNum) -> new DueFile(rs.getLong("id"), rs.getString("object_key")))
            .list();
        if (dryRun) return new PurgeResult(true, due.size(), 0, List.of());

        int deleted = 0;
        List<Long> failed = new ArrayList<>();
        for (DueFile file : due) {
            try {
                storage.deleteObject(file.objectKey());
                jdbc.sql("""
                        update file_objects
                        set status = 'DELETED', deleted_at = now()
                        where id = :id and status = 'READY' and legal_hold = false
                    """)
                    .param("id", file.id())
                    .update();
                deleted++;
            } catch (RuntimeException exception) {
                failed.add(file.id());
            }
        }
        return new PurgeResult(false, due.size(), deleted, failed);
    }

    public List<RetentionPolicy> listPolicies() {
        return jdbc.sql("""
                select data_type, retention_days, description
                from data_retention_policies
                order by data_type
            """)
            .query((rs, rowNum) -> new RetentionPolicy(
                rs.getString("data_type"),
                rs.getInt("retention_days"),
                rs.getString("description")
            ))
            .list();
    }

    private record DueFile(Long id, String objectKey) {}
    public record RetentionPolicy(String dataType, int retentionDays, String description) {}
    public record PurgeResult(boolean dryRun, int dueCount, int deletedCount, List<Long> failedIds) {}
}
