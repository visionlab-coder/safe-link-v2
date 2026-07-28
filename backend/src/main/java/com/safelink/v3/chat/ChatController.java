package com.safelink.v3.chat;

import com.fasterxml.jackson.annotation.JsonProperty;
import com.safelink.v3.audit.AuditService;
import com.safelink.v3.auth.SessionPrincipal;
import com.safelink.v3.domain.Role;
import com.safelink.v3.security.SiteGuard;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import java.time.Instant;
import java.time.format.DateTimeParseException;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

@RestController
@RequestMapping("/api/v1/chat")
public class ChatController {
    private final ChatRepository chat;
    private final ChatEventBus eventBus;
    private final SiteGuard siteGuard;
    private final AuditService audit;

    public ChatController(ChatRepository chat, ChatEventBus eventBus, SiteGuard siteGuard, AuditService audit) {
        this.chat = chat;
        this.eventBus = eventBus;
        this.siteGuard = siteGuard;
        this.audit = audit;
    }

    @GetMapping("/threads/{threadId}/messages")
    public List<ChatRepository.MessageRow> messages(@AuthenticationPrincipal SessionPrincipal actor, @PathVariable Long threadId) {
        var thread = chat.getThread(threadId);
        siteGuard.requireSiteAccess(actor, thread.siteId(), "chat.messages.read", "chat_thread", String.valueOf(threadId));
        requireConversationAccess(actor, thread, "chat.messages.read");
        return chat.listMessages(threadId);
    }

    @PostMapping("/threads/{threadId}/messages")
    public ChatRepository.MessageRow send(@AuthenticationPrincipal SessionPrincipal actor, @PathVariable Long threadId, @Valid @RequestBody SendMessageRequest request) {
        var thread = chat.getThread(threadId);
        siteGuard.requireSiteAccess(actor, thread.siteId(), "chat.message.create", "chat_thread", String.valueOf(threadId));
        requireConversationAccess(actor, thread, "chat.message.create");
        var inserted = chat.insertMessage(
            threadId,
            thread.siteId(),
            actor.userId(),
            request.sourceLanguage(),
            request.targetLanguage(),
            request.sourceText(),
            request.translatedText(),
            request.clientMessageId()
        );
        audit.record(actor.userId(), thread.siteId(), "chat.message.create", "chat_message", String.valueOf(inserted.id()), "ALLOWED", "server_api", Map.of("threadId", threadId));
        eventBus.publish(threadId, inserted);
        eventBus.publishUser(thread.workerId(), inserted);
        eventBus.publishUser(thread.adminUserId(), inserted);
        return inserted;
    }

    @PostMapping("/messages/{messageId}/read")
    public Map<String, Boolean> read(@AuthenticationPrincipal SessionPrincipal actor, @PathVariable Long messageId) {
        var message = chat.getMessage(messageId);
        siteGuard.requireSiteAccess(actor, message.siteId(), "chat.message.read", "chat_message", String.valueOf(messageId));
        var thread = chat.getThread(message.threadId());
        requireConversationAccess(actor, thread, "chat.message.read");
        chat.markRead(messageId, actor.userId());
        audit.record(actor.userId(), message.siteId(), "chat.message.read", "chat_message", String.valueOf(messageId), "ALLOWED", "read_receipt", Map.of());
        eventBus.publish(message.threadId(), Map.of("type", "read", "userId", actor.userId()));
        return Map.of("ok", true);
    }

    @GetMapping("/threads/{threadId}/events")
    public SseEmitter events(@AuthenticationPrincipal SessionPrincipal actor, @PathVariable Long threadId) {
        var thread = chat.getThread(threadId);
        siteGuard.requireSiteAccess(actor, thread.siteId(), "chat.events.subscribe", "chat_thread", String.valueOf(threadId));
        requireConversationAccess(actor, thread, "chat.events.subscribe");
        return eventBus.subscribe(threadId);
    }

    @GetMapping("/compat/admin/workers")
    public AdminWorkersResponse adminWorkers(@AuthenticationPrincipal SessionPrincipal actor) {
        requireChatAdmin(actor);
        var workers = chat.listWorkersForAdmin(actor.hasAnyGlobalRole(), actor.siteIds()).stream()
            .map(worker -> new WorkerPeerResponse(
                String.valueOf(worker.id()),
                worker.displayName() == null || worker.displayName().isBlank() ? "Worker" : worker.displayName(),
                worker.preferredLanguage() == null || worker.preferredLanguage().isBlank() ? "ko" : worker.preferredLanguage(),
                worker.nationality(),
                String.valueOf(worker.siteId())
            ))
            .toList();
        return new AdminWorkersResponse(firstSiteId(actor.siteIds()), primaryRole(actor.roles()), workers);
    }

