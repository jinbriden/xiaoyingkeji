package com.xiaoying.studio.auth;

import com.xiaoying.studio.common.ApiException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.HandlerInterceptor;

/** 从 HttpOnly cookie 解析当前用户。业务接口只使用这里得到的用户 ID，不接受前端传入。 */
@Component
public class AuthInterceptor implements HandlerInterceptor {

    private static final String USER_ATTRIBUTE = "currentUser";

    private final AuthService authService;

    public AuthInterceptor(AuthService authService) {
        this.authService = authService;
    }

    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) {
        AppUser user = authService.findUserByCookie(request);
        if (user == null) {
            throw ApiException.unauthorized();
        }
        request.setAttribute(USER_ATTRIBUTE, user);
        return true;
    }

    public static AppUser currentUser(HttpServletRequest request) {
        AppUser user = (AppUser) request.getAttribute(USER_ATTRIBUTE);
        if (user == null) {
            throw ApiException.unauthorized();
        }
        return user;
    }
}
