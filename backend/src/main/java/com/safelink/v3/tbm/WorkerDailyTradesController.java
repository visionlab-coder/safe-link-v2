package com.safelink.v3.tbm;

import com.safelink.v3.audit.AuditService;
import com.safelink.v3.auth.SessionPrincipal;
import com.safelink.v3.domain.Role;
import com.safelink.v3.security.SiteGuard;
import java.time.Clock;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;
import java.util.Map;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/tbm/compat/daily-trades")
public class WorkerDailyTradesController {
    private final JdbcClient jdbc;
    private final SiteGuard guard;
    private final AuditService audit;
    private final Clock clock;

    @Autowired
    public WorkerDailyTradesController(JdbcClient jdbc, SiteGuard guard, AuditService audit) {
        this(jdbc, guard, audit, Clock.system(ZoneId.of("Asia/Seoul")));
    }
    WorkerDailyTradesController(JdbcClient jdbc, SiteGuard guard, AuditService audit, Clock clock) {
        this.jdbc = jdbc; this.guard = guard; this.audit = audit; this.clock = clock;
    }
    private void authorize(SessionPrincipal actor, Long siteId) {
        if (actor == null || !actor.hasRole(Role.WORKER) || actor.hasRole(Role.TEMP_WORKER))
            throw new AccessDeniedException("worker_required");
        guard.requireSiteAccess(actor, siteId, "tbm.daily_trades", "site", String.valueOf(siteId));
    }
    @GetMapping
    public Selection get(@AuthenticationPrincipal SessionPrincipal actor, @RequestParam Long siteId) {
        authorize(actor, siteId);
        var day = LocalDate.now(clock);
        var trades = jdbc.sql("select trade_types::text from worker_daily_trades where worker_id=:worker and site_id=:site and work_date=:day")
            .param("worker", actor.userId()).param("site", siteId).param("day", day)
            .query(String.class).optional().map(TbmTrades::read).orElse(List.of());
        return new Selection(day.toString(), !trades.isEmpty(), trades);
    }
    @PutMapping
    @Transactional
    public Selection save(@AuthenticationPrincipal SessionPrincipal actor, @RequestParam Long siteId, @RequestBody Input input) {
        authorize(actor, siteId);
        var day = LocalDate.now(clock);
        if (!day.toString().equals(input.date())) throw new IllegalArgumentException("daily_trade_date_changed");
        var trades = TbmTrades.normalize(input.trades());
        if (trades.isEmpty()) throw new IllegalArgumentException("daily_trade_required");
        jdbc.sql("""
            insert into worker_daily_trades(worker_id,site_id,work_date,trade_types)
            values(:worker,:site,:day,cast(:trades as jsonb))
            on conflict(worker_id,site_id,work_date)
            do update set trade_types=excluded.trade_types,updated_at=now()
            """).param("worker", actor.userId()).param("site", siteId).param("day", day)
            .param("trades", TbmTrades.json(trades)).update();
        audit.record(actor.userId(), siteId, "tbm.daily_trades.save", "worker_daily_trades",
            actor.userId()+":"+siteId+":"+day, "ALLOWED", "worker_selected_daily_trades",
            Map.of("date", day.toString(), "trades", trades));
        return new Selection(day.toString(), true, trades);
    }
    public record Input(String date, List<String> trades) {}
    public record Selection(String date, boolean selected, List<String> trades) {}
}
