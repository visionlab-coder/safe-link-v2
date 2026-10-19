package com.safelink.v3.tbm;

import com.safelink.v3.audit.AuditService;
import com.safelink.v3.auth.SessionPrincipal;
import com.safelink.v3.domain.Role;
import com.safelink.v3.security.SiteGuard;
import com.safelink.v3.storage.FileObjectRepository;
import com.safelink.v3.storage.ObjectStorageService;
import java.time.Instant;
import java.util.List;
import java.util.Set;
import org.junit.jupiter.api.Test;
import org.springframework.security.access.AccessDeniedException;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

class TbmRecentHistoryTest {
    private final TbmRepository repository = mock(TbmRepository.class);
    private final AuditService audit = mock(AuditService.class);
    private final TbmController controller = new TbmController(repository,
        mock(FileObjectRepository.class), mock(ObjectStorageService.class), new SiteGuard(audit), audit);
    private final SessionPrincipal admin = actor(Role.SITE_ADMIN, Set.of(2L));

    private static SessionPrincipal actor(Role role, Set<Long> sites) {
        return new SessionPrincipal(10L, null, "TEST", Set.of(role), sites);
    }

    @Test void omittedOrBlankDateReturnsOlderNoticesToo() {
        var old = Instant.parse("2020-01-01T00:00:00Z");
        var notice = new TbmRepository.NoticeRow(1L, 2L, "TEST", 10L, "TBM", "TEXT", "TEXT", "PUBLISHED", old, old);
        when(repository.listRecent(false, Set.of(2L), 2L, 10)).thenReturn(List.of(notice));
        for (String date : new String[] { null, "", "  " }) {
            assertThat(controller.notices(admin, "2", date, 10).tbms()).hasSize(1);
        }
        verify(repository, times(3)).listRecent(false, Set.of(2L), 2L, 10);
        verifyNoMoreInteractions(repository);
    }

    @Test void explicitDateKeepsKoreanMidnightBoundaries() {
        controller.notices(admin, "2", "2026-10-15", 10);
        verify(repository).listForDate(false, Set.of(2L), 2L,
            Instant.parse("2026-10-14T15:00:00Z"), Instant.parse("2026-10-15T15:00:00Z"), 10);
        verifyNoMoreInteractions(repository);
    }

    @Test void globalAndSiteScopesAndLimitsRemainBounded() {
        controller.notices(admin, null, null, 0);
        verify(repository).listRecent(false, Set.of(2L), null, 1);
        var hq = actor(Role.HQ_ADMIN, Set.of());
        controller.notices(hq, null, null, 1000);
        verify(repository).listRecent(true, Set.of(), null, 100);
        controller.notices(hq, "3", null, 10);
        verify(repository).listRecent(true, Set.of(), 3L, 10);
    }

    @Test void crossSiteAndMissingSiteRemainDenied() {
        assertThatThrownBy(() -> controller.notices(admin, "3", null, 10)).isInstanceOf(AccessDeniedException.class);
        assertThatThrownBy(() -> controller.notices(actor(Role.SITE_ADMIN, Set.of()), null, null, 10))
            .isInstanceOf(IllegalArgumentException.class).hasMessage("site_id_required");
        verifyNoInteractions(repository);
    }

    @Test void unauthorizedRolesAndAnonymousCannotUseAdminHistory() {
        for (Role role : List.of(Role.WORKER, Role.TEMP_WORKER)) {
            assertThatThrownBy(() -> controller.notices(actor(role, Set.of(2L)), "2", null, 10))
                .isInstanceOf(AccessDeniedException.class);
        }
        assertThatThrownBy(() -> controller.notices(null, null, null, 10)).isInstanceOf(AccessDeniedException.class);
        verifyNoInteractions(repository);
    }

    @Test void invalidDateDoesNotSilentlyExpandToAllDates() {
        assertThatThrownBy(() -> controller.notices(admin, "2", "invalid", 10))
            .isInstanceOf(java.time.format.DateTimeParseException.class);
        verifyNoInteractions(repository);
    }
}
