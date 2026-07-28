package com.safelink.v3.storage;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "safe-link.storage")
public class StorageProperties {
    private boolean enabled;
    private String bucket = "safe-link-local";
    private String region = "ap-northeast-2";
    private String endpoint;
    private String accessKey;
    private String secretKey;
    private boolean pathStyleAccess = true;
    private long uploadUrlTtlSeconds = 600;
    private long downloadUrlTtlSeconds = 300;
    private long maxUploadBytes = 10 * 1024 * 1024;
    private String publicApiBaseUrl = "https://api.safe-link.co.kr";
    private String localRoot = System.getProperty("java.io.tmpdir") + "/safe-link-v3-object-storage";

    public boolean isEnabled() { return enabled; }
    public void setEnabled(boolean enabled) { this.enabled = enabled; }
    public String getBucket() { return bucket; }
    public void setBucket(String bucket) { this.bucket = bucket; }
    public String getRegion() { return region; }
    public void setRegion(String region) { this.region = region; }
    public String getEndpoint() { return endpoint; }
    public void setEndpoint(String endpoint) { this.endpoint = endpoint; }
    public String getAccessKey() { return accessKey; }
    public void setAccessKey(String accessKey) { this.accessKey = accessKey; }
    public String getSecretKey() { return secretKey; }
    public void setSecretKey(String secretKey) { this.secretKey = secretKey; }
    public boolean isPathStyleAccess() { return pathStyleAccess; }
    public void setPathStyleAccess(boolean pathStyleAccess) { this.pathStyleAccess = pathStyleAccess; }
    public long getUploadUrlTtlSeconds() { return uploadUrlTtlSeconds; }
    public void setUploadUrlTtlSeconds(long uploadUrlTtlSeconds) { this.uploadUrlTtlSeconds = uploadUrlTtlSeconds; }
    public long getDownloadUrlTtlSeconds() { return downloadUrlTtlSeconds; }
    public void setDownloadUrlTtlSeconds(long downloadUrlTtlSeconds) { this.downloadUrlTtlSeconds = downloadUrlTtlSeconds; }
    public long getMaxUploadBytes() { return maxUploadBytes; }
    public void setMaxUploadBytes(long maxUploadBytes) { this.maxUploadBytes = maxUploadBytes; }
    public String getPublicApiBaseUrl() { return publicApiBaseUrl; }
    public void setPublicApiBaseUrl(String publicApiBaseUrl) { this.publicApiBaseUrl = publicApiBaseUrl; }
    public String getLocalRoot() { return localRoot; }
    public void setLocalRoot(String localRoot) { this.localRoot = localRoot; }
}
