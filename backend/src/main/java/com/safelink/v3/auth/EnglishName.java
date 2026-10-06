package com.safelink.v3.auth;

import java.util.Locale;

/** Display names only. Never use this to rewrite login credentials or existing users. */
public final class EnglishName {
    private EnglishName() {}

    public static String require(String value) {
        if (value == null || value.length() > 80) throw new IllegalArgumentException("english_name_required");
        String name = value.strip().replaceAll(" +", " ");
        if (name.isEmpty() || !name.matches("[A-Za-z][A-Za-z .'-]*") || !name.matches(".*[A-Za-z].*")) {
            throw new IllegalArgumentException("english_name_required");
        }
        return name.toUpperCase(Locale.ROOT);
    }
}
