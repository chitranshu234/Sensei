package com.codeintel.model;

/**
 * Application roles.
 *
 * <p>Spring Security expects authority strings prefixed with {@code ROLE_}; {@link #authority()}
 * is the single place that convention is applied, so no caller has to remember it.
 */
public enum Role {
    USER,
    ADMIN;

    public String authority() {
        return "ROLE_" + name();
    }
}
