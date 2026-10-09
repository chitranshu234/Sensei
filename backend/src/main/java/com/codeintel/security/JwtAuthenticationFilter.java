package com.codeintel.security;

import io.jsonwebtoken.Claims;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.lang.NonNull;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.authentication.WebAuthenticationDetailsSource;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.List;

/**
 * Reads the bearer token from the {@code Authorization} header and, when it is valid, populates
 * the security context for the current request.
 *
 * <p>Extends {@link OncePerRequestFilter} so a forwarded or error-dispatched request cannot
 * re-authenticate twice.
 *
 * <p>Note what this filter does <b>not</b> do: it never rejects a request. It only establishes
 * identity when a good token is present. Rejecting is the job of the authorization rules in
 * {@link SecurityConfig}, which keeps "who are you" and "are you allowed" cleanly separated.
 */
@Component
public class JwtAuthenticationFilter extends OncePerRequestFilter {

    private static final String HEADER = "Authorization";
    private static final String PREFIX = "Bearer ";

    private final JwtService jwtService;

    public JwtAuthenticationFilter(JwtService jwtService) {
        this.jwtService = jwtService;
    }

    @Override
    protected void doFilterInternal(@NonNull HttpServletRequest request,
                                    @NonNull HttpServletResponse response,
                                    @NonNull FilterChain filterChain)
            throws ServletException, IOException {

        String token = extractToken(request);

        if (token != null && SecurityContextHolder.getContext().getAuthentication() == null) {
            Claims claims = jwtService.parseToken(token);

            if (claims != null) {
                String username = claims.getSubject();
                String role = claims.get("role", String.class);

                var authorities = List.of(new SimpleGrantedAuthority("ROLE_" + (role == null ? "USER" : role)));

                var authentication = new UsernamePasswordAuthenticationToken(username, null, authorities);
                authentication.setDetails(new WebAuthenticationDetailsSource().buildDetails(request));

                SecurityContextHolder.getContext().setAuthentication(authentication);
            }
        }

        filterChain.doFilter(request, response);
    }

    /** Accept the standard {@code Authorization: Bearer <token>} header. */
    private String extractToken(HttpServletRequest request) {
        String header = request.getHeader(HEADER);
        if (header == null || !header.startsWith(PREFIX)) {
            return null;
        }
        String token = header.substring(PREFIX.length()).trim();
        return token.isEmpty() ? null : token;
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        // Skip only the public, token-less endpoints. /api/auth/me DOES carry a bearer token and
        // must be filtered — otherwise the SecurityContext (and @AuthenticationPrincipal /
        // Authentication in the controller) would be empty and the request would 500 or 401.
        String path = request.getServletPath();
        return path.equals("/api/auth/login")
                || path.equals("/api/auth/register")
                || path.equals("/api/auth/health")
                || path.equals("/api/health");
    }
}
