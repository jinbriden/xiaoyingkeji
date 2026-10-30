package com.xiaoying.studio.asset;

import java.util.Optional;

/** 根据文件头判断真实图片类型，不信任浏览器上报的 Content-Type。 */
public final class ImageTypeDetector {

    private static final byte[] PNG = {(byte) 0x89, 'P', 'N', 'G', '\r', '\n', 0x1A, '\n'};
    private static final byte[] JPEG = {(byte) 0xFF, (byte) 0xD8, (byte) 0xFF};

    private ImageTypeDetector() {
    }

    public static Optional<String> detect(byte[] header) {
        if (startsWith(header, PNG)) {
            return Optional.of("image/png");
        }
        if (startsWith(header, JPEG)) {
            return Optional.of("image/jpeg");
        }
        return Optional.empty();
    }

    private static boolean startsWith(byte[] data, byte[] prefix) {
        if (data.length < prefix.length) {
            return false;
        }
        for (int i = 0; i < prefix.length; i++) {
            if (data[i] != prefix[i]) {
                return false;
            }
        }
        return true;
    }
}
