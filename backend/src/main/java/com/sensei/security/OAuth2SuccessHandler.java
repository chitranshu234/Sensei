package com.sensei.security;

import com.sensei.entity.UserEntity;
import com.sensei.repository.UserRepo;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.core.Authentication;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.oauth2.core.user.OAuth2User;
import org.springframework.security.web.authentication.SimpleUrlAuthenticationSuccessHandler;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.time.LocalDateTime;
import java.util.UUID;

@Component
public class OAuth2SuccessHandler extends SimpleUrlAuthenticationSuccessHandler {

    private final JwtService jwtService;
    private final UserRepo userRepo;
    private final PasswordEncoder passwordEncoder;
    private final String frontendUrl;

    public OAuth2SuccessHandler(JwtService jwtService,
                                UserRepo userRepo,
                                @org.springframework.context.annotation.Lazy PasswordEncoder passwordEncoder,
                                @Value("${app.security.allowed-origins:http://localhost:5173}") String allowedOrigins) {
        this.jwtService = jwtService;
        this.userRepo = userRepo;
        this.passwordEncoder = passwordEncoder;
        this.frontendUrl = allowedOrigins.split(",")[0];
    }

    @Override
    public void onAuthenticationSuccess(HttpServletRequest request,
                                        HttpServletResponse response,
                                        Authentication authentication) throws IOException, ServletException {
        
        OAuth2User oauth2User = (OAuth2User) authentication.getPrincipal();
        
        String email = oauth2User.getAttribute("email");
        String name = oauth2User.getAttribute("name");
        
        if (email == null) {
            // fallback
            email = oauth2User.getName();
        }

        // Find or create user
        String finalEmail = email;
        UserEntity user = userRepo.findByUsername(finalEmail).orElseGet(() -> {
            UserEntity newUser = new UserEntity();
            newUser.setUsername(finalEmail);
            newUser.setDisplayName(name);
            // set a random password for OAuth users
            newUser.setPasswordHash(passwordEncoder.encode(UUID.randomUUID().toString()));
            newUser.setLastLoginAt(LocalDateTime.now());
            newUser.setRole(userRepo.count() == 0 ? com.sensei.model.Role.ADMIN : com.sensei.model.Role.USER);
            return userRepo.save(newUser);
        });

        // update last login
        user.setLastLoginAt(LocalDateTime.now());
        if (name != null && user.getDisplayName() == null) {
            user.setDisplayName(name);
        }
        userRepo.save(user);

        // generate token
        String token = jwtService.generateToken(user);

        // redirect to frontend with token
        String targetUrl = frontendUrl + "/oauth2/callback?token=" + token;
        getRedirectStrategy().sendRedirect(request, response, targetUrl);
    }
}
