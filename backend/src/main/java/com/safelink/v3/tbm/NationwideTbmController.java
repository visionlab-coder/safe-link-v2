package com.safelink.v3.tbm;

import com.fasterxml.jackson.annotation.JsonProperty;
import com.safelink.v3.audit.AuditService;
import com.safelink.v3.auth.SessionPrincipal;
import com.safelink.v3.live.*;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.util.List;
import java.util.Map;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

/** HQ-only fan-out. Memberships and site-scoped worker permissions are never changed. */
@RestController
@RequestMapping("/api/v1/tbm/nationwide")
public class NationwideTbmController {
    private final JdbcClient jdbc;
    private final LiveInterpreterController live;
    private final TbmLiveDraftController drafts;
    private final TbmRepository tbm;
    private final LiveInterpreterEventBus events;
    private final AuditService audit;

    public NationwideTbmController(JdbcClient jdbc, LiveInterpreterController live,
            TbmLiveDraftController drafts, TbmRepository tbm, LiveInterpreterEventBus events, AuditService audit) {
        this.jdbc=jdbc; this.live=live; this.drafts=drafts; this.tbm=tbm; this.events=events; this.audit=audit;
    }

    @GetMapping("/targets")
    public Map<String,Object> targets(@AuthenticationPrincipal SessionPrincipal actor) {
        NationwideTbmAccess.require(actor);
        var sites = activeSites();
        return Map.of("targetCount", sites.size(), "scope", "NATIONWIDE");
    }

    @PostMapping("/sessions")
    @Transactional
    public Map<String,Object> start(@AuthenticationPrincipal SessionPrincipal actor, @Valid @RequestBody Request request) {
        NationwideTbmAccess.require(actor);
        requireConfirmed(request);
        // Serializes nationwide and ordinary session starts, not speech or unrelated APIs.
        lockStarts();
        var existing = group(request.sessionId());
        if (existing != null) {
            requireOwner(actor,existing);
            if (!existing.mode().equals("LIVE") || !existing.state().equals("ACTIVE"))
                throw new IllegalArgumentException("nationwide_tbm_already_stopped");
            return started(request.sessionId());
        }
        var sites = activeSites();
        if (sites.isEmpty()) throw new IllegalArgumentException("nationwide_tbm_no_sites");
        if (jdbc.sql("select exists(select 1 from live_broadcast_sessions where active=true and site_id in (:sites))")
                .param("sites",sites).query(Boolean.class).single())
            throw new IllegalArgumentException("nationwide_tbm_live_conflict");
        insertGroup(actor,request.sessionId(),"LIVE","ACTIVE");
        for (Long site : sites) {
            String child = request.sessionId()+"_s"+site;
            live.startSession(actor,new LiveInterpreterController.BroadcastSessionRequest(child,site.toString()));
            jdbc.sql("insert into nationwide_tbm_targets(broadcast_id,site_id,session_id) values(:id,:site,:session)")
                .param("id",request.sessionId()).param("site",site).param("session",child).update();
        }
        record(actor,request.sessionId(),"start",sites.size());
        return started(request.sessionId());
    }

    @PostMapping("/speaking")
    @Transactional
    public Map<String,Boolean> speaking(@AuthenticationPrincipal SessionPrincipal actor, @Valid @RequestBody Request request) {
        requireLive(actor,request.sessionId(),true);
        for (var target : targetRows(request.sessionId()))
            live.announceSpeech(actor,new LiveInterpreterController.BroadcastSessionRequest(target.sessionId(),target.siteId().toString()));
        return Map.of("announced",true);
    }

    @PostMapping("/translations")
    @Transactional
    public Map<String,Boolean> translate(@AuthenticationPrincipal SessionPrincipal actor, @Valid @RequestBody Request request) {
        requireLive(actor,request.sessionId(),true);
        String text = required(request.textKo(),60000,"content_required");
        for (var target : targetRows(request.sessionId()))
            live.createTranslation(actor,new LiveInterpreterController.TranslationRequest(target.sessionId(),target.siteId().toString(),text,Map.of()));
        return Map.of("sent",true);
    }

