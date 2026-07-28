package com.safelink.v3.chat;

import com.safelink.v3.support.NotFoundException;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

@Repository
public class ChatRepository {
    private final JdbcClient jdbc;

    public ChatRepository(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    public ThreadRow getThread(Long threadId) {
        return jdbc.sql("select id, site_id, worker_id, admin_user_id, status from chat_threads where id = :id")
            .param("id", threadId)
            .query((rs, rowNum) -> new ThreadRow(
                rs.getLong("id"),
                rs.getLong("site_id"),
                rs.getLong("worker_id"),
                rs.getObject("admin_user_id", Long.class),
                rs.getString("status")
            ))
            .optional()
            .orElseThrow(() -> new NotFoundException("chat_thread_not_found"));
    }

    public List<MessageRow> listMessages(Long threadId) {
        return jdbc.sql("""
                select id, thread_id, site_id, sender_user_id, source_language, target_language, source_text, translated_text, created_at
                from chat_messages
                where thread_id = :threadId
                order by created_at asc
                limit 200
            """)
            .param("threadId", threadId)
            .query((rs, rowNum) -> new MessageRow(
                rs.getLong("id"),
                rs.getLong("thread_id"),
                rs.getLong("site_id"),
                rs.getLong("sender_user_id"),
                rs.getString("source_language"),
                rs.getString("target_language"),
                rs.getString("source_text"),
                rs.getString("translated_text"),
                rs.getTimestamp("created_at").toInstant()
            ))
            .list();
    }

    public List<MessageRow> listRecentMessages(Long threadId, Instant before, int limit) {
        String beforeClause = before == null ? "" : "and created_at < :before";
        var statement = jdbc.sql("""
                select id, thread_id, site_id, sender_user_id, source_language, target_language, source_text, translated_text, created_at
                from (
                    select id, thread_id, site_id, sender_user_id, source_language, target_language, source_text, translated_text, created_at
                    from chat_messages
                    where thread_id = :threadId
                    %s
                    order by created_at desc
                    limit :limit
                ) recent
                order by created_at asc
            """.formatted(beforeClause))
            .param("threadId", threadId)
            .param("limit", limit);

        if (before != null) {
            statement = statement.param("before", Timestamp.from(before));
        }

        return statement
            .query((rs, rowNum) -> new MessageRow(
                rs.getLong("id"),
                rs.getLong("thread_id"),
                rs.getLong("site_id"),
                rs.getLong("sender_user_id"),
                rs.getString("source_language"),
                rs.getString("target_language"),
                rs.getString("source_text"),
                rs.getString("translated_text"),
                rs.getTimestamp("created_at").toInstant()
            ))
            .list();
    }

    public List<WorkerPeerRow> listWorkersForAdmin(boolean globalAdmin, Set<Long> siteIds) {
        if (!globalAdmin && (siteIds == null || siteIds.isEmpty())) {
            return List.of();
        }

        String siteClause = globalAdmin ? "" : "and sm.site_id in (:siteIds)";
        var statement = jdbc.sql("""
                select distinct u.id, u.display_name, u.preferred_language, sm.site_id
                from users u
                join user_roles ur on ur.user_id = u.id and ur.revoked_at is null and ur.role = 'WORKER'
                join site_memberships sm on sm.user_id = u.id and sm.status = 'ACTIVE' and sm.role = 'WORKER'
                where u.account_status = 'ACTIVE'
                %s
                order by u.display_name, u.id
            """.formatted(siteClause));

        if (!globalAdmin) {
            statement = statement.param("siteIds", siteIds);
        }

        return statement
            .query((rs, rowNum) -> new WorkerPeerRow(
                rs.getLong("id"),
                rs.getString("display_name"),
                rs.getString("preferred_language"),
                null,
                rs.getLong("site_id")
            ))
            .list();
    }

    public List<AdminPeerRow> listAdminsForWorker(Set<Long> siteIds) {
        if (siteIds == null || siteIds.isEmpty()) {
            return List.of();
        }

        return jdbc.sql("""
                select distinct u.id, u.display_name, sm.role, sm.site_id
                from users u
                join site_memberships sm on sm.user_id = u.id and sm.status = 'ACTIVE'
                join user_roles ur on ur.user_id = u.id and ur.revoked_at is null
                where sm.site_id in (:siteIds)
                  and sm.role in ('SITE_ADMIN', 'SAFETY_MANAGER', 'VIEWER')
                  and ur.role <> 'WORKER'
                  and ur.role <> 'ROOT'
                  and u.account_status = 'ACTIVE'
                order by u.display_name, u.id
            """)
            .param("siteIds", siteIds)
            .query((rs, rowNum) -> new AdminPeerRow(
                rs.getLong("id"),
                rs.getString("display_name"),
                rs.getString("role"),
                rs.getLong("site_id")
            ))
            .list();
    }

    public UserAccessRow getUserAccess(Long userId) {
        var user = jdbc.sql("""
                select id, display_name, preferred_language
                from users
                where id = :userId
                  and account_status = 'ACTIVE'
                limit 1
            """)
            .param("userId", userId)
            .query((rs, rowNum) -> new UserAccessRow(
                rs.getLong("id"),
                rs.getString("display_name"),
                rs.getString("preferred_language"),
                Set.copyOf(rolesFor(userId)),
                Set.copyOf(activeSitesFor(userId))
            ))
            .optional();

        return user.orElseThrow(() -> new NotFoundException("chat_peer_not_found"));
    }

    public Optional<ThreadRow> findOpenThread(Long siteId, Long workerId, Long adminUserId) {
        return jdbc.sql("""
                select id, site_id, worker_id, admin_user_id, status
                from chat_threads
                where site_id = :siteId
                  and worker_id = :workerId
                  and admin_user_id = :adminUserId
                  and status <> 'ARCHIVED'
                order by id
                limit 1
            """)
            .param("siteId", siteId)
            .param("workerId", workerId)
            .param("adminUserId", adminUserId)
            .query((rs, rowNum) -> new ThreadRow(
                rs.getLong("id"),
                rs.getLong("site_id"),
                rs.getLong("worker_id"),
                rs.getObject("admin_user_id", Long.class),
                rs.getString("status")
            ))
            .optional();
    }

    public ThreadRow createThread(Long siteId, Long workerId, Long adminUserId) {
        Long id = jdbc.sql("""
                insert into chat_threads(site_id, worker_id, admin_user_id, status)
                values (:siteId, :workerId, :adminUserId, 'OPEN')
                returning id
            """)
            .param("siteId", siteId)
            .param("workerId", workerId)
            .param("adminUserId", adminUserId)
            .query(Long.class)
            .single();
        return getThread(id);
    }

    public MessageRow insertMessage(
        Long threadId,
        Long siteId,
        Long senderUserId,
        String sourceLanguage,
        String targetLanguage,
        String sourceText,
        String translatedText,
        String clientMessageId
    ) {
        Long id = jdbc.sql("""
                insert into chat_messages(
                    thread_id, site_id, sender_user_id, source_language, target_language,
                    source_text, translated_text, client_message_id
                )
                values (
                    :threadId, :siteId, :senderUserId, :sourceLanguage, :targetLanguage,
                    :sourceText, :translatedText, :clientMessageId
                )
                on conflict (thread_id, sender_user_id, client_message_id)
                where client_message_id is not null
                do update set client_message_id = excluded.client_message_id
                returning id
            """)
            .param("threadId", threadId)
            .param("siteId", siteId)
            .param("senderUserId", senderUserId)
            .param("sourceLanguage", sourceLanguage)
            .param("targetLanguage", targetLanguage)
            .param("sourceText", sourceText)
            .param("translatedText", translatedText)
            .param("clientMessageId", clientMessageId)
            .query(Long.class)
            .single();
        return jdbc.sql("""
                select id, thread_id, site_id, sender_user_id, source_language, target_language, source_text, translated_text, created_at
                from chat_messages
                where id = :id
            """)
            .param("id", id)
            .query((rs, rowNum) -> new MessageRow(
                rs.getLong("id"),
                rs.getLong("thread_id"),
                rs.getLong("site_id"),
                rs.getLong("sender_user_id"),
                rs.getString("source_language"),
                rs.getString("target_language"),
                rs.getString("source_text"),
                rs.getString("translated_text"),
                rs.getTimestamp("created_at").toInstant()
            ))
            .single();
    }

    public MessageRow getMessage(Long messageId) {
        return jdbc.sql("""
                select id, thread_id, site_id, sender_user_id, source_language, target_language, source_text, translated_text, created_at
                from chat_messages
                where id = :id
            """)
            .param("id", messageId)
            .query((rs, rowNum) -> new MessageRow(
                rs.getLong("id"),
                rs.getLong("thread_id"),
                rs.getLong("site_id"),
                rs.getLong("sender_user_id"),
                rs.getString("source_language"),
                rs.getString("target_language"),
                rs.getString("source_text"),
                rs.getString("translated_text"),
                rs.getTimestamp("created_at").toInstant()
            ))
            .optional()
            .orElseThrow(() -> new NotFoundException("chat_message_not_found"));
    }

    public void markRead(Long messageId, Long readerUserId) {
        jdbc.sql("""
                insert into chat_message_reads(message_id, reader_user_id)
                values (:messageId, :readerUserId)
                on conflict (message_id, reader_user_id) do nothing
            """)
            .param("messageId", messageId)
            .param("readerUserId", readerUserId)
            .update();
    }

    public void markThreadMessagesRead(Long threadId, Long readerUserId) {
        jdbc.sql("""
                insert into chat_message_reads(message_id, reader_user_id)
                select id, :readerUserId
                from chat_messages
                where thread_id = :threadId
                  and sender_user_id <> :readerUserId
                on conflict (message_id, reader_user_id) do nothing
            """)
            .param("threadId", threadId)
            .param("readerUserId", readerUserId)
            .update();
    }

    public void updateTranslatedText(Long messageId, Long threadId, String translatedText) {
        jdbc.sql("""
                update chat_messages
                set translated_text = :translatedText
                where id = :messageId
                  and thread_id = :threadId
            """)
            .param("translatedText", translatedText)
            .param("messageId", messageId)
            .param("threadId", threadId)
            .update();
    }

    public boolean isMessageReadBy(Long messageId, Long readerUserId) {
        return Boolean.TRUE.equals(jdbc.sql("""
                select exists(
                    select 1
                    from chat_message_reads
                    where message_id = :messageId
                      and reader_user_id = :readerUserId
                )
            """)
            .param("messageId", messageId)
            .param("readerUserId", readerUserId)
            .query(Boolean.class)
            .single());
    }

    private List<String> rolesFor(Long userId) {
        return jdbc.sql("""
                select role
                from user_roles
                where user_id = :userId
                  and revoked_at is null
                order by role
            """)
            .param("userId", userId)
            .query(String.class)
            .list();
    }

    private List<Long> activeSitesFor(Long userId) {
        return jdbc.sql("""
                select site_id
                from site_memberships
                where user_id = :userId
                  and status = 'ACTIVE'
                order by site_id
            """)
            .param("userId", userId)
            .query(Long.class)
            .list();
    }

    public record ThreadRow(Long id, Long siteId, Long workerId, Long adminUserId, String status) {}
    public record MessageRow(Long id, Long threadId, Long siteId, Long senderUserId, String sourceLanguage, String targetLanguage, String sourceText, String translatedText, Instant createdAt) {}
    public record WorkerPeerRow(Long id, String displayName, String preferredLanguage, String nationality, Long siteId) {}
    public record AdminPeerRow(Long id, String displayName, String role, Long siteId) {}
    public record UserAccessRow(Long id, String displayName, String preferredLanguage, Set<String> roles, Set<Long> siteIds) {}
}
