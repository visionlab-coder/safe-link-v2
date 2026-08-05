package com.safelink.v3.tbm;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;
import static org.mockito.Mockito.doThrow;

import com.safelink.v3.audit.AuditService;
import com.safelink.v3.auth.SessionPrincipal;
import com.safelink.v3.domain.Role;
import com.safelink.v3.security.SiteGuard;
import com.safelink.v3.storage.FileObjectRepository;
import com.safelink.v3.storage.ObjectStorageService;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class TbmControllerTest {
    private TbmRepository tbm;
    private AuditService audit;
    private FileObjectRepository files;
    private ObjectStorageService storage;
    private SiteGuard siteGuard;
    private TbmController controller;

    @BeforeEach
    void setUp() {
        tbm = mock(TbmRepository.class);
        audit = mock(AuditService.class);
        files = mock(FileObjectRepository.class);
        storage = mock(ObjectStorageService.class);
        siteGuard = mock(SiteGuard.class);
        controller = new TbmController(
            tbm,
            files,
            storage,
            siteGuard,
            audit
        );
    }

    @Test
    void rejectsBroadcastWhenSiteHasNoActiveWorkers() {
        var actor = new SessionPrincipal(
            10L,
            "admin@example.com",
            "현장 관리자",
            Set.of(Role.SITE_ADMIN),
            Set.of(2L)
        );
        when(tbm.listWorkers(false, Set.of(2L), 2L)).thenReturn(java.util.List.of());

        assertThatThrownBy(() -> controller.broadcast(
            actor,
            "qa-broadcast-1",
            new TbmController.BroadcastRequest("안전모를 착용하세요", "2", "오늘의 TBM")
        ))
            .isInstanceOf(IllegalArgumentException.class)
            .hasMessage("tbm_no_target_workers");

        verify(tbm, never()).createPublished(any(), any(), any(), any(), any());
        verify(audit).record(
            eq(10L),
            eq(2L),
            eq("tbm.notice.create"),
            eq("tbm_notice"),
            eq(null),
            eq("DENIED"),
            eq("tbm_no_target_workers"),
            eq(Map.of())
        );
    }

    @Test
    void storageFailureDoesNotCreateSignatureMetadataOrAcknowledgement() {
        var actor = new SessionPrincipal(
            20L,
            "worker@example.com",
            "근로자",
            Set.of(Role.WORKER),
            Set.of(2L)
        );
        var notice = new TbmRepository.NoticeRow(
            7L, 2L, "QA 현장", 10L, "TBM", "내용", "내용", "PUBLISHED",
            java.time.Instant.now(), java.time.Instant.now()
        );
        when(tbm.getNotice(7L)).thenReturn(notice);
        when(tbm.findAck(7L, 20L)).thenReturn(Optional.empty());
        doThrow(new com.safelink.v3.support.ServiceUnavailableException("object_storage_unavailable"))
            .when(storage).putObject(any(), any(), any());

        assertThatThrownBy(() -> controller.sign(
            actor,
            new TbmController.SignRequest("7", "data:image/png;base64,iVBORw0KGgo=")
        ))
            .isInstanceOf(com.safelink.v3.support.ServiceUnavailableException.class)
            .hasMessage("object_storage_unavailable");

        verify(siteGuard).requireSiteAccess(actor, 2L, "tbm.ack.create", "tbm_notice", "7");
        verifyNoInteractions(files);
        verify(tbm, never()).acknowledge(any(), any(), any(), any());
    }
}
