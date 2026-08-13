package com.safelink.v3.auth;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

@Component
@ConfigurationProperties(prefix = "safe-link.password-reset.delivery")
public class PasswordResetNotificationProperties {
    private boolean emailEnabled;
    private boolean smsEnabled;
    private String awsRegion = "ap-northeast-2";
    private String emailFrom = "";
    private String publicAppUrl = "https://app.safe-link.co.kr";

    public boolean isEmailEnabled() { return emailEnabled; }
    public void setEmailEnabled(boolean emailEnabled) { this.emailEnabled = emailEnabled; }
    public boolean isSmsEnabled() { return smsEnabled; }
    public void setSmsEnabled(boolean smsEnabled) { this.smsEnabled = smsEnabled; }
    public String getAwsRegion() { return awsRegion; }
    public void setAwsRegion(String awsRegion) { this.awsRegion = awsRegion; }
    public String getEmailFrom() { return emailFrom; }
    public void setEmailFrom(String emailFrom) { this.emailFrom = emailFrom; }
    public String getPublicAppUrl() { return publicAppUrl; }
    public void setPublicAppUrl(String publicAppUrl) { this.publicAppUrl = publicAppUrl; }
}
