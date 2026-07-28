package com.safelink.v3.storage;

import java.net.URI;
import java.time.Duration;

public interface ObjectStorageService {
    URI createUploadUrl(String objectKey, String contentType, Duration ttl);
    URI createDownloadUrl(String objectKey, Duration ttl);
    void putObject(String objectKey, String contentType, byte[] bytes);
    StoredObject getObject(String objectKey);
    boolean isConfigured();
    default void verifyAvailable() {}

    record StoredObject(String contentType, byte[] bytes) {}
}
