package com.safelink.v3.storage;

import com.safelink.v3.support.NotFoundException;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

@Repository
public class FileObjectRepository {
    private final JdbcClient jdbc;

    public FileObjectRepository(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    public Long createPending(Long siteId, Long ownerUserId, String objectKey, String sha256, String mimeType, Long byteSize, String purpose) {
        return jdbc.sql("""
                insert into file_objects(site_id, owner_user_id, object_key, sha256, mime_type, byte_size, purpose, status)
                values (:siteId, :ownerUserId, :objectKey, :sha256, :mimeType, :byteSize, :purpose, 'PENDING_UPLOAD')
                returning id
            """)
            .param("siteId", siteId)
            .param("ownerUserId", ownerUserId)
            .param("objectKey", objectKey)
            .param("sha256", sha256)
            .param("mimeType", mimeType)
            .param("byteSize", byteSize)
            .param("purpose", purpose)
            .query(Long.class)
            .single();
    }

    public Long createReady(Long siteId, Long ownerUserId, String objectKey, String sha256, String mimeType, Long byteSize, String purpose) {
        return jdbc.sql("""
                insert into file_objects(site_id, owner_user_id, object_key, sha256, mime_type, byte_size, purpose, status, verified_at)
                values (:siteId, :ownerUserId, :objectKey, :sha256, :mimeType, :byteSize, :purpose, 'READY', now())
                returning id
            """)
            .param("siteId", siteId)
            .param("ownerUserId", ownerUserId)
            .param("objectKey", objectKey)
            .param("sha256", sha256)
            .param("mimeType", mimeType)
            .param("byteSize", byteSize)
            .param("purpose", purpose)
            .query(Long.class)
            .single();
    }

    public FileObject get(Long id) {
        return jdbc.sql("""
                select id, site_id, owner_user_id, object_key, sha256, mime_type, byte_size, purpose, status
                from file_objects
                where id = :id
            """)
            .param("id", id)
            .query((rs, rowNum) -> new FileObject(
                rs.getLong("id"),
                rs.getLong("site_id"),
                rs.getObject("owner_user_id", Long.class),
                rs.getString("object_key"),
                rs.getString("sha256"),
                rs.getString("mime_type"),
                rs.getLong("byte_size"),
                rs.getString("purpose"),
                rs.getString("status")
            ))
            .optional()
            .orElseThrow(() -> new NotFoundException("file_object_not_found"));
    }

    public void markReady(Long id) {
        jdbc.sql("""
                update file_objects
                set status = 'READY', verified_at = now()
                where id = :id and status = 'PENDING_UPLOAD'
            """)
            .param("id", id)
            .update();
    }

    public void markQuarantined(Long id) {
        jdbc.sql("""
                update file_objects
                set status = 'QUARANTINED'
                where id = :id and status = 'PENDING_UPLOAD'
            """)
            .param("id", id)
            .update();
    }
}
