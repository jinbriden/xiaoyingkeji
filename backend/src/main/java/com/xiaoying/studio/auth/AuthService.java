package com.xiaoying.studio.auth;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.Duration;
import java.time.Instant;
import java.util.Base64;
import java.util.HexFormat;
import java.util.Locale;
import java.util.UUID;

import com.xiaoying.studio.common.ApiException;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseCookie;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Service;

@Service
public class AuthService {

    private static final SecureRandom RANDOM = new SecureRandom();

    private final AuthMapper authMapper;
    private final BCryptPasswordEncoder passwordEncoder = new BCryptPasswordEncoder();
    private final String cookieName;
    private final boolean cookieSecure;
    private final Duration sessionTtl;

    public AuthService(AuthMapper authMapper,
                       @Value("${app.auth.cookie-name}") String cookieName,
                       @Value("${app.auth.cookie-secure}") boolean cookieSecure,
                       @Value("${app.auth.session-ttl}") Duration sessionTtl) {
        this.authMapper = authMapper;
        this.cookieName = cookieName;
        this.cookieSecure = cookieSecure;
        this.sessionTtl = sessionTtl;
    }

    public AppUser register(String email, String password) {
        AppUser user = new AppUser();
        user.setId(UUID.randomUUID().toString());
        user.setEmail(normalizeEmail(email));
        user.setPasswordHash(passwordEncoder.encode(password));
        user.setCreatedAt(Instant.now());
        try {
            authMapper.insertUser(user);
        } catch (DuplicateKeyException e) {
            throw new ApiException(HttpStatus.CONFLICT, "EMAIL_TAKEN", "该邮箱已注册");
        }
        return user;
    }

    public AppUser login(String email, String password) {
        AppUser user = authMapper.findUserByEmail(normalizeEmail(email));
        if (user == null || !passwordEncoder.matches(password, user.getPasswordHash())) {
            throw new ApiException(HttpStatus.UNAUTHORIZED, "INVALID_CREDENTIALS", "邮箱或密码不正确");
        }
        return user;
    }

    /** 创建会话并返回写入浏览器的 cookie。数据库只保存 token 的哈希。 */
    public ResponseCookie createSession(AppUser user) {
        byte[] bytes = new byte[32];
        RANDOM.nextBytes(bytes);
        String token = Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
        Instant now = Instant.now();
        authMapper.insertSession(hash(token), user.getId(), now.plus(sessionTtl), now);
        return baseCookie(token).maxAge(sessionTtl).build();
    }

    public ResponseCookie clearSession(HttpServletRequest request) {
        String token = readToken(request);
        if (token != null) {
            authMapper.deleteSession(hash(token));
        }
        return baseCookie("").maxAge(0).build();
    }

    public AppUser findUserByCookie(HttpServletRequest request) {
        String token = readToken(request);
        return token == null ? null : authMapper.findUserBySession(hash(token), Instant.now());
    }

    private ResponseCookie.ResponseCookieBuilder baseCookie(String value) {
        return ResponseCookie.from(cookieName, value)
                .httpOnly(true)
                .secure(cookieSecure)
                .sameSite("Lax")
                .path("/");
    }

    private String readToken(HttpServletRequest request) {
        Cookie[] cookies = request.getCookies();
        if (cookies == null) {
            return null;
        }
        for (Cookie cookie : cookies) {
            if (cookieName.equals(cookie.getName()) && !cookie.getValue().isEmpty()) {
                return cookie.getValue();
            }
        }
        return null;
    }

    private static String normalizeEmail(String email) {
        return email.trim().toLowerCase(Locale.ROOT);
    }

    private static String hash(String token) {
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256").digest(token.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(digest);
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }
}
