package com.safelink.v3.auth;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import org.springframework.stereotype.Service;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.sesv2.SesV2Client;
import software.amazon.awssdk.services.sesv2.model.Body;
import software.amazon.awssdk.services.sesv2.model.Content;
import software.amazon.awssdk.services.sesv2.model.Destination;
import software.amazon.awssdk.services.sesv2.model.EmailContent;
import software.amazon.awssdk.services.sesv2.model.Message;
import software.amazon.awssdk.services.sesv2.model.SendEmailRequest;
import software.amazon.awssdk.services.sns.SnsClient;
import software.amazon.awssdk.services.sns.model.PublishRequest;

@Service
public class AwsPasswordResetNotifier implements PasswordResetNotifier {
    private final PasswordResetNotificationProperties properties;

    public AwsPasswordResetNotifier(PasswordResetNotificationProperties properties) {
        this.properties = properties;
    }

    @Override
    public DeliveryResult send(UserAccountRepository.PasswordResetContact contact, String rawToken) {
        boolean emailAttempted = properties.isEmailEnabled() && present(contact.email()) && present(properties.getEmailFrom());
        boolean smsAttempted = properties.isSmsEnabled() && present(contact.phone());
        if (!emailAttempted && !smsAttempted) {
            return DeliveryResult.unavailable();
        }

        String resetUrl = normalizedPublicUrl() + "/auth/reset-password?token="
            + URLEncoder.encode(rawToken, StandardCharsets.UTF_8);
        boolean delivered = false;
        String failureCode = null;

        if (emailAttempted) {
            try {
                sendEmail(contact.email(), resetUrl);
                delivered = true;
            } catch (RuntimeException exception) {
                failureCode = "ses_delivery_failed";
            }
        }
        if (smsAttempted) {
            try {
                sendSms(contact.phone(), resetUrl);
                delivered = true;
            } catch (RuntimeException exception) {
                failureCode = delivered ? null : "sns_delivery_failed";
            }
        }
        return new DeliveryResult(delivered, emailAttempted, smsAttempted, failureCode);
    }

    private void sendEmail(String destination, String resetUrl) {
        var subject = Content.builder().data("[SQ Link] 비밀번호 재설정 안내").charset("UTF-8").build();
        var body = Content.builder()
            .data("아래 링크는 30분 동안 한 번만 사용할 수 있습니다.\n\n" + resetUrl
                + "\n\n본인이 요청하지 않았다면 이 메시지를 무시해 주세요.")
            .charset("UTF-8")
            .build();
        var request = SendEmailRequest.builder()
            .fromEmailAddress(properties.getEmailFrom())
            .destination(Destination.builder().toAddresses(destination).build())
            .content(EmailContent.builder().simple(Message.builder()
                .subject(subject)
                .body(Body.builder().text(body).build())
                .build()).build())
            .build();
        try (var client = SesV2Client.builder().region(Region.of(properties.getAwsRegion())).build()) {
            client.sendEmail(request);
        }
    }

    private void sendSms(String phone, String resetUrl) {
        var request = PublishRequest.builder()
            .phoneNumber(normalizePhoneNumber(phone))
            .message("[SQ Link] 비밀번호 재설정 링크(30분 유효): " + resetUrl)
            .build();
        try (var client = SnsClient.builder().region(Region.of(properties.getAwsRegion())).build()) {
            client.publish(request);
        }
    }

    private String normalizedPublicUrl() {
        String value = properties.getPublicAppUrl() == null ? "" : properties.getPublicAppUrl().trim();
        return value.endsWith("/") ? value.substring(0, value.length() - 1) : value;
    }

    private static boolean present(String value) {
        return value != null && !value.isBlank();
    }

    static String normalizePhoneNumber(String phone) {
        String value = phone == null ? "" : phone.replaceAll("[^0-9+]", "");
        if (value.startsWith("+")) return value;
        if (value.startsWith("00")) return "+" + value.substring(2);
        if (value.startsWith("0")) return "+82" + value.substring(1);
        if (value.startsWith("82")) return "+" + value;
        throw new IllegalArgumentException("sms_phone_number_invalid");
    }
}
