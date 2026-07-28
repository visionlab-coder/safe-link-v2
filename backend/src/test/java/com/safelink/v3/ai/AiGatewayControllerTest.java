package com.safelink.v3.ai;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import java.util.Base64;
import org.junit.jupiter.api.Test;

class AiGatewayControllerTest {
    @Test
    void rejectsNonImageMimeTypeBeforeCallingVendor() {
        var error = assertThrows(
            IllegalArgumentException.class,
            () -> AiGatewayController.validateImagePayload(
                Base64.getEncoder().encodeToString("not-an-image".getBytes()),
                "text/plain"
            )
        );

        assertEquals("vision_image_type_not_allowed", error.getMessage());
    }

    @Test
    void rejectsMimeAndFileSignatureMismatch() {
        var error = assertThrows(
            IllegalArgumentException.class,
            () -> AiGatewayController.validateImagePayload(
                Base64.getEncoder().encodeToString("not-a-png".getBytes()),
                "image/png"
            )
        );

        assertEquals("vision_image_signature_mismatch", error.getMessage());
    }

    @Test
    void acceptsValidPngSignature() {
        byte[] png = new byte[] {
            (byte) 0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00
        };

        assertDoesNotThrow(() -> AiGatewayController.validateImagePayload(
            Base64.getEncoder().encodeToString(png),
            "image/png"
        ));
    }
}
