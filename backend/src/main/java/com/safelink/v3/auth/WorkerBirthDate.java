package com.safelink.v3.auth;

import java.time.LocalDate;
import java.time.DateTimeException;

/** Six-digit login identifier. No century or age is inferred from YYMMDD. */
public final class WorkerBirthDate {
    private WorkerBirthDate() {}
    public static String require(String value) {
        if (value == null || !value.matches("[0-9]{6}")) throw new IllegalArgumentException("birth_date_invalid");
        try {
            // A representative century is used only for calendar validation, never persisted.
            LocalDate.of(2000 + Integer.parseInt(value.substring(0, 2)),
                    Integer.parseInt(value.substring(2, 4)), Integer.parseInt(value.substring(4, 6)));
            return value;
        } catch (DateTimeException ex) { throw new IllegalArgumentException("birth_date_invalid"); }
    }
}
