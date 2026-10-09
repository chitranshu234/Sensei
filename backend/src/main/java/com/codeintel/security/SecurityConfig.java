package com.codeintel.security;

import com.codeintel.exception.GlobalExceptionHandler;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.dao.DaoAuthenticationProvider;
import org.springframework.security.config.annotation.authentication.configuration.AuthenticationConfiguration;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Central security configuration.
 *
 * <p>Key decisions, each of which is a common interview question:
 *
 * <ul>
 *   <li><b>Stateless sessions.</b> {@code SessionCreationPolicy.STATELESS} means no HttpSession is
 *       created or read. Identity travels in the JWT, so the app can scale horizontally with no
 *       sticky sessions and no shared session store. It also sidesteps the SSE pitfall where a
 *       streaming response holds a session lock.</li>
 *   <li><b>CSRF disabled — and that is correct here.</b> CSRF attacks work by riding a
 *       <em>cookie</em> the browser attaches automatically. This API authenticates with an
 *       explicit {@code Authorization} header that a cross-site form cannot set, so the attack
 *       surface does not exist. Re-enabling CSRF without cookies would break every POST for no
 *       security gain.</li>
 *   <li><b>BCrypt.</b> A deliberately slow, salted hash. Unlike MD5/SHA-256 it is designed to
 *       resist GPU brute force, and the salt is embedded per hash so identical passwords produce
 *       different digests.</li>
 *   <li><b>Deny by default.</b> The catch-all rule is {@code authenticated()}, so a new endpoint
 *       added later is protected automatically rather than exposed by omission.</li>
 * </ul>
 */
@Configuration
@EnableWebSecurity
@EnableMethodSecurity
public class SecurityConfig {

    private final JwtAuthenticationFilter jwtAuthenticationFilter;
    private final UserDetailsService userDetailsService;
    private final ObjectMapper objectMapper;

    @Value("${app.security.h2-console-enabled:true}")
    private boolean h2ConsoleEnabled;

    @Value("${app.security.allowed-origins:http://localhost:5173,http://127.0.0.1:5173}")
    private String allowedOrigins;

    public SecurityConfig(JwtAuthenticationFilter jwtAuthenticationFilter,
                          UserDetailsService userDetailsService,
                          ObjectMapper objectMapper) {
        this.jwtAuthenticationFilter = jwtAuthenticationFilter;
        this.userDetailsService = userDetailsService;
        this.objectMapper = objectMapper;
    }

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        http
                .cors(cors -> cors.configurationSource(corsConfigurationSource()))
                .csrf(csrf -> csrf.disable())
                .sessionManagement(session ->
                        session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .authorizeHttpRequests(auth -> {
                    auth.requestMatchers(HttpMethod.OPTIONS, "/**").permitAll();
                    // Only the token-less auth endpoints are public. /api/auth/me carries a
                    // bearer token and must stay protected — it falls through to the
                    // authenticated() catch-all below.
                    auth.requestMatchers("/api/auth/login", "/api/auth/register", "/api/auth/health").permitAll();
                    auth.requestMatchers("/api/health", "/actuator/health").permitAll();

                    // The H2 console renders inside a frameset, so it needs SAMEORIGIN. It is a
                    // raw SQL window with no authentication of its own and must never be enabled
                    // in production — see the app.security.h2-console-enabled flag.
                    if (h2ConsoleEnabled) {
                        auth.requestMatchers("/h2-console/**").permitAll();
                    }

                    auth.anyRequest().authenticated();
                })
                .headers(headers -> headers.frameOptions(frame -> {
                    if (h2ConsoleEnabled) {
                        frame.sameOrigin();
                    } else {
                        frame.deny();
                    }
                }))
                .authenticationProvider(authenticationProvider())
                .addFilterBefore(jwtAuthenticationFilter, UsernamePasswordAuthenticationFilter.class)
                .exceptionHandling(ex -> ex
                        .authenticationEntryPoint(this::writeUnauthorized)
                        .accessDeniedHandler((request, response, denied) ->
                                writeError(response, 403, "Forbidden",
                                        "You do not have permission to perform this action."))
                );

        return http.build();
    }

    /**
     * Authentication is delegated to a {@link DaoAuthenticationProvider} backed by our
     * {@link UserDetailsService} and the BCrypt encoder.
     */
    @Bean
    public DaoAuthenticationProvider authenticationProvider() {
        DaoAuthenticationProvider provider = new DaoAuthenticationProvider();
        provider.setUserDetailsService(userDetailsService);
        provider.setPasswordEncoder(passwordEncoder());
        // Do not leak whether the username or the password was wrong.
        provider.setHideUserNotFoundExceptions(true);
        return provider;
    }

    @Bean
    public AuthenticationManager authenticationManager(AuthenticationConfiguration config)
            throws Exception {
        return config.getAuthenticationManager();
    }

    /**
     * BCrypt with the default strength (10 rounds ≈ 100ms per hash on commodity hardware). The
     * cost is the point: it makes offline brute force expensive while staying imperceptible on a
     * single login.
     */
    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    /**
     * CORS must be declared here even though a {@code WebMvcConfigurer} also configures it. The
     * security filter chain runs <em>before</em> Spring MVC, so without this bean preflight
     * {@code OPTIONS} requests would be rejected with 401 before the MVC config was ever consulted.
     */
    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration configuration = new CorsConfiguration();
        configuration.setAllowedOrigins(List.of(allowedOrigins.split(",")));
        configuration.setAllowedMethods(List.of("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"));
        configuration.setAllowedHeaders(List.of("*"));
        configuration.setExposedHeaders(List.of("Authorization"));
        configuration.setAllowCredentials(true);
        configuration.setMaxAge(3600L);

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", configuration);
        return source;
    }

    /** Emit the same JSON error shape as {@link GlobalExceptionHandler}, for 401s. */
    private void writeUnauthorized(jakarta.servlet.http.HttpServletRequest request,
                                   jakarta.servlet.http.HttpServletResponse response,
                                   org.springframework.security.core.AuthenticationException e)
            throws java.io.IOException {
        writeError(response, 401, "Unauthorized",
                "Authentication required. Please sign in and try again.");
    }

    private void writeError(jakarta.servlet.http.HttpServletResponse response,
                            int status, String error, String message) throws java.io.IOException {
        response.setStatus(status);
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        response.setCharacterEncoding("UTF-8");

        Map<String, Object> body = new LinkedHashMap<>();
        body.put("timestamp", LocalDateTime.now().toString());
        body.put("status", status);
        body.put("error", error);
        body.put("message", message);

        objectMapper.writeValue(response.getWriter(), body);
    }
}
