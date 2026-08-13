package com.safelink.v3.admin;

import com.safelink.v3.admin.WorkerNfcService.CreateWorkerRequest;
import com.safelink.v3.admin.WorkerNfcService.DailySafetyLogReportResponse;
import com.safelink.v3.admin.WorkerNfcService.QrTokenResponse;
import com.safelink.v3.admin.WorkerNfcService.SiteChallengeRequest;
import com.safelink.v3.admin.WorkerNfcService.SiteChallengeResponse;
import com.safelink.v3.admin.WorkerNfcService.SiteAccessControlResponse;
import com.safelink.v3.admin.WorkerNfcService.SiteAccessControlUpdate;
import com.safelink.v3.admin.WorkerNfcService.StickerEventRequest;
import com.safelink.v3.admin.WorkerNfcService.StickerIssueRequest;
import com.safelink.v3.admin.WorkerNfcService.StickerIssueResponse;
import com.safelink.v3.admin.WorkerNfcService.TbmNotificationListResponse;
import com.safelink.v3.admin.WorkerNfcService.TbmNotifyResponse;
import com.safelink.v3.admin.WorkerNfcService.TbmSessionActionRequest;
import com.safelink.v3.admin.WorkerNfcService.TbmSessionCreateRequest;
import com.safelink.v3.admin.WorkerNfcService.TbmSessionDetailResponse;
import com.safelink.v3.admin.WorkerNfcService.TbmSessionListResponse;
import com.safelink.v3.admin.WorkerNfcService.TbmSessionPayload;
import com.safelink.v3.admin.WorkerNfcService.TbmTapRequest;
import com.safelink.v3.admin.WorkerNfcService.TbmTapResponse;
import com.safelink.v3.admin.WorkerNfcService.UpdateWorkerRequest;
import com.safelink.v3.admin.WorkerNfcService.WorkerInfoResponse;
import com.safelink.v3.admin.WorkerNfcService.WorkerListResponse;
import com.safelink.v3.admin.WorkerNfcService.WorkerPreferenceRequest;
import com.safelink.v3.admin.WorkerNfcService.WorkerPreferenceResponse;
import com.safelink.v3.admin.WorkerNfcService.WorkerQrResponse;
import com.safelink.v3.admin.WorkerNfcService.WorkerQrVerifyRequest;
import com.safelink.v3.admin.WorkerNfcService.WorkerResponse;
import com.safelink.v3.auth.SessionPrincipal;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpSession;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.context.HttpSessionSecurityContextRepository;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class WorkerNfcController {
    private final WorkerNfcService service;
    private final HttpSessionSecurityContextRepository contextRepository = new HttpSessionSecurityContextRepository();

    public WorkerNfcController(WorkerNfcService service) {
        this.service = service;
    }

    @GetMapping("/api/v1/admin/workers")
    public WorkerListResponse listWorkers(
        @AuthenticationPrincipal SessionPrincipal actor,
        @RequestParam(name = "site_id", required = false) String siteId,
        @RequestParam(name = "q", required = false) String q,
        @RequestParam(name = "active", required = false, defaultValue = "1") String active,
        @RequestParam(name = "limit", required = false, defaultValue = "50") int limit
    ) {
        return service.list(actor, siteId, q, !"0".equals(active), limit);
    }

    @GetMapping("/api/v1/admin/workers/page")
    public WorkerNfcService.WorkerPageResponse listWorkerPage(
        @AuthenticationPrincipal SessionPrincipal actor,
        @RequestParam(name = "site_id", required = false) String siteId,
        @RequestParam(name = "q", required = false) String q,
        @RequestParam(name = "active", required = false, defaultValue = "1") String active,
        @RequestParam(name = "cursor", required = false) Long cursor,
        @RequestParam(name = "limit", required = false, defaultValue = "100") int limit
    ) {
        return service.listPage(actor, siteId, q, !"0".equals(active), cursor, limit);
    }

    @PostMapping("/api/v1/admin/workers")
    public WorkerResponse createWorker(@AuthenticationPrincipal SessionPrincipal actor, @RequestBody CreateWorkerRequest request) {
        return service.create(actor, request);
    }

    @GetMapping("/api/v1/admin/workers/{workerId}")
    public WorkerResponse readWorker(@AuthenticationPrincipal SessionPrincipal actor, @PathVariable String workerId) {
        return service.read(actor, workerId);
    }

    @PatchMapping("/api/v1/admin/workers/{workerId}")
    public WorkerResponse updateWorker(
        @AuthenticationPrincipal SessionPrincipal actor,
        @PathVariable String workerId,
        @RequestBody UpdateWorkerRequest request
    ) {
        return service.update(actor, workerId, request);
    }

    @DeleteMapping("/api/v1/admin/workers/{workerId}")
    public java.util.Map<String, Boolean> deactivateWorker(
        @AuthenticationPrincipal SessionPrincipal actor,
        @PathVariable String workerId
    ) {
        service.deactivate(actor, workerId);
        return java.util.Map.of("ok", true);
    }

    @GetMapping("/api/v1/admin/workers/{workerId}/qr-token")
    public QrTokenResponse issueQrToken(
        @AuthenticationPrincipal SessionPrincipal actor,
        @PathVariable String workerId,
        @RequestParam(name = "siteId", required = false) String siteId,
        @RequestParam(name = "ttlMinutes", required = false) Integer ttlMinutes,
        HttpServletRequest request
    ) {
        return service.issueQrToken(actor, workerId, siteId, ttlMinutes, requestOrigin(request));
    }

    @PostMapping("/api/v1/admin/nfc/stickers/issue")
    public StickerIssueResponse issueSticker(
        @AuthenticationPrincipal SessionPrincipal actor,
        @RequestBody StickerIssueRequest requestBody,
        HttpServletRequest request
    ) {
        return service.issueSticker(actor, requestBody, requestOrigin(request));
    }

    @PostMapping("/api/v1/admin/nfc/stickers/event")
    public java.util.Map<String, Boolean> recordStickerEvent(
        @AuthenticationPrincipal SessionPrincipal actor,
        @RequestBody StickerEventRequest requestBody
    ) {
        service.recordStickerEvent(actor, requestBody);
        return java.util.Map.of("ok", true);
    }

    @GetMapping("/api/v1/admin/nfc/site-access-control")
    public SiteAccessControlResponse getSiteAccess(
        @AuthenticationPrincipal SessionPrincipal actor,
        @RequestParam(name = "site_id", required = false) String siteId
    ) {
        return service.getSiteAccess(actor, siteId);
    }

    @PostMapping("/api/v1/admin/nfc/site-access-control")
    public SiteAccessControlResponse updateSiteAccess(
        @AuthenticationPrincipal SessionPrincipal actor,
        @RequestBody SiteAccessControlUpdate request
    ) {
        return service.updateSiteAccess(actor, request);
    }

    @GetMapping("/api/v1/admin/nfc/site-challenge")
    public SiteChallengeResponse getSiteChallenge(
        @AuthenticationPrincipal SessionPrincipal actor,
        @RequestParam(name = "site_id", required = false) String siteId
    ) {
        return service.getSiteChallenge(actor, siteId);
    }

    @PostMapping("/api/v1/admin/nfc/site-challenge")
    public SiteChallengeResponse updateSiteChallenge(
        @AuthenticationPrincipal SessionPrincipal actor,
        @RequestBody SiteChallengeRequest request
    ) {
        return service.updateSiteChallenge(actor, request);
    }

    @GetMapping("/api/v1/admin/nfc/tbm-session")
    public TbmSessionListResponse listTbmSessions(
        @AuthenticationPrincipal SessionPrincipal actor,
        @RequestParam(name = "site_id", required = false) String siteId,
        @RequestParam(name = "status", required = false) String status
    ) {
        return service.listTbmSessions(actor, siteId, status);
    }

    @PostMapping("/api/v1/admin/nfc/tbm-session")
    public java.util.Map<String, TbmSessionPayload> createTbmSession(
        @AuthenticationPrincipal SessionPrincipal actor,
        @RequestBody TbmSessionCreateRequest request
    ) {
        return java.util.Map.of("session", service.createTbmSession(actor, request));
    }

    @GetMapping("/api/v1/admin/nfc/tbm-session/{sessionId}")
    public TbmSessionDetailResponse readTbmSession(
        @AuthenticationPrincipal SessionPrincipal actor,
        @PathVariable String sessionId
    ) {
        return service.readTbmSession(actor, sessionId);
    }

    @PatchMapping("/api/v1/admin/nfc/tbm-session/{sessionId}")
    public java.util.Map<String, TbmSessionPayload> updateTbmSession(
        @AuthenticationPrincipal SessionPrincipal actor,
        @PathVariable String sessionId,
        @RequestBody TbmSessionActionRequest request
    ) {
        return java.util.Map.of("session", service.updateTbmSession(actor, sessionId, request));
    }

    @PostMapping("/api/v1/admin/nfc/tbm-session/{sessionId}/tap")
    public TbmTapResponse tapTbmSession(
        @AuthenticationPrincipal SessionPrincipal actor,
        @PathVariable String sessionId,
        @RequestBody TbmTapRequest requestBody,
        HttpServletRequest request
    ) {
        return service.tapTbmSession(actor, sessionId, requestBody, requestOrigin(request));
    }

    @PostMapping("/api/v1/admin/nfc/tbm-session/{sessionId}/notify")
    public TbmNotifyResponse notifyTbmSession(
        @AuthenticationPrincipal SessionPrincipal actor,
        @PathVariable String sessionId
    ) {
        return service.notifyTbmSession(actor, sessionId);
    }

    @GetMapping("/api/v1/admin/nfc/tbm-session/{sessionId}/notify")
    public TbmNotificationListResponse listTbmNotifications(
        @AuthenticationPrincipal SessionPrincipal actor,
        @PathVariable String sessionId
    ) {
        return service.listTbmNotifications(actor, sessionId);
    }

    @GetMapping("/api/v1/admin/nfc/daily-safety-logs")
    public DailySafetyLogReportResponse dailySafetyLogs(
        @AuthenticationPrincipal SessionPrincipal actor,
        @RequestParam(name = "site_id", required = false) String siteId,
        @RequestParam(name = "work_date", required = false) String workDate,
        @RequestParam(name = "limit", required = false, defaultValue = "100") int limit
    ) {
        return service.dailySafetyLogs(actor, siteId, workDate, limit);
    }

    @PostMapping("/api/v1/qr/worker-token")
    public WorkerQrResponse verifyWorkerQr(
        @RequestBody WorkerQrVerifyRequest requestBody,
        HttpServletRequest request,
        HttpServletResponse response
    ) {
        var outcome = service.verifyWorkerQr(requestBody, clientIp(request));
        if (outcome.principal() == null) {
            invalidateSession(request);
            return outcome.response();
        }
        establishSession(outcome.principal(), request, response);
        return outcome.response();
    }

    @GetMapping("/api/v1/nfc/worker-info")
    public WorkerInfoResponse workerInfo(
        @RequestParam(name = "url") String url,
        HttpServletRequest request
    ) {
        return service.workerInfo(url, requestOrigin(request));
    }

    @PostMapping("/api/v1/nfc/worker-preference")
    public WorkerPreferenceResponse workerPreference(
        @RequestBody WorkerPreferenceRequest requestBody,
        HttpServletRequest request,
        HttpServletResponse response
    ) {
        var outcome = service.workerPreference(requestBody, requestOrigin(request), clientIp(request));
        if (outcome.principal() == null) {
            invalidateSession(request);
            return outcome.response();
        }
        establishSession(outcome.principal(), request, response);
        return outcome.response();
    }

    private void establishSession(
        SessionPrincipal principal,
        HttpServletRequest servletRequest,
        HttpServletResponse servletResponse
    ) {
        var authentication = UsernamePasswordAuthenticationToken.authenticated(
            principal,
            null,
            principal.getAuthorities()
        );
        var context = SecurityContextHolder.createEmptyContext();
        context.setAuthentication(authentication);
        SecurityContextHolder.setContext(context);
        servletRequest.getSession(true);
        servletRequest.changeSessionId();
        contextRepository.saveContext(context, servletRequest, servletResponse);
    }

    private static void invalidateSession(HttpServletRequest request) {
        HttpSession session = request.getSession(false);
        if (session != null) {
            session.invalidate();
        }
        SecurityContextHolder.clearContext();
    }

    private static String requestOrigin(HttpServletRequest request) {
        String forwarded = request.getHeader("X-Safe-Link-Origin");
        if (forwarded != null && !forwarded.isBlank()) {
            return forwarded;
        }
        String origin = request.getHeader("Origin");
        if (origin != null && !origin.isBlank()) {
            return origin;
        }
        return null;
    }

    private static String clientIp(HttpServletRequest request) {
        String forwarded = request.getHeader("X-Forwarded-For");
        if (forwarded != null && !forwarded.isBlank()) {
            return forwarded.split(",")[0].trim();
        }
        return request.getRemoteAddr();
    }
}
