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
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

class WorkerTbmBroadcastTest {
    @Test void publishesWithWorkerAsAuthorButCannotCrossSitesOrReadOthersSignatures() {
        var worker=new SessionPrincipal(20L,"worker@example.invalid","WORKER",Set.of(Role.WORKER),Set.of(2L));
        var repo=mock(TbmRepository.class);
        var audit=mock(AuditService.class);
        var controller=new TbmController(repo,mock(FileObjectRepository.class),mock(ObjectStorageService.class),new SiteGuard(audit),audit);
        when(repo.listWorkers(false,Set.of(2L),2L)).thenReturn(List.of(new TbmRepository.WorkerRow(21L,"RECIPIENT","ko",2L)));
        when(repo.createPublished(2L,20L,"TBM","원문","test-worker","요약")).thenReturn(
            new TbmRepository.NoticeRow(7L,2L,"현장",20L,"TBM","원문","원문","PUBLISHED",Instant.now(),Instant.now(),"요약"));
        var result=controller.broadcast(worker,"test-worker",new TbmController.BroadcastRequest("원문","2","TBM","요약"));
        assertThat(result.tbm().createdBy()).isEqualTo("20");
        assertThat(result.tbm().summaryKo()).isEqualTo("요약");
        assertThatThrownBy(()->controller.broadcast(worker,"other",new TbmController.BroadcastRequest("원문","3","TBM"))).hasMessage("cross_site_denied");
        assertThatThrownBy(()->controller.acks(worker,"7")).hasMessage("admin_required");
        assertThatThrownBy(()->NationwideTbmAccess.require(worker)).isInstanceOf(org.springframework.security.access.AccessDeniedException.class);
    }
}
