package com.safelink.v3.live;

import com.safelink.v3.auth.SessionPrincipal;
import com.safelink.v3.security.SiteGuard;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.util.Map;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.web.bind.annotation.*;

/** Editable until final publication. Never changes an already signed/published notice. */
@RestController
@RequestMapping("/api/v1/live/tbm-draft")
public class TbmLiveDraftController {
    private final JdbcClient jdbc;
    private final SiteGuard guard;
    private final LiveInterpreterEventBus events;
    public TbmLiveDraftController(JdbcClient jdbc, SiteGuard guard, LiveInterpreterEventBus events) {
        this.jdbc = jdbc; this.guard = guard; this.events = events;
    }
    @GetMapping
    public Map<String,Object> get(@AuthenticationPrincipal SessionPrincipal actor,
            @RequestParam String sessionId, @RequestParam Long siteId) {
        guard.requireSiteAccess(actor,siteId,"tbm.live.draft.read","live_broadcast_session",sessionId);
        return jdbc.sql("select content_ko,revision from tbm_live_drafts where session_id=:id and site_id=:site")
            .param("id",sessionId).param("site",siteId)
            .query((rs,n) -> new Draft(sessionId,rs.getString(1),rs.getLong(2)))
            .optional().<Map<String,Object>>map(draft -> Map.of("draft",draft)).orElse(Map.of());
    }
    @PostMapping
    @Transactional
    public Draft save(@AuthenticationPrincipal SessionPrincipal actor, @Valid @RequestBody Request request) {
        guard.requireGlobalOrSiteAdmin(actor,request.siteId(),"tbm.live.draft.update","live_broadcast_session",request.sessionId());
        Long owner = jdbc.sql("select started_by from live_broadcast_sessions where session_id=:id and site_id=:site for update")
            .param("id",request.sessionId()).param("site",request.siteId()).query(Long.class)
            .optional().orElseThrow(() -> new IllegalArgumentException("live_session_not_found"));
        if (!owner.equals(actor.userId())) throw new AccessDeniedException("live_session_owner_required");
        if (!request.sessionId().startsWith("tbm_")) throw new IllegalArgumentException("tbm_session_required");
        if (jdbc.sql("select exists(select 1 from live_tbm_summaries where session_id=:id)")
                .param("id",request.sessionId()).query(Boolean.class).single())
            throw new IllegalArgumentException("tbm_already_published");
        Draft draft = jdbc.sql("""
            insert into tbm_live_drafts(session_id,site_id,content_ko) values(:id,:site,:text)
            on conflict(session_id) do update set content_ko=excluded.content_ko,
                revision=tbm_live_drafts.revision+1,updated_at=now()
            returning content_ko,revision
            """).param("id",request.sessionId()).param("site",request.siteId()).param("text",request.content())
            .query((rs,n) -> new Draft(request.sessionId(),rs.getString(1),rs.getLong(2))).single();
        TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
            @Override public void afterCommit() {
                events.publish(LiveInterpreterEventBus.translationsChannel(request.siteId()),"tbm-draft",draft);
            }
        });
        return draft;
    }
    public record Request(@NotBlank @Size(max=120) String sessionId,@NotNull @Positive Long siteId,
            @NotNull @Size(max=60000) String content) {}
    public record Draft(String sessionId,String content,long revision) {}
}
