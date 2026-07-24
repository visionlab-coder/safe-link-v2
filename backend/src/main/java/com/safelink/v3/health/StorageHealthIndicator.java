package com.safelink.v3.health;

import com.safelink.v3.storage.ObjectStorageService;
import org.springframework.boot.actuate.health.Health;
import org.springframework.boot.actuate.health.HealthIndicator;
import org.springframework.stereotype.Component;

@Component("objectStorage")
public class StorageHealthIndicator implements HealthIndicator {
    private final ObjectStorageService storage;

    public StorageHealthIndicator(ObjectStorageService storage) {
        this.storage = storage;
    }

    @Override
    public Health health() {
        if (storage.isConfigured()) {
            return Health.up().withDetail("objectStorage", "configured").build();
        }
        return Health.unknown()
            .withDetail("objectStorage", "not_configured")
            .withDetail("mode", "LOCAL_FALLBACK")
            .build();
    }
}
