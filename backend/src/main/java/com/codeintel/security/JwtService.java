package com.codeintel.security;

import com.codeintel.entity.UserEntity;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.util.Date;

/**
 * Issues and validates JSON Web Tokens.
 *
 * <p>A JWT is a signed — not encrypted — statement of identity. Anyone can read the payload, so
 * nothing sensitive goes in it; the signature is what makes it unforgeable. That property is what
 * lets the API stay stateless: the server holds no session table, it just re-verifies the
 * signature on each request.
 *
 * <p>The signing key must be at least 256 bits for HS256. A short key is rejected at startup by
 * {@link Keys#hmacShaKeyFor} rather than silently producing weak tokens.
 */
@Service
public class JwtService {

    private static final Logger log = LoggerFactory.getLogger(JwtService.class);

    private final SecretKey signingKey;
    private final long expirationMillis;
    private final String issuer;

    public JwtService(@Value("${app.security.jwt.secret}") String secret,
                      @Value("${app.security.jwt.expiration-minutes:120}") long expirationMinutes,
                      @Value("${app.security.jwt.issuer:codeintel}") String issuer) {
        if (secret == null || secret.getBytes(StandardCharsets.UTF_8).length < 32) {
            throw new IllegalStateException(
                    "app.security.jwt.secret must be at least 32 bytes (256 bits) for HS256.");
        }
        this.signingKey = Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8));
        this.expirationMillis = expirationMinutes * 60_000L;
        this.issuer = issuer;
    }

    /** Mint a token for an authenticated user. */
    public String generateToken(UserEntity user) {
        Date now = new Date();
        Date expiry = new Date(now.getTime() + expirationMillis);

        return Jwts.builder()
                .subject(user.getUsername())
                .issuer(issuer)
                .claim("uid", user.getId())
                .claim("role", user.getRole().name())
                .claim("name", user.getDisplayName() == null ? user.getUsername() : user.getDisplayName())
                .issuedAt(now)
                .expiration(expiry)
                .signWith(signingKey)
                .compact();
    }

    /** Seconds until expiry — handed to the client so it can refresh before the token dies. */
    public long getExpirationSeconds() {
        return expirationMillis / 1000;
    }

    /**
     * Verify signature, issuer and expiry, returning the claims.
     *
     * @return claims when the token is valid, or {@code null} when it is not. Returning null
     *         rather than throwing keeps the filter readable: an invalid token simply means
     *         "not authenticated", and the request continues unauthenticated to be rejected by
     *         the authorization rules.
     */
    public Claims parseToken(String token) {
        try {
            return Jwts.parser()
                    .verifyWith(signingKey)
                    .requireIssuer(issuer)
                    .build()
                    .parseSignedClaims(token)
                    .getPayload();
        } catch (JwtException | IllegalArgumentException e) {
            log.debug("Rejected JWT: {}", e.getMessage());
            return null;
        }
    }
}
