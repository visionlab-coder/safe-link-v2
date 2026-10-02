package com.safelink.v3.live;

import com.safelink.v3.auth.SessionPrincipal;
import com.safelink.v3.domain.Role;
import com.safelink.v3.security.SiteGuard;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.util.Map;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

/** Records joining an active TBM, not proof of full listening or a signature. */
@RestController
@RequestMapping("/api/v1/live/tbm-participation")
public class TbmLiveParticipationController {
    private final JdbcClient jdbc;
    private final SiteGuard guard;
    public TbmLiveParticipationController(JdbcClient jdbc, SiteGuard guard) { this.jdbc=jdbc; this.guard=guard; }

    @PostMapping
    @Transactional
    public Map<String, Boolean> join(@AuthenticationPrincipal SessionPrincipal actor, @Valid @RequestBody Join request) {
        requireWorker(actor);
        guard.requireSiteAccess(actor,request.siteId(),"tbm.live.join","live_broadcast_session",request.sessionId());
        // Lock against broadcast-stop: participation is accepted only before the stop commits.
        boolean active = jdbc.sql("select active from live_broadcast_sessions where session_id=:id and site_id=:site for share")
            .param("id",request.sessionId()).param("site",request.siteId()).query(Boolean.class).optional().orElse(false);
        if (!request.sessionId().startsWith("tbm_") || !active) throw new IllegalArgumentException("active_tbm_required");
        jdbc.sql("insert into tbm_live_participation(session_id,worker_id,site_id) values(:id,:worker,:site) on conflict do nothing")
            .param("id",request.sessionId()).param("worker",actor.userId()).param("site",request.siteId()).update();
        return Map.of("attended",true);
    }

    @GetMapping
    public Map<String,Object> read(@AuthenticationPrincipal SessionPrincipal actor,
            @RequestParam Long siteId, @RequestParam(required=false) Long tbmId) {
        requireWorker(actor);
        guard.requireSiteAccess(actor,siteId,"tbm.live.participation.read","site",siteId.toString());
        String filter = tbmId == null
            ? "and m.tbm_notice_id is null and b.started_at > now() - interval '12 hours'"
            : "and m.tbm_notice_id=:notice";
        var query = jdbc.sql("""
            select p.session_id, m.tbm_notice_id
            from tbm_live_participation p
            join live_broadcast_sessions b on b.session_id=p.session_id and b.site_id=p.site_id
            left join live_tbm_summaries m on m.session_id=p.session_id and m.site_id=p.site_id
            where p.worker_id=:worker and p.site_id=:site
            """ + filter + " order by p.joined_at desc limit 1")
            .param("worker",actor.userId()).param("site",siteId);
        if (tbmId != null) query.param("notice",tbmId);
        return query.query((rs,n) -> Map.<String,Object>of("attended",true,"sessionId",rs.getString(1),
            "tbmId",rs.getString(2)==null ? "" : rs.getString(2)))
            .optional().orElse(Map.of("attended",false));
    }
    private void requireWorker(SessionPrincipal actor) {
        if (actor==null || !(actor.hasRole(Role.WORKER) || actor.hasRole(Role.TEMP_WORKER)))
            throw new AccessDeniedException("worker_required");
    }
    public record Join(@NotBlank @Size(max=120) String sessionId,@NotNull @Positive Long siteId) {}
}
