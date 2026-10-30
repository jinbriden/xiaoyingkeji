package com.xiaoying.studio.auth;

import java.time.Instant;

import org.apache.ibatis.annotations.Delete;
import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

@Mapper
public interface AuthMapper {

    @Insert("INSERT INTO app_user (id, email, password_hash, created_at) VALUES (#{id}, #{email}, #{passwordHash}, #{createdAt})")
    void insertUser(AppUser user);

    @Select("SELECT id, email, password_hash, created_at FROM app_user WHERE email = #{email}")
    AppUser findUserByEmail(String email);

    @Insert("INSERT INTO user_session (token_hash, user_id, expires_at, created_at) VALUES (#{tokenHash}, #{userId}, #{expiresAt}, #{createdAt})")
    void insertSession(@Param("tokenHash") String tokenHash, @Param("userId") String userId,
                       @Param("expiresAt") Instant expiresAt, @Param("createdAt") Instant createdAt);

    @Select("""
            SELECT u.id, u.email, u.password_hash, u.created_at
            FROM user_session s JOIN app_user u ON u.id = s.user_id
            WHERE s.token_hash = #{tokenHash} AND s.expires_at > #{now}
            """)
    AppUser findUserBySession(@Param("tokenHash") String tokenHash, @Param("now") Instant now);

    @Delete("DELETE FROM user_session WHERE token_hash = #{tokenHash}")
    void deleteSession(String tokenHash);
}