    @GetMapping("/compat/worker/admins")
    public WorkerAdminsResponse workerAdmins(@AuthenticationPrincipal SessionPrincipal actor) {
        requireWorker(actor);
        var worker = chat.getUserAccess(actor.userId());
        var admins = chat.listAdminsForWorker(actor.siteIds()).stream()
            .map(admin -> new AdminPeerResponse(
                String.valueOf(admin.id()),
                admin.displayName() == null || admin.displayName().isBlank() ? "관리자" : admin.displayName(),
                admin.role(),
                String.valueOf(admin.siteId())
            ))
            .toList();
        return new WorkerAdminsResponse(
            new WorkerSelfResponse(
                String.valueOf(actor.userId()),
                worker.preferredLanguage() == null || worker.preferredLanguage().isBlank() ? "ko" : worker.preferredLanguage(),
                firstSiteId(actor.siteIds())
            ),
            admins
        );
    }

    @GetMapping("/compat/messages")
    public ChatMessagesResponse compatMessages(
        @AuthenticationPrincipal SessionPrincipal actor,
        @RequestParam("peer_id") String peerId,
        @RequestParam(defaultValue = "50") int limit,
        @RequestParam(required = false) String before
    ) {
        var conversation = resolveConversation(actor, parsePeerId(peerId));
        siteGuard.requireSiteAccess(actor, conversation.thread().siteId(), "chat.messages.read", "chat_thread", String.valueOf(conversation.thread().id()));
        int safeLimit = Math.max(1, Math.min(limit, 100));
        var messages = chat.listRecentMessages(conversation.thread().id(), parseBefore(before), safeLimit).stream()
            .map(message -> toCompatMessage(message, conversation))
            .toList();
        return new ChatMessagesResponse(messages);
    }

    @GetMapping("/compat/events")
    public SseEmitter compatEvents(
        @AuthenticationPrincipal SessionPrincipal actor,
        @RequestParam("peer_id") String peerId
    ) {
        var conversation = resolveConversation(actor, parsePeerId(peerId));
        siteGuard.requireSiteAccess(actor, conversation.thread().siteId(), "chat.events.subscribe", "chat_thread", String.valueOf(conversation.thread().id()));
        return eventBus.subscribe(conversation.thread().id());
    }

    @GetMapping("/compat/user-events")
    public SseEmitter compatUserEvents(@AuthenticationPrincipal SessionPrincipal actor) {
        if (actor == null) throw new AccessDeniedException("authentication_required");
        return eventBus.subscribeUser(actor.userId());
    }

    @PostMapping("/compat/messages")
    public ChatMessageResponse compatSend(
        @AuthenticationPrincipal SessionPrincipal actor,
        @RequestBody CompatSendMessageRequest request
    ) {
        var conversation = resolveConversation(actor, parsePeerId(request.toUser()));
        siteGuard.requireSiteAccess(actor, conversation.thread().siteId(), "chat.message.create", "chat_thread", String.valueOf(conversation.thread().id()));
        String sourceText = request.sourceText() == null ? "" : request.sourceText().trim();
        if (sourceText.isBlank()) {
            throw new IllegalArgumentException("empty_message");
        }
        var inserted = chat.insertMessage(
            conversation.thread().id(),
            conversation.thread().siteId(),
            actor.userId(),
            cleanLanguage(request.sourceLang()),
            cleanLanguage(request.targetLang()),
            sourceText,
            request.translatedText() == null ? sourceText : request.translatedText(),
            cleanClientMessageId(request.clientMessageId())
        );
        audit.record(actor.userId(), conversation.thread().siteId(), "chat.message.create", "chat_message", String.valueOf(inserted.id()), "ALLOWED", "compat_server_api", Map.of("threadId", conversation.thread().id()));
        eventBus.publish(conversation.thread().id(), inserted);
        eventBus.publishUser(conversation.workerId(), inserted);
        eventBus.publishUser(conversation.adminId(), inserted);
        return new ChatMessageResponse(toCompatMessage(inserted, conversation));
    }

