package com.safelink.v3.health;

import com.safelink.v3.ai.AiProperties;
import org.springframework.boot.actuate.health.Health;
import org.springframework.boot.actuate.health.HealthIndicator;
import org.springframework.stereotype.Component;

@Component("aiGateway")
public class AiGatewayHealthIndicator implements HealthIndicator {
    private final AiProperties properties;

    public AiGatewayHealthIndicator(AiProperties properties) {
        this.properties = properties;
    }

    @Override
    public Health health() {
        Health.Builder builder;
        if (properties.isVendorEnabled()) {
            builder = Health.up().withDetail("vendor", "configured");
        } else {
            builder = Health.unknown().withDetail("vendor", "not_configured");
        }
        return builder
            .withDetail("mode", properties.isVendorEnabled() ? "VENDOR_ENABLED" : "MOCK_OR_FALLBACK")
            .withDetail("googleTranslate", configured(properties.getGoogleCloudApiKey()))
            .withDetail("papago", configured(properties.getNaverClientId()) && configured(properties.getNaverClientSecret()))
            .withDetail("openAi", configured(properties.getOpenAiApiKey()))
            .withDetail("failOpenLocal", properties.isFailOpenLocal())
            .withDetail("defaultWindowSeconds", properties.getDefaultWindowSeconds())
            .withDetail("defaultLimitCount", properties.getDefaultLimitCount())
            .build();
    }

    private static boolean configured(String value) {
        return value != null && !value.trim().isEmpty();
    }
}
