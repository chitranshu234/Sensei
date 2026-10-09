package com.codeintel.dto;

/**
 * Successful authentication payload.
 *
 * <p>{@code expiresInSeconds} is returned so the client can proactively refresh or sign the user
 * out at the right moment instead of discovering expiry from a surprise 401 mid-session.
 */
public class AuthResponse {

    private String token;
    private String tokenType = "Bearer";
    private long expiresInSeconds;
    private Long userId;
    private String username;
    private String displayName;
    private String role;

    public AuthResponse() {}

    public AuthResponse(String token, long expiresInSeconds, Long userId,
                        String username, String displayName, String role) {
        this.token = token;
        this.expiresInSeconds = expiresInSeconds;
        this.userId = userId;
        this.username = username;
        this.displayName = displayName;
        this.role = role;
    }

    public String getToken() { return token; }
    public void setToken(String token) { this.token = token; }

    public String getTokenType() { return tokenType; }
    public void setTokenType(String tokenType) { this.tokenType = tokenType; }

    public long getExpiresInSeconds() { return expiresInSeconds; }
    public void setExpiresInSeconds(long expiresInSeconds) { this.expiresInSeconds = expiresInSeconds; }

    public Long getUserId() { return userId; }
    public void setUserId(Long userId) { this.userId = userId; }

    public String getUsername() { return username; }
    public void setUsername(String username) { this.username = username; }

    public String getDisplayName() { return displayName; }
    public void setDisplayName(String displayName) { this.displayName = displayName; }

    public String getRole() { return role; }
    public void setRole(String role) { this.role = role; }
}
