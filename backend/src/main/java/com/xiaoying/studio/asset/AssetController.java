package com.xiaoying.studio.asset;

import com.xiaoying.studio.auth.AuthInterceptor;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/api/assets")
public class AssetController {

    public record AssetResponse(String id, String mimeType, long sizeBytes) {
    }

    private final AssetService assetService;

    public AssetController(AssetService assetService) {
        this.assetService = assetService;
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public AssetResponse upload(HttpServletRequest request,
                                @RequestParam String templateId,
                                @RequestPart("file") MultipartFile file) {
        Asset asset = assetService.store(AuthInterceptor.currentUser(request), templateId, file);
        return new AssetResponse(asset.getId(), asset.getMimeType(), asset.getSizeBytes());
    }
}
