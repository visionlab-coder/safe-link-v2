package com.safelink.v3.auth;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import org.junit.jupiter.api.Test;

class AwsPasswordResetNotifierTest {
    @Test
    void normalizesKoreanMobileNumberToE164() {
        assertThat(AwsPasswordResetNotifier.normalizePhoneNumber("010-1234-5678"))
            .isEqualTo("+821012345678");
    }

    @Test
    void preservesInternationalNumber() {
        assertThat(AwsPasswordResetNotifier.normalizePhoneNumber("+84 912 345 678"))
            .isEqualTo("+84912345678");
    }

    @Test
    void rejectsNumberWithoutCountryOrLocalPrefix() {
        assertThatThrownBy(() -> AwsPasswordResetNotifier.normalizePhoneNumber("12345678"))
            .isInstanceOf(IllegalArgumentException.class)
            .hasMessage("sms_phone_number_invalid");
    }
}
