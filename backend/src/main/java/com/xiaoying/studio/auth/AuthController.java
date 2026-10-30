package com.xiaoying.studio.auth;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseCookie;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    public record CredentialsRequest(
            @NotBlank(message = "请输入邮箱") @Email(message = "邮箱格式不正确") @Size(max = 255, message = "邮箱过长") String email,
            @NotBlank(message = "请输入密码") @Size(min = 8, max = 72, message = "密码长度需为 8 到 72 位") String password) {
    }

    public record UserResponse(String id, String email) {
        static UserResponse of(AppUser user) {
            return new UserResponse(user.getId(), user.getEmail());
        }
    }

    private final AuthService authService;

    public AuthController(AuthService authService) {
        this.authService = authService;
    }

    @PostMapping("/register")
    public ResponseEntity<UserResponse> register(@Valid @RequestBody CredentialsRequest body) {
        AppUser user = authService.register(body.email(), body.password());
        return withSession(user, HttpStatus.CREATED);
    }

    @PostMapping("/login")
    public ResponseEntity<UserResponse> login(@Valid @RequestBody CredentialsRequest body) {
        AppUser user = authService.login(body.email(), body.password());
        return withSession(user, HttpStatus.OK);
    }

    @PostMapping("/logout")
    public ResponseEntity<Void> logout(HttpServletRequest request) {
        ResponseCookie cookie = authService.clearSession(request);
        return ResponseEntity.noContent().header(HttpHeaders.SET_COOKIE, cookie.toString()).build();
    }

    @GetMapping("/me")
    public UserResponse me(HttpServletRequest request) {
        return UserResponse.of(AuthInterceptor.currentUser(request));
    }

    private ResponseEntity<UserResponse> withSession(AppUser user, HttpStatus status) {
        ResponseCookie cookie = authService.createSession(user);
        return ResponseEntity.status(status)
                .header(HttpHeaders.SET_COOKIE, cookie.toString())
                .body(UserResponse.of(user));
    }
}
