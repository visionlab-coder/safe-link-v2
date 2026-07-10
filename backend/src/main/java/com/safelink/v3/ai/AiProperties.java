package com.safelink.v3.ai;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "safe-link.ai")
public class AiProperties {
    private long defaultWindowSeconds = 60;
    private long defaultLimitCount = 60;
    private boolean failOpenLocal;
    private boolean vendorEnabled;
    private String googleCloudApiKey = "";
    private String naverClientId = "";
    private String naverClientSecret = "";
    private String openAiApiKey = "";
    private String openAiTextModel = "gpt-4o-mini";
    private String openAiVisionModel = "gpt-4o-mini";
    private String internalGatewaySecret = "";
    private long papagoTimeoutMs = 3000;
    private long googleTimeoutMs = 4000;
    private long openAiTimeoutMs = 15000;
    private long speechTimeoutMs = 8000;
    private long ttsTimeoutMs = 10000;

    public long getDefaultWindowSeconds() { return defaultWindowSeconds; }
    public void setDefaultWindowSeconds(long defaultWindowSeconds) { this.defaultWindowSeconds = defaultWindowSeconds; }
    public long getDefaultLimitCount() { return defaultLimitCount; }
    public void setDefaultLimitCount(long defaultLimitCount) { this.defaultLimitCount = defaultLimitCount; }
    public boolean isFailOpenLocal() { return failOpenLocal; }
    public void setFailOpenLocal(boolean failOpenLocal) { this.failOpenLocal = failOpenLocal; }
    public boolean isVendorEnabled() { return vendorEnabled; }
    public void setVendorEnabled(boolean vendorEnabled) { this.vendorEnabled = vendorEnabled; }
    public String getGoogleCloudApiKey() { return googleCloudApiKey; }
    public void setGoogleCloudApiKey(String googleCloudApiKey) { this.googleCloudApiKey = googleCloudApiKey; }
    public String getNaverClientId() { return naverClientId; }
    public void setNaverClientId(String naverClientId) { this.naverClientId = naverClientId; }
    public String getNaverClientSecret() { return naverClientSecret; }
    public void setNaverClientSecret(String naverClientSecret) { this.naverClientSecret = naverClientSecret; }
    public String getOpenAiApiKey() { return openAiApiKey; }
    public void setOpenAiApiKey(String openAiApiKey) { this.openAiApiKey = openAiApiKey; }
    public String getOpenAiTextModel() { return openAiTextModel; }
    public void setOpenAiTextModel(String openAiTextModel) { this.openAiTextModel = openAiTextModel; }
    public String getOpenAiVisionModel() { return openAiVisionModel; }
    public void setOpenAiVisionModel(String openAiVisionModel) { this.openAiVisionModel = openAiVisionModel; }
    public String getInternalGatewaySecret() { return internalGatewaySecret; }
    public void setInternalGatewaySecret(String internalGatewaySecret) { this.internalGatewaySecret = internalGatewaySecret; }
    public long getPapagoTimeoutMs() { return papagoTimeoutMs; }
    public void setPapagoTimeoutMs(long papagoTimeoutMs) { this.papagoTimeoutMs = papagoTimeoutMs; }
    public long getGoogleTimeoutMs() { return googleTimeoutMs; }
    public void setGoogleTimeoutMs(long googleTimeoutMs) { this.googleTimeoutMs = googleTimeoutMs; }
    public long getOpenAiTimeoutMs() { return openAiTimeoutMs; }
    public void setOpenAiTimeoutMs(long openAiTimeoutMs) { this.openAiTimeoutMs = openAiTimeoutMs; }
    public long getSpeechTimeoutMs() { return speechTimeoutMs; }
    public void setSpeechTimeoutMs(long speechTimeoutMs) { this.speechTimeoutMs = speechTimeoutMs; }
    public long getTtsTimeoutMs() { return ttsTimeoutMs; }
    public void setTtsTimeoutMs(long ttsTimeoutMs) { this.ttsTimeoutMs = ttsTimeoutMs; }
}
