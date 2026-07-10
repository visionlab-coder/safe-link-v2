package com.safelink.v3.health;

import static org.assertj.core.api.Assertions.assertThat;

import com.safelink.v3.ai.AiProperties;
import org.junit.jupiter.api.Test;
import org.springframework.boot.actuate.health.Status;

class AiGatewayHealthIndicatorTest {
    @Test
    void reportsProviderAvailabilityWithoutExposingKeys() {
        AiProperties properties = new AiProperties();
        properties.setVendorEnabled(true);
        properties.setGoogleCloudApiKey("google-secret");
        properties.setNaverClientId("naver-id");
        properties.setNaverClientSecret("naver-secret");
        properties.setOpenAiApiKey("openai-secret");

        var health = new AiGatewayHealthIndicator(properties).health();

        assertThat(health.getStatus()).isEqualTo(Status.UP);
        assertThat(health.getDetails())
            .containsEntry("mode", "VENDOR_ENABLED")
            .containsEntry("googleTranslate", true)
            .containsEntry("papago", true)
            .containsEntry("openAi", true)
            .doesNotContainValue("google-secret")
            .doesNotContainValue("naver-secret")
            .doesNotContainValue("openai-secret");
    }
}
