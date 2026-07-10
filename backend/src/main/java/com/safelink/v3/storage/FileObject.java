package com.safelink.v3.storage;

public record FileObject(
    Long id,
    Long siteId,
    Long ownerUserId,
    String objectKey,
    String sha256,
    String mimeType,
    Long byteSize,
    String purpose,
    String status
) {}
