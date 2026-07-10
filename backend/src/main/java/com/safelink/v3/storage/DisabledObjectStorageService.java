package com.safelink.v3.storage;

import com.safelink.v3.support.ServiceUnavailableException;
import java.io.IOException;
import java.net.URI;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;
import java.util.Objects;

public class DisabledObjectStorageService implements ObjectStorageService {
    private final Path localRoot;

    public DisabledObjectStorageService(Path localRoot) {
        this.localRoot = Objects.requireNonNull(localRoot);
    }

    @Override
    public URI createUploadUrl(String objectKey, String contentType, Duration ttl) {
        throw new ServiceUnavailableException("object_storage_not_configured");
    }

    @Override
    public URI createDownloadUrl(String objectKey, Duration ttl) {
        throw new ServiceUnavailableException("object_storage_not_configured");
    }

    @Override
    public void putObject(String objectKey, String contentType, byte[] bytes) {
        Path target = resolveObjectPath(objectKey);
        try {
            Files.createDirectories(target.getParent());
            Files.write(target, bytes);
            Files.writeString(contentTypePath(target), contentType == null ? "application/octet-stream" : contentType);
        } catch (IOException e) {
            throw new ServiceUnavailableException("local_object_storage_write_failed");
        }
    }

    @Override
    public StoredObject getObject(String objectKey) {
        Path target = resolveObjectPath(objectKey);
        try {
            if (!Files.exists(target)) {
                throw new ServiceUnavailableException("local_object_not_found");
            }
            String contentType = Files.exists(contentTypePath(target))
                ? Files.readString(contentTypePath(target)).trim()
                : "application/octet-stream";
            return new StoredObject(contentType, Files.readAllBytes(target));
        } catch (IOException e) {
            throw new ServiceUnavailableException("local_object_storage_read_failed");
        }
    }

    @Override
    public boolean isConfigured() {
        return false;
    }

    private Path resolveObjectPath(String objectKey) {
        String normalized = objectKey == null ? "" : objectKey.replace("\\", "/");
        if (normalized.isBlank() || normalized.startsWith("/") || normalized.contains("..")) {
            throw new IllegalArgumentException("invalid_object_key");
        }
        return localRoot.resolve(normalized).normalize();
    }

    private static Path contentTypePath(Path target) {
        return target.resolveSibling(target.getFileName() + ".content-type");
    }
}
