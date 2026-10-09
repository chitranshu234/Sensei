package com.codeintel.controller;

import com.codeintel.dto.AuthResponse;
import com.codeintel.dto.LoginRequest;
import com.codeintel.dto.RegisterRequest;
import com.codeintel.service.AuthService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

/**
 * Authentication endpoints. Every path under {@code /api/auth} is public in
 * {@link com.codeintel.security.SecurityConfig}; everything else requires a valid token.
 */
@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final AuthService authService;

    public AuthController(AuthService authService) {
        this.authService = authService;
    }

    /** Create an account. Returns 201 with a token so the client is signed in immediately. */
    @PostMapping("/register")
    public ResponseEntity<AuthResponse> register(@Valid @RequestBody RegisterRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(authService.register(request));
    }

    @PostMapping("/login")
    public ResponseEntity<AuthResponse> login(@Valid @RequestBody LoginRequest request) {
        return ResponseEntity.ok(authService.login(request));
    }

    /**
     * Profile of the caller, derived from the token's subject (the {@link Authentication} name) —
     * never from a client-supplied id, which could otherwise be tampered with to read another
     * user's profile. The JWT filter populates this authentication from the bearer token.
     */
    @GetMapping("/me")
    public ResponseEntity<AuthResponse> me(Authentication authentication) {
        return ResponseEntity.ok(authService.currentUser(authentication.getName()));
    }

    /** Liveness probe. Kept public so load balancers and the client can poll it freely. */
    @GetMapping("/health")
    public ResponseEntity<Map<String, Object>> health() {
        return ResponseEntity.ok(Map.of("status", "ok", "service", "ai-codebase-intelligence"));
    }
}
