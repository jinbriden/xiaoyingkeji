package com.xiaoying.studio.common;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.file.Files;
import java.nio.file.Path;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

/** 管理服务端本地文件。数据库只保存相对路径，部署时可把根目录挂载为数据卷。 */
@Service
public class StorageService {

    private final Path root;

    public StorageService(@Value("${app.storage.root}") String root) {
        this.root = Path.of(root).toAbsolutePath().normalize();
        try {
            Files.createDirectories(this.root.resolve("assets"));
            Files.createDirectories(this.root.resolve("work"));
            Files.createDirectories(this.root.resolve("results"));
        } catch (IOException e) {
            throw new UncheckedIOException("无法创建存储目录: " + this.root, e);
        }
    }

    public Path resolve(String relativePath) {
        Path resolved = root.resolve(relativePath).normalize();
        if (!resolved.startsWith(root)) {
            throw new IllegalArgumentException("非法存储路径: " + relativePath);
        }
        return resolved;
    }
}
