package com.codeintel.service;

import com.codeintel.dto.AuthResponse;
import com.codeintel.dto.LoginRequest;
import com.codeintel.dto.RegisterRequest;
import com.codeintel.entity.UserEntity;
import com.codeintel.exception.BadRequestException;
import com.codeintel.model.Role;
import com.codeintel.repository.UserRepo;
import com.codeintel.security.JwtService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;

/**
 * Registration and login.
 *
 * <p>Two security-relevant behaviours live here:
 * <ul>
 *   <li>Registration refuses a duplicate username up front with a clear message, rather than
 *       relying on the database's unique constraint to throw an opaque error mid-transaction.</li>
 *   <li>Login failures return the <b>same</b> message whether the username does not exist or the
 *       password is wrong. Distinguishing the two would let an attacker enumerate valid usernames,
 *       which is the reconnaissance step of a credential-stuffing campaign.</li>
 * </ul>
 */
@Service
public class AuthService {

    private static final Logger log = LoggerFactory.getLogger(AuthService.class);

    private final UserRepo userRepo;
    private final JwtService jwtService;
    private final PasswordEncoder passwordEncoder;
    private final AuthenticationManager authenticationManager;

    public AuthService(UserRepo userRepo,
                       JwtService jwtService,
                       PasswordEncoder passwordEncoder,
                       AuthenticationManager authenticationManager) {
        this.userRepo = userRepo;
        this.jwtService = jwtService;
        this.passwordEncoder = passwordEncoder;
        this.authenticationManager = authenticationManager;
    }

    /**
     * Create an account and return a token immediately, so the user lands signed in.
     *
     * <p>The first account ever created is granted ADMIN — a bootstrap convenience so a fresh
     * deployment has an administrator without anyone hand-editing the database.
     */
    @Transactional
    public AuthResponse register(RegisterRequest request) {
        String username = request.getUsername().trim();

        // Case-insensitive collision check: "Alice" and "alice" must not both exist, or users
        // will be unable to tell which account they are signing into.
        if (userRepo.existsByUsername(username) || userRepo.existsByUsername(username.toLowerCase())) {
            throw new BadRequestException("That username is already taken.");
        }

        UserEntity user = new UserEntity();
        user.setUsername(username);
        user.setPasswordHash(passwordEncoder.encode(request.getPassword()));
        user.setDisplayName(
                (request.getDisplayName() == null || request.getDisplayName().isBlank())
                        ? username
                        : request.getDisplayName().trim());
        user.setRole(userRepo.count() == 0 ? Role.ADMIN : Role.USER);

        UserEntity saved = userRepo.save(user);
        log.info("Registered new user '{}' with role {}", saved.getUsername(), saved.getRole());

        return buildResponse(saved);
    }

    /** Verify credentials and mint a token. */
    @Transactional
    public AuthResponse login(LoginRequest request) {
        String username = request.getUsername().trim();

        try {
            // Delegating to the AuthenticationManager keeps the BCrypt comparison and the
            // user-lookup rules in exactly one place instead of reimplementing them here.
            authenticationManager.authenticate(
                    new UsernamePasswordAuthenticationToken(username, request.getPassword()));
        } catch (AuthenticationException e) {
            log.warn("Failed login attempt for '{}'", username);
            throw new BadRequestException("Invalid username or password.");
        }

        UserEntity user = userRepo.findByUsername(username)
                .orElseThrow(() -> new BadRequestException("Invalid username or password."));

        user.setLastLoginAt(LocalDateTime.now());
        userRepo.save(user);

        return buildResponse(user);
    }

    /** Return the profile of the signed-in user without re-issuing credentials. */
    @Transactional(readOnly = true)
    public AuthResponse currentUser(String username) {
        UserEntity user = userRepo.findByUsername(username)
                .orElseThrow(() -> new BadRequestException("Signed-in user no longer exists."));

        AuthResponse response = buildResponse(user);
        response.setToken(null);
        return response;
    }

    private AuthResponse buildResponse(UserEntity user) {
        return new AuthResponse(
                jwtService.generateToken(user),
                jwtService.getExpirationSeconds(),
                user.getId(),
                user.getUsername(),
                user.getDisplayName(),
                user.getRole().name()
        );
    }
}