    @PatchMapping("/compat/messages")
    public Map<String, Boolean> compatRead(
        @AuthenticationPrincipal SessionPrincipal actor,
        @RequestBody CompatReadRequest request
    ) {
        var conversation = resolveConversation(actor, parsePeerId(request.peerId()));
        siteGuard.requireSiteAccess(actor, conversation.thread().siteId(), "chat.message.read", "chat_thread", String.valueOf(conversation.thread().id()));
        if (request.translations() != null && !request.translations().isEmpty()) {
            for (var update : request.translations()) {
                Long messageId = parsePeerId(update.id());
                var message = chat.getMessage(messageId);
                if (!message.threadId().equals(conversation.thread().id())) {
                    throw new IllegalArgumentException("message_thread_mismatch");
                }
                chat.updateTranslatedText(messageId, conversation.thread().id(), update.translatedText());
                audit.record(actor.userId(), conversation.thread().siteId(), "chat.message.translation.update", "chat_message", update.id(), "ALLOWED", "compat_translation_correction", Map.of());
            }
            eventBus.publish(conversation.thread().id(), Map.of("type", "translation-updated"));
            return Map.of("ok", true);
        }
        chat.markThreadMessagesRead(conversation.thread().id(), actor.userId());
        audit.record(actor.userId(), conversation.thread().siteId(), "chat.message.read", "chat_thread", String.valueOf(conversation.thread().id()), "ALLOWED", "compat_read_receipt", Map.of());
        eventBus.publish(conversation.thread().id(), Map.of("type", "read", "userId", actor.userId()));
        return Map.of("ok", true);
    }

    private CompatMessageResponse toCompatMessage(ChatRepository.MessageRow message, Conversation conversation) {
        String fromUser = String.valueOf(message.senderUserId());
        String toUser = message.senderUserId().equals(conversation.workerId())
            ? String.valueOf(conversation.adminId())
            : String.valueOf(conversation.workerId());
        boolean read = chat.isMessageReadBy(message.id(), Long.valueOf(toUser));
        return new CompatMessageResponse(
            String.valueOf(message.id()),
            fromUser,
            toUser,
            message.sourceLanguage(),
            message.targetLanguage(),
            message.sourceText(),
            message.translatedText() == null ? message.sourceText() : message.translatedText(),
            message.createdAt().toString(),
            read
        );
    }

    private Conversation resolveConversation(SessionPrincipal actor, Long peerId) {
        if (actor == null) {
            throw new IllegalArgumentException("authentication_required");
        }
        if (actor.userId().equals(peerId)) {
            throw new IllegalArgumentException("invalid_peer_id");
        }

        var peer = chat.getUserAccess(peerId);
        boolean actorIsWorker = actor.hasRole(Role.WORKER);
        boolean actorIsAdmin = canUseAdminChat(actor.roles());

        Long siteId;
        Long workerId;
        Long adminId;
        if (actorIsWorker) {
            if (!canUseAdminChat(peer.roles())) {
                throw new IllegalArgumentException("chat_not_allowed");
            }
            siteId = sharedSite(actor.siteIds(), peer.siteIds());
            workerId = actor.userId();
            adminId = peer.id();
        } else if (actorIsAdmin) {
            if (!peer.roles().contains(Role.WORKER.name())) {
                throw new IllegalArgumentException("chat_not_allowed");
            }
            siteId = actor.hasAnyGlobalRole() ? firstLong(peer.siteIds()) : sharedSite(actor.siteIds(), peer.siteIds());
            workerId = peer.id();
            adminId = actor.userId();
        } else {
            throw new IllegalArgumentException("chat_not_allowed");
        }

        if (siteId == null) {
            throw new IllegalArgumentException("site_id_required");
        }
        siteGuard.requireSiteAccess(actor, siteId, "chat.thread.resolve", "chat_thread", null);
        var thread = chat.findOpenThread(siteId, workerId, adminId)
            .orElseGet(() -> chat.createThread(siteId, workerId, adminId));
        return new Conversation(thread, workerId, adminId);
    }

    private static void requireConversationAccess(SessionPrincipal actor, ChatRepository.ThreadRow thread, String action) {
        if (actor == null) {
            throw new AccessDeniedException("authentication_required");
        }
        if (actor.hasAnyGlobalRole()) {
            return;
        }
        if (actor.userId().equals(thread.workerId()) || actor.userId().equals(thread.adminUserId())) {
            return;
        }
        throw new AccessDeniedException(action + "_conversation_denied");
    }

    private static Long parsePeerId(String value) {
        try {
            return Long.valueOf(value == null ? "" : value.trim());
        } catch (NumberFormatException e) {
            throw new IllegalArgumentException("invalid_peer_id");
        }
    }

    private static Instant parseBefore(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        try {
            return Instant.parse(value);
        } catch (DateTimeParseException e) {
            throw new IllegalArgumentException("invalid_before");
        }
    }

