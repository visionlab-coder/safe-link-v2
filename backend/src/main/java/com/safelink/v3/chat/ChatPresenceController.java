package com.safelink.v3.chat;

import com.safelink.v3.auth.SessionPrincipal;
import jakarta.validation.constraints.NotBlank;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * Chat-only presence. A user is online while the chat screen sends a heartbeat
 * within the last 45 seconds. The lookup is always restricted to a shared site.
 */
@RestController
@RequestMapping("/api/v1/chat/compat/presence")
public class ChatPresenceController {
    private static final int PRESENCE_WINDOW_SECONDS = 45;
    private static final int MAX_PEERS = 100;

    private final JdbcClient jdbc;

    public ChatPresenceController(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    @PostMapping
    public PresenceResponse heartbeat(@AuthenticationPrincipal SessionPrincipal actor) {
        requireActor(actor);
        Long siteId = actor.siteIds().stream().findFirst().orElse(null);
        if (siteId == null) return new PresenceResponse(List.of());

        jdbc.sql("""
                insert into chat_presence(user_id, site_id, last_seen_at)
                values (:userId, :siteId, now())
                on conflict (user_id) do update
                set site_id = excluded.site_id, last_seen_at = excluded.last_seen_at
                """)
            .param("userId", actor.userId())
            .param("siteId", siteId)
            .update();
        return new PresenceResponse(List.of(String.valueOf(actor.userId())));
    }

    @GetMapping
    public PresenceResponse online(
        @AuthenticationPrincipal SessionPrincipal actor,
        @RequestParam("user_ids") @NotBlank String userIds
    ) {
        requireActor(actor);
        List<Long> peers = parseIds(userIds);
        if (peers.isEmpty()) return new PresenceResponse(List.of());

        boolean globalRole = actor.hasAnyGlobalRole();
        String siteScope = globalRole
            ? "true"
            : "membership.site_id in (:siteIds)";
        String query = """
                select distinct presence.user_id
                from chat_presence presence
                join site_memberships membership
                  on membership.user_id = presence.user_id
                 and membership.site_id = presence.site_id
                 and membership.status = 'ACTIVE'
                where presence.user_id in (:peerIds)
                  and presence.last_seen_at >= now() - interval '45 seconds'
                  and (""" + siteScope + ")";
        var statement = jdbc.sql(query)
            .param("peerIds", peers);
        if (!globalRole) statement.param("siteIds", actor.siteIds());
        List<String> ids = statement
            .query(Long.class)
            .list()
            .stream()
            .map(String::valueOf)
            .toList();
        return new PresenceResponse(ids);
    }

    private static void requireActor(SessionPrincipal actor) {
        if (actor == null) throw new AccessDeniedException("authentication_required");
    }

    private static List<Long> parseIds(String raw) {
        Set<Long> parsed = new LinkedHashSet<>();
        for (String value : raw.split(",")) {
            try {
                long id = Long.parseLong(value.trim());
                if (id > 0) parsed.add(id);
            } catch (NumberFormatException ignored) {
                // Invalid peer ids are ignored; no arbitrary user lookup is allowed.
            }
            if (parsed.size() >= MAX_PEERS) break;
        }
        return new ArrayList<>(parsed);
    }

    public record PresenceResponse(List<String> online_user_ids) {}
}
