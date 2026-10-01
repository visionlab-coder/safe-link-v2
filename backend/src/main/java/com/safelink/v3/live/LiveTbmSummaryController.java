package com.safelink.v3.live;

import com.safelink.v3.ai.*;
import com.safelink.v3.audit.AuditService;
import com.safelink.v3.auth.SessionPrincipal;
import com.safelink.v3.security.SiteGuard;
import com.safelink.v3.support.ServiceUnavailableException;
import com.safelink.v3.tbm.TbmRepository;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;
import java.time.Duration;
import java.time.Instant;
import java.util.Map;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.web.bind.annotation.*;

/** A stopped broadcast becomes exactly one immutable, signable TBM notice. */
@RestController
@RequestMapping("/api/v1/live/summary")
public class LiveTbmSummaryController {
    private final JdbcClient jdbc;
    private final SiteGuard guard;
    private final TbmRepository tbm;
    private final AiVendorService vendor;
    private final AiProperties properties;
    private final AiQuotaService quota;
    private final AiUsageRepository usage;
    private final AuditService audit;
    private final LiveInterpreterEventBus events;

    public LiveTbmSummaryController(JdbcClient jdbc, SiteGuard guard, TbmRepository tbm,
            AiVendorService vendor, AiProperties properties, AiQuotaService quota,
            AiUsageRepository usage, AuditService audit, LiveInterpreterEventBus events) {
        this.jdbc=jdbc; this.guard=guard; this.tbm=tbm; this.vendor=vendor;
        this.properties=properties; this.quota=quota; this.usage=usage; this.audit=audit; this.events=events;
    }

    @GetMapping
    public Map<String, Object> get(@AuthenticationPrincipal SessionPrincipal actor,
            @RequestParam String sessionId, @RequestParam Long siteId) {
        guard.requireSiteAccess(actor, siteId, "live.summary.read", "live_broadcast_session", sessionId);
        return find(sessionId, siteId).<Map<String,Object>>map(s -> Map.of("summary", s)).orElse(Map.of());
    }

    @PostMapping
    @Transactional(timeout = 60)
    public Summary finish(@AuthenticationPrincipal SessionPrincipal actor, @Valid @RequestBody Request request) {
        guard.requireGlobalOrSiteAdmin(actor, request.siteId(), "live.summary.create", "live_broadcast_session", request.sessionId());
        // Serialize concurrent/retried completion requests using only this session row.
        var session = jdbc.sql("select started_by,active from live_broadcast_sessions where session_id=:id and site_id=:site for update")
            .param("id",request.sessionId()).param("site",request.siteId())
            .query((rs,n) -> new Session(rs.getLong("started_by"),rs.getBoolean("active")))
            .optional().orElseThrow(() -> new IllegalArgumentException("live_session_not_found"));
        validateSession(actor.userId(),session.owner(),session.active());
        var existing = find(request.sessionId(),request.siteId());
        if (existing.isPresent()) return existing.get();
        if (tbm.listWorkers(actor.hasAnyGlobalRole(),actor.siteIds(),request.siteId()).isEmpty())
            throw new IllegalArgumentException("tbm_no_target_workers");
        String transcript = jdbc.sql("select text_ko from live_translation_events where session_id=:id and site_id=:site and created_by=:owner order by id")
            .param("id",request.sessionId()).param("site",request.siteId()).param("owner",session.owner())
            .query(String.class).list().stream().collect(java.util.stream.Collectors.joining("\n"));
        validateTranscript(transcript);
        if (!properties.isVendorEnabled()) throw new ServiceUnavailableException("ai_vendor_not_configured");
        if (!quota.checkAndIncrement("tbm_summary",request.siteId(),actor.userId()).allowed())
            throw new AccessDeniedException("ai_quota_exceeded");
        Instant start = Instant.now();
        var result = vendor.summarizeTbm(transcript);
        String summary = result.text().trim();
        if (summary.isBlank() || summary.length()>12000) throw new ServiceUnavailableException("tbm_summary_invalid");
        var notice = tbm.createPublished(request.siteId(), actor.userId(), "TBM · AI 요약", summary, "live-summary:"+request.sessionId());
        jdbc.sql("insert into live_tbm_summaries(session_id,site_id,created_by,source_transcript,summary_text,model,tbm_notice_id) values(:id,:site,:owner,:source,:summary,:model,:notice)")
            .param("id",request.sessionId()).param("site",request.siteId()).param("owner",actor.userId())
            .param("source",transcript).param("summary",summary).param("model",result.model()).param("notice",notice.id()).update();
        usage.log(actor.userId(),request.siteId(),"tbm_summary",result.vendor(),result.model(),transcript.length(),summary.length(),Duration.between(start,Instant.now()).toMillis(),AiCostEstimator.estimate("tbm_summary",result.vendor(),transcript.length(),summary.length()));
        audit.record(actor.userId(),request.siteId(),"tbm.notice.create","tbm_notice",notice.id().toString(),"ALLOWED","live_summary",Map.of("sessionId",request.sessionId(),"model",result.model()));
        var response = new Summary(request.sessionId(),notice.id().toString(),summary);
        TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
            @Override public void afterCommit() {
                events.publish(LiveInterpreterEventBus.translationsChannel(request.siteId()),"tbm-summary",response);
            }
        });
        return response;
    }

    private java.util.Optional<Summary> find(String id,Long site) {
        return jdbc.sql("select session_id,tbm_notice_id,summary_text from live_tbm_summaries where session_id=:id and site_id=:site")
            .param("id",id).param("site",site)
            .query((rs,n) -> new Summary(rs.getString(1),rs.getString(2),rs.getString(3))).optional();
    }
    static void validateSession(Long actor,Long owner,boolean active) {
        if (!actor.equals(owner)) throw new AccessDeniedException("live_session_owner_required");
        if (active) throw new IllegalArgumentException("live_session_not_stopped");
    }
    static void validateTranscript(String transcript) {
        if (transcript.isBlank()) throw new IllegalArgumentException("tbm_transcript_empty");
        // Never silently truncate a safety briefing.
        if (transcript.length()>60000) throw new IllegalArgumentException("tbm_transcript_too_long");
    }
    private record Session(Long owner,boolean active) {}
    public record Request(@NotBlank @Size(max=120) String sessionId,@NotNull @Positive Long siteId) {}
    public record Summary(String sessionId,String tbmId,String text) {}
}
