package com.safelink.v3.tbm;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.safelink.v3.auth.SessionPrincipal;
import com.safelink.v3.domain.Role;
import java.util.Set;
import org.junit.jupiter.api.Test;
import org.springframework.security.access.AccessDeniedException;
import static org.assertj.core.api.Assertions.*;

class TbmLibraryControllerTest {
    private final ObjectMapper mapper = new ObjectMapper();
    private final TbmLibraryController controller = new TbmLibraryController(mapper);
    TbmLibraryControllerTest() throws Exception {}
    private SessionPrincipal actor(Role role) { return new SessionPrincipal(1L,"test@example.invalid","TEST",Set.of(role),Set.of(2L)); }

    @Test void loadsAllSourceRowsAndPreservesScoresAndCriticalMarks() {
        var response = controller.list(actor(Role.SITE_ADMIN));
        var items = response.getBody().data();
        assertThat(items).hasSize(456);
        var imported = items.stream().filter(i -> i.sourceId().equals("seowon-initial-20261006")).toList();
        assertThat(imported).hasSize(451);
        assertThat(imported.stream().map(TbmLibraryController.LibraryItem::id).distinct().count()).isEqualTo(451);
        assertThat(imported.stream().map(TbmLibraryController.LibraryItem::category).distinct().count()).isEqualTo(9);
        assertThat(imported.stream().filter(TbmLibraryController.LibraryItem::isCritical).count()).isEqualTo(142);
        assertThat(imported.getFirst().sourceRow()).isEqualTo(11);
        assertThat(imported.getLast().sourceRow()).isEqualTo(461);
        assertThat(imported.getFirst().preventiveMeasure()).isEqualTo("지게차 운전원의 자격여부를 사전에 확인하고 작업 실시");
        assertThat(imported.stream().filter(i -> i.sourceRow() == 369).findFirst().orElseThrow().isCritical()).isFalse();
        var json = mapper.valueToTree(response.getBody());
        assertThat(json.at("/data/2/is_critical").asBoolean()).isTrue();
        assertThat(json.at("/data/0/hazard_description").asText()).contains("지게차");
        assertThat(response.getHeaders().getCacheControl()).isEqualTo("no-store");
    }
    @Test void allowsOnlyTbmAdministrators() {
        for (Role role : new Role[]{Role.ROOT,Role.HQ_ADMIN,Role.SITE_ADMIN,Role.SAFETY_MANAGER}) assertThat(controller.list(actor(role)).getStatusCode().value()).isEqualTo(200);
        for (Role role : new Role[]{Role.WORKER,Role.TEMP_WORKER,Role.VIEWER}) assertThatThrownBy(()->controller.list(actor(role))).isInstanceOf(AccessDeniedException.class);
        assertThatThrownBy(()->controller.list(null)).isInstanceOf(AccessDeniedException.class);
    }
}
