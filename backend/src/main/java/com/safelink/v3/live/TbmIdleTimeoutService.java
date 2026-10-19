package com.safelink.v3.live;

import com.safelink.v3.audit.AuditService;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Server-owned inactivity expiry: a closed/suspended browser cannot leave a TBM running. */
@Service
public class TbmIdleTimeoutService {
    private final JdbcClient jdbc;
    private final LiveInterpreterEventBus events;
    private final AuditService audit;

    public TbmIdleTimeoutService(JdbcClient jdbc, LiveInterpreterEventBus events, AuditService audit) {
        this.jdbc=jdbc; this.events=events; this.audit=audit;
    }

    @Scheduled(fixedDelay=15000, initialDelay=15000)
    @Transactional
    public void expireIdleBroadcasts() {
        // Same lock/order as nationwide start -> parent -> child sessions. Safe with concurrent
        // publishers, manual stop and multiple scheduler instances; no vendor calls while locked.
        jdbc.sql("select pg_advisory_xact_lock(737037)").query((rs,n)->true).single();
        jdbc.sql("select id from nationwide_tbm_broadcasts where mode='LIVE' and state='ACTIVE' order by id for update")
            .query(String.class).list();
        var sessions=jdbc.sql("""
            select s.session_id,s.site_id,s.started_by,s.last_activity_at,t.broadcast_id
            from live_broadcast_sessions s left join nationwide_tbm_targets t on t.session_id=s.session_id
            where s.active and left(s.session_id,4)='tbm_'
            order by s.site_id,s.id for update of s
            """).query((rs,n)->new Session(rs.getString(1),rs.getLong(2),rs.getLong(3),
                rs.getTimestamp(4).toInstant(),rs.getString(5))).list();
        Instant cutoff=jdbc.sql("select clock_timestamp()-interval '5 minutes'")
            .query((rs,n)->rs.getTimestamp(1).toInstant()).single();
        Map<String,List<Session>> groups=new LinkedHashMap<>();
        for (var session:sessions)
            groups.computeIfAbsent(session.parent()==null ? session.id():session.parent(),ignored->new ArrayList<>()).add(session);
        for (var group:groups.values()) {
            if (group.stream().anyMatch(session->session.activity().isAfter(cutoff))) continue;
            for (var session:group) {
                jdbc.sql("update live_broadcast_sessions set active=false,ended_at=clock_timestamp() where session_id=:id and active")
                    .param("id",session.id()).update();
                audit.record(null,session.site(),"tbm.live.auto_stop","live_broadcast_session",session.id(),
                    "ALLOWED","idle_5_minutes",Map.of("startedBy",session.owner(),"lastActivityAt",session.activity().toString()));
                events.publishAfterCommit(LiveInterpreterEventBus.translationsChannel(session.site()),"broadcast-stop",
                    new LiveInterpreterController.BroadcastSessionEvent(session.id(),session.site().toString(),session.owner().toString(),false));
            }
            if (group.getFirst().parent()!=null)
                jdbc.sql("update nationwide_tbm_broadcasts set state='STOPPED' where id=:id and state='ACTIVE'")
                    .param("id",group.getFirst().parent()).update();
        }
    }
    private record Session(String id,Long site,Long owner,Instant activity,String parent) {}
}
