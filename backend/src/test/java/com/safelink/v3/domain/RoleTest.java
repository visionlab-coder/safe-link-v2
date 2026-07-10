package com.safelink.v3.domain;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

class RoleTest {
    @Test
    void roleContractIsFrozenForV3() {
        assertThat(Role.values())
            .extracting(Enum::name)
            .containsExactly("ROOT", "HQ_ADMIN", "SITE_ADMIN", "SAFETY_MANAGER", "WORKER", "VIEWER");
    }

    @Test
    void onlyRootAndHqAdminHaveGlobalSiteScope() {
        assertThat(Role.ROOT.hasGlobalSiteScope()).isTrue();
        assertThat(Role.HQ_ADMIN.hasGlobalSiteScope()).isTrue();
        assertThat(Role.SITE_ADMIN.hasGlobalSiteScope()).isFalse();
        assertThat(Role.WORKER.hasGlobalSiteScope()).isFalse();
    }
}