    @PostMapping("/draft")
    @Transactional
    public Map<String,Boolean> draft(@AuthenticationPrincipal SessionPrincipal actor, @Valid @RequestBody Request request) {
        requireLive(actor,request.sessionId(),false);
        if (request.content()==null) throw new IllegalArgumentException("content_required");
        for (var target : targetRows(request.sessionId()))
            drafts.save(actor,new TbmLiveDraftController.Request(target.sessionId(),target.siteId(),request.content()));
        return Map.of("saved",true);
    }

    @PostMapping("/stop")
    @Transactional
    public Map<String,Boolean> stop(@AuthenticationPrincipal SessionPrincipal actor, @Valid @RequestBody Request request) {
        var g = owned(actor,request.sessionId());
        if (!g.mode().equals("LIVE")) throw new IllegalArgumentException("tbm_session_required");
        if (!g.state().equals("ACTIVE")) return Map.of("stopped",true);
        for (var target : targetRows(request.sessionId()))
            live.stopSession(actor,target.sessionId(),target.siteId().toString());
        jdbc.sql("update nationwide_tbm_broadcasts set state='STOPPED' where id=:id").param("id",request.sessionId()).update();
        record(actor,request.sessionId(),"stop",targetRows(request.sessionId()).size());
        return Map.of("stopped",true);
    }

    @PostMapping("/summary")
    @Transactional
    public Publication finish(@AuthenticationPrincipal SessionPrincipal actor, @Valid @RequestBody Request request) {
        var g = owned(actor,request.sessionId());
        if (!g.mode().equals("LIVE") || g.state().equals("ACTIVE")) throw new IllegalArgumentException("live_session_not_stopped");
        if (g.state().equals("PUBLISHED")) return publication(request.sessionId());
        return publish(actor,request,true);
    }

    @PostMapping("/broadcast")
    @Transactional
    public Publication broadcast(@AuthenticationPrincipal SessionPrincipal actor, @Valid @RequestBody Request request) {
        NationwideTbmAccess.require(actor);
        requireConfirmed(request);
        lockStarts();
        var g = group(request.sessionId());
        if (g != null) {
            requireOwner(actor,g);
            if (!g.mode().equals("NOTICE")) throw new IllegalArgumentException("nationwide_tbm_mode_invalid");
            return publication(request.sessionId());
        }
        var sites = activeSites();
        if (sites.isEmpty()) throw new IllegalArgumentException("nationwide_tbm_no_sites");
        insertGroup(actor,request.sessionId(),"NOTICE","STOPPED");
        for (Long site : sites)
            jdbc.sql("insert into nationwide_tbm_targets(broadcast_id,site_id) values(:id,:site)")
                .param("id",request.sessionId()).param("site",site).update();
        return publish(actor,request,false);
    }

    private Publication publish(SessionPrincipal actor,Request request,boolean isLive) {
        String source = required(request.contentKo(),60000,"content_required");
        String summary = request.summaryKo()==null ? null : request.summaryKo().trim();
        if (isLive) required(summary,12000,"tbm_summary_required");
        var targets = targetRows(request.sessionId());
        for (var target : targets) {
            if (isLive) {
                boolean active = jdbc.sql("select active from live_broadcast_sessions where session_id=:id for update")
                    .param("id",target.sessionId()).query(Boolean.class).single();
                if (active) throw new IllegalArgumentException("live_session_not_stopped");
                var saved = jdbc.sql("select content_ko from tbm_live_drafts where session_id=:id")
                    .param("id",target.sessionId()).query(String.class).optional();
                if (saved.isPresent() && !saved.get().trim().equals(source)) throw new IllegalArgumentException("tbm_draft_changed");
            }
            var notice = tbm.createPublished(target.siteId(),actor.userId(),"전국 TBM 안전 브리핑",source,
                "nationwide:"+request.sessionId(),summary);
            jdbc.sql("update nationwide_tbm_targets set tbm_notice_id=:notice where broadcast_id=:id and site_id=:site")
                .param("notice",notice.id()).param("id",request.sessionId()).param("site",target.siteId()).update();
            if (isLive) {
                jdbc.sql("insert into live_tbm_summaries(session_id,site_id,created_by,source_transcript,summary_text,model,tbm_notice_id) values(:id,:site,:owner,:source,:summary,'admin-reviewed',:notice)")
                    .param("id",target.sessionId()).param("site",target.siteId()).param("owner",actor.userId())
                    .param("source",source).param("summary",summary).param("notice",notice.id()).update();
                events.publishAfterCommit(LiveInterpreterEventBus.translationsChannel(target.siteId()),"tbm-summary",
                    new LiveTbmSummaryController.Summary(target.sessionId(),notice.id().toString(),summary));
            }
            audit.record(actor.userId(),target.siteId(),"tbm.notice.create","tbm_notice",notice.id().toString(),"ALLOWED","nationwide",Map.of("broadcastId",request.sessionId()));
        }
        jdbc.sql("update nationwide_tbm_broadcasts set state='PUBLISHED' where id=:id").param("id",request.sessionId()).update();
        record(actor,request.sessionId(),"publish",targets.size());
        return publication(request.sessionId());
    }