    private static String cleanLanguage(String value) {
        String language = value == null || value.isBlank() ? "ko" : value.trim().toLowerCase();
        return language.matches("^[a-z]{2,16}$") ? language : "ko";
    }

    private static String cleanClientMessageId(String value) {
        if (value == null || value.isBlank()) return null;
        String cleaned = value.trim();
        if (cleaned.length() > 100 || !cleaned.matches("^[A-Za-z0-9._:-]+$")) {
            throw new IllegalArgumentException("invalid_client_message_id");
        }
        return cleaned;
    }

    private static void requireWorker(SessionPrincipal actor) {
        if (actor == null || !actor.hasRole(Role.WORKER)) {
            throw new IllegalArgumentException("worker_required");
        }
    }

    private static void requireChatAdmin(SessionPrincipal actor) {
        if (actor == null || !canUseAdminChat(actor.roles())) {
            throw new IllegalArgumentException("admin_required");
        }
    }

    private static boolean canUseAdminChat(Set<?> roles) {
        return roles.stream().map(String::valueOf).anyMatch(role ->
            role.equals(Role.ROOT.name())
                || role.equals(Role.HQ_ADMIN.name())
                || role.equals(Role.SITE_ADMIN.name())
                || role.equals(Role.SAFETY_MANAGER.name())
        );
    }

    private static String primaryRole(Set<Role> roles) {
        return List.of(Role.ROOT, Role.HQ_ADMIN, Role.SITE_ADMIN, Role.SAFETY_MANAGER, Role.WORKER, Role.VIEWER).stream()
            .filter(roles::contains)
            .map(Role::name)
            .findFirst()
            .orElse(Role.VIEWER.name());
    }

    private static String firstSiteId(Set<Long> siteIds) {
        Long first = firstLong(siteIds);
        return first == null ? null : String.valueOf(first);
    }

    private static Long firstLong(Set<Long> values) {
        return values == null || values.isEmpty() ? null : values.stream().sorted().findFirst().orElse(null);
    }

    private static Long sharedSite(Set<Long> actorSites, Set<Long> peerSites) {
        if (actorSites == null || peerSites == null) {
            return null;
        }
        return actorSites.stream()
            .filter(peerSites::contains)
            .sorted()
            .findFirst()
            .orElse(null);
    }

    public record SendMessageRequest(
        @NotBlank String sourceLanguage,
        @NotBlank String targetLanguage,
        @NotBlank String sourceText,
        String translatedText,
        String clientMessageId
    ) {}
    public record Conversation(ChatRepository.ThreadRow thread, Long workerId, Long adminId) {}
    public record AdminWorkersResponse(@JsonProperty("site_id") String siteId, String role, List<WorkerPeerResponse> workers) {}
    public record WorkerPeerResponse(String id, @JsonProperty("display_name") String displayName, @JsonProperty("preferred_lang") String preferredLang, String nationality, @JsonProperty("site_id") String siteId) {}
    public record WorkerAdminsResponse(WorkerSelfResponse worker, List<AdminPeerResponse> admins) {}
    public record WorkerSelfResponse(String id, @JsonProperty("preferred_lang") String preferredLang, @JsonProperty("site_id") String siteId) {}
    public record AdminPeerResponse(String id, @JsonProperty("display_name") String displayName, String role, @JsonProperty("site_id") String siteId) {}
    public record ChatMessagesResponse(List<CompatMessageResponse> messages) {}
    public record ChatMessageResponse(CompatMessageResponse message) {}
    public record CompatMessageResponse(
        String id,
        @JsonProperty("from_user") String fromUser,
        @JsonProperty("to_user") String toUser,
        @JsonProperty("source_lang") String sourceLang,
        @JsonProperty("target_lang") String targetLang,
        @JsonProperty("source_text") String sourceText,
        @JsonProperty("translated_text") String translatedText,
        @JsonProperty("created_at") String createdAt,
        @JsonProperty("is_read") boolean read
    ) {}
    public record CompatSendMessageRequest(
        @JsonProperty("to_user") String toUser,
        @JsonProperty("source_lang") String sourceLang,
        @JsonProperty("target_lang") String targetLang,
        @JsonProperty("source_text") String sourceText,
        @JsonProperty("translated_text") String translatedText,
        @JsonProperty("client_message_id") String clientMessageId
    ) {}
    public record CompatReadRequest(@JsonProperty("peer_id") String peerId, List<CompatTranslationUpdate> translations) {}
    public record CompatTranslationUpdate(String id, @JsonProperty("translated_text") String translatedText) {}
}
