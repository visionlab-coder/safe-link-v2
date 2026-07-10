package com.safelink.v3.tbm;

import com.safelink.v3.support.NotFoundException;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

@Repository
public class TbmRepository {
    private final JdbcClient jdbc;

    public TbmRepository(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    public NoticeRow getNotice(Long id) {
        return noticeStatement("""
                where t.id = :id
            """)
            .param("id", id)
            .query(this::mapNotice)
            .optional()
            .orElseThrow(() -> new NotFoundException("tbm_not_found"));
    }

    public List<NoticeRow> listLatest(boolean global, Set<Long> siteIds, int limit) {
        if (!global && (siteIds == null || siteIds.isEmpty())) {
            return List.of();
        }
        String siteClause = global ? "" : "and t.site_id in (:siteIds)";
        var statement = noticeStatement("""
                where t.status = 'PUBLISHED'
                  %s
                order by coalesce(t.published_at, t.created_at) desc, t.id desc
                limit :limit
            """.formatted(siteClause))
            .param("limit", limit);
        if (!global) {
            statement = statement.param("siteIds", siteIds);
        }
        return statement.query(this::mapNotice).list();
    }

    public List<NoticeRow> listForDate(boolean global, Set<Long> siteIds, Long requestedSiteId, Instant start, Instant end, int limit) {
        if (!global && (siteIds == null || siteIds.isEmpty())) {
            return List.of();
        }

        String siteClause;
        if (requestedSiteId != null) {
            siteClause = "and t.site_id = :requestedSiteId";
        } else if (global) {
            siteClause = "";
        } else {
            siteClause = "and t.site_id in (:siteIds)";
        }

        var statement = noticeStatement("""
                where t.created_at >= :start
                  and t.created_at < :end
                  %s
                order by t.created_at desc, t.id desc
                limit :limit
            """.formatted(siteClause))
            .param("start", Timestamp.from(start))
            .param("end", Timestamp.from(end))
            .param("limit", limit);

        if (requestedSiteId != null) {
            statement = statement.param("requestedSiteId", requestedSiteId);
        } else if (!global) {
            statement = statement.param("siteIds", siteIds);
        }
        return statement.query(this::mapNotice).list();
    }

    public NoticeRow createPublished(Long siteId, Long createdBy, String title, String content) {
        Long id = jdbc.sql("""
                insert into tbm_notices(site_id, created_by, title, source_text, normalized_text, status, published_at)
                values (:siteId, :createdBy, :title, :sourceText, :normalizedText, 'PUBLISHED', now())
                returning id
            """)
            .param("siteId", siteId)
            .param("createdBy", createdBy)
            .param("title", title)
            .param("sourceText", content)
            .param("normalizedText", content)
            .query(Long.class)
            .single();
        return getNotice(id);
    }

    public Optional<AckRow> findAck(Long noticeId, Long workerId) {
        return jdbc.sql("""
                select id, tbm_notice_id, worker_id, site_id, acknowledged_at, signature_file_id
                from tbm_acknowledgements
                where tbm_notice_id = :noticeId
                  and worker_id = :workerId
                limit 1
            """)
            .param("noticeId", noticeId)
            .param("workerId", workerId)
            .query(this::mapAck)
            .optional();
    }

    public AckRow acknowledge(Long noticeId, Long workerId, Long siteId, Long signatureFileId) {
        Long id = jdbc.sql("""
                insert into tbm_acknowledgements(tbm_notice_id, worker_id, site_id, signature_file_id)
                values (:noticeId, :workerId, :siteId, :signatureFileId)
                on conflict (tbm_notice_id, worker_id) do update
                    set acknowledged_at = tbm_acknowledgements.acknowledged_at
                returning id
            """)
            .param("noticeId", noticeId)
            .param("workerId", workerId)
            .param("siteId", siteId)
            .param("signatureFileId", signatureFileId)
            .query(Long.class)
            .single();
        return getAck(id);
    }

    public AckRow getAck(Long id) {
        return jdbc.sql("""
                select id, tbm_notice_id, worker_id, site_id, acknowledged_at, signature_file_id
                from tbm_acknowledgements
                where id = :id
            """)
            .param("id", id)
            .query(this::mapAck)
            .single();
    }

    public List<AckRow> listAcks(Long noticeId) {
        return jdbc.sql("""
                select id, tbm_notice_id, worker_id, site_id, acknowledged_at, signature_file_id
                from tbm_acknowledgements
                where tbm_notice_id = :noticeId
                order by acknowledged_at asc
            """)
            .param("noticeId", noticeId)
            .query(this::mapAck)
            .list();
    }

    public List<WorkerRow> listWorkers(boolean global, Set<Long> siteIds, Long requestedSiteId) {
        if (!global && (siteIds == null || siteIds.isEmpty())) {
            return List.of();
        }

        String siteClause;
        if (requestedSiteId != null) {
            siteClause = "and sm.site_id = :requestedSiteId";
        } else if (global) {
            siteClause = "";
        } else {
            siteClause = "and sm.site_id in (:siteIds)";
        }

        var statement = jdbc.sql("""
                select distinct u.id, u.display_name, u.preferred_language, sm.site_id
                from users u
                join site_memberships sm on sm.user_id = u.id and sm.status = 'ACTIVE' and sm.role = 'WORKER'
                join user_roles ur on ur.user_id = u.id and ur.revoked_at is null and ur.role = 'WORKER'
                where u.account_status = 'ACTIVE'
                  %s
                order by u.display_name, u.id
            """.formatted(siteClause));

        if (requestedSiteId != null) {
            statement = statement.param("requestedSiteId", requestedSiteId);
        } else if (!global) {
            statement = statement.param("siteIds", siteIds);
        }
        return statement
            .query((rs, rowNum) -> new WorkerRow(
                rs.getLong("id"),
                rs.getString("display_name"),
                rs.getString("preferred_language"),
                rs.getLong("site_id")
            ))
            .list();
    }

    private JdbcClient.StatementSpec noticeStatement(String clause) {
        return jdbc.sql("""
                select t.id, t.site_id, s.name as site_name, t.created_by, t.title, t.source_text,
                       t.normalized_text, t.status, t.published_at, t.created_at
                from tbm_notices t
                join sites s on s.id = t.site_id
                %s
            """.formatted(clause));
    }

    private NoticeRow mapNotice(java.sql.ResultSet rs, int rowNum) throws java.sql.SQLException {
        return new NoticeRow(
            rs.getLong("id"),
            rs.getLong("site_id"),
            rs.getString("site_name"),
            rs.getLong("created_by"),
            rs.getString("title"),
            rs.getString("source_text"),
            rs.getString("normalized_text"),
            rs.getString("status"),
            rs.getTimestamp("published_at") == null ? null : rs.getTimestamp("published_at").toInstant(),
            rs.getTimestamp("created_at").toInstant()
        );
    }

    private AckRow mapAck(java.sql.ResultSet rs, int rowNum) throws java.sql.SQLException {
        return new AckRow(
            rs.getLong("id"),
            rs.getLong("tbm_notice_id"),
            rs.getLong("worker_id"),
            rs.getLong("site_id"),
            rs.getTimestamp("acknowledged_at").toInstant(),
            rs.getObject("signature_file_id", Long.class)
        );
    }

    public record NoticeRow(Long id, Long siteId, String siteName, Long createdBy, String title, String sourceText, String normalizedText, String status, Instant publishedAt, Instant createdAt) {}
    public record AckRow(Long id, Long noticeId, Long workerId, Long siteId, Instant acknowledgedAt, Long signatureFileId) {}
    public record WorkerRow(Long id, String displayName, String preferredLanguage, Long siteId) {}
}
