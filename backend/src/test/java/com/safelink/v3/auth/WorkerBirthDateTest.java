package com.safelink.v3.auth;

import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;

class WorkerBirthDateTest {
    @Test void preservesSixDigitsIncludingLeadingZeroes() {
        for (String value : new String[]{"900521", "010203", "000229", "040229", "991231"})
            assertEquals(value, WorkerBirthDate.require(value));
    }

    @Test void rejectsInvalidDatesAndOtherFormats() {
        for (String value : new String[]{"", "19900521", "90052", "9005210", "90-05-21",
                "900230", "010229", "001301", "000000", "900500", "900431", "９００５２１", " 900521"})
            assertThrows(IllegalArgumentException.class, () -> WorkerBirthDate.require(value), value);
        assertThrows(IllegalArgumentException.class, () -> WorkerBirthDate.require(null));
    }
}
