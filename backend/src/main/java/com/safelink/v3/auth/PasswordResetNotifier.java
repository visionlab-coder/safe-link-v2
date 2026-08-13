package com.safelink.v3.auth;

public interface PasswordResetNotifier {
    DeliveryResult send(UserAccountRepository.PasswordResetContact contact, String rawToken);

    record DeliveryResult(boolean delivered, boolean emailAttempted, boolean smsAttempted, String failureCode) {
        static DeliveryResult unavailable() {
            return new DeliveryResult(false, false, false, "delivery_not_configured");
        }
    }
}