    private Publication publication(String id) {
        var rows=targetRows(id);
        Long first=rows.getFirst().noticeId();
        if (first==null) throw new IllegalArgumentException("nationwide_tbm_not_published");
        var notice=tbm.getNotice(first);
        return new Publication(id,first.toString(),notice.summaryText()==null?notice.sourceText():notice.summaryText(),rows.size());
    }
    private Map<String,Object> started(String id) { return Map.of("sessionId",id,"targetCount",targetRows(id).size()); }
    private void requireLive(SessionPrincipal actor,String id,boolean active) {
        var g=owned(actor,id);
        if (!g.mode().equals("LIVE") || g.state().equals("PUBLISHED") || (active&&!g.state().equals("ACTIVE")))
            throw new IllegalArgumentException("live_session_not_active_or_owned");
    }
    private Group owned(SessionPrincipal actor,String id) {
        NationwideTbmAccess.require(actor);
        var g=group(id);
        if (g==null) throw new IllegalArgumentException("live_session_not_found");
        requireOwner(actor,g); return g;
    }
    private void requireOwner(SessionPrincipal actor,Group g) {
        if (!g.owner().equals(actor.userId())) throw new AccessDeniedException("live_session_owner_required");
    }
    private Group group(String id) {
        return jdbc.sql("select created_by,mode,state from nationwide_tbm_broadcasts where id=:id for update")
            .param("id",id).query((rs,n)->new Group(rs.getLong(1),rs.getString(2),rs.getString(3))).optional().orElse(null);
    }
    private List<Long> activeSites() { return jdbc.sql("select id from sites where status='ACTIVE' order by id").query(Long.class).list(); }
    private List<Target> targetRows(String id) {
        return jdbc.sql("select site_id,session_id,tbm_notice_id from nationwide_tbm_targets where broadcast_id=:id order by site_id")
            .param("id",id).query((rs,n)->new Target(rs.getLong(1),rs.getString(2),(Long)rs.getObject(3))).list();
    }
    private void insertGroup(SessionPrincipal actor,String id,String mode,String state) {
        jdbc.sql("insert into nationwide_tbm_broadcasts(id,created_by,mode,state) values(:id,:owner,:mode,:state)")
            .param("id",id).param("owner",actor.userId()).param("mode",mode).param("state",state).update();
    }
    private void lockStarts() { jdbc.sql("select pg_advisory_xact_lock(737037)").query((rs,n)->true).single(); }
    private void record(SessionPrincipal actor,String id,String action,int count) {
        audit.record(actor.userId(),null,"tbm.nationwide."+action,"nationwide_tbm",id,"ALLOWED","explicit_nationwide",Map.of("targetCount",count));
    }
    private static void requireConfirmed(Request r) { if (!r.confirmed()) throw new IllegalArgumentException("nationwide_tbm_confirmation_required"); }
    private static String required(String text,int max,String error) {
        if (text==null || text.isBlank() || text.length()>max) throw new IllegalArgumentException(error);
        return text.trim();
    }
    private record Group(Long owner,String mode,String state) {}
    private record Target(Long siteId,String sessionId,Long noticeId) {}
    public record Publication(String sessionId,String tbmId,String text,int targetCount) {}
    public record Request(@NotBlank @Pattern(regexp="tbm_[A-Za-z0-9_-]{1,70}") String sessionId,
        boolean confirmed, @Size(max=60000) @JsonProperty("text_ko") String textKo,
        @Size(max=60000) String content, @Size(max=60000) @JsonProperty("content_ko") String contentKo,
        @Size(max=12000) @JsonProperty("summary_ko") String summaryKo) {}
}
