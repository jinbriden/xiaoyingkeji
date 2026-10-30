package com.xiaoying.studio.asset;

import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.time.Instant;
import java.util.UUID;

import com.xiaoying.studio.auth.AppUser;
import com.xiaoying.studio.common.ApiException;
import com.xiaoying.studio.common.StorageService;
import com.xiaoying.studio.template.Template;
import com.xiaoying.studio.template.TemplateMapper;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

@Service
public class AssetService {

    private final AssetMapper assetMapper;
    private final TemplateMapper templateMapper;
    private final StorageService storageService;

    public AssetService(AssetMapper assetMapper, TemplateMapper templateMapper, StorageService storageService) {
        this.assetMapper = assetMapper;
        this.templateMapper = templateMapper;
        this.storageService = storageService;
    }

    public Asset store(AppUser user, String templateId, MultipartFile file) {
        Template template = templateMapper.findById(templateId);
        if (template == null) {
            throw ApiException.notFound("TEMPLATE_NOT_FOUND", "模板不存在");
        }
        if (file.isEmpty()) {
            throw ApiException.badRequest("EMPTY_FILE", "文件内容为空");
        }
        if (file.getSize() > template.getMaxFileSizeBytes()) {
            throw new ApiException(HttpStatus.PAYLOAD_TOO_LARGE, "FILE_TOO_LARGE", "图片大小超过模板限制");
        }

        String mimeType = detectMimeType(file);
        if (!template.acceptedMimeTypeList().contains(mimeType)) {
            throw ApiException.badRequest("UNSUPPORTED_FILE_TYPE", "图片格式不符合模板要求");
        }

        String id = UUID.randomUUID().toString();
        String extension = "image/png".equals(mimeType) ? ".png" : ".jpg";
        String storagePath = "assets/" + id + extension;
        try (InputStream input = file.getInputStream()) {
            Files.copy(input, storageService.resolve(storagePath));
        } catch (IOException e) {
            throw new ApiException(HttpStatus.INTERNAL_SERVER_ERROR, "STORAGE_ERROR", "素材保存失败，请重试");
        }

        Asset asset = new Asset();
        asset.setId(id);
        asset.setUserId(user.getId());
        asset.setStoragePath(storagePath);
        asset.setMimeType(mimeType);
        asset.setSizeBytes(file.getSize());
        asset.setCreatedAt(Instant.now());
        assetMapper.insert(asset);
        return asset;
    }

    private String detectMimeType(MultipartFile file) {
        try (InputStream input = file.getInputStream()) {
            return ImageTypeDetector.detect(input.readNBytes(16))
                    .orElseThrow(() -> ApiException.badRequest("UNSUPPORTED_FILE_TYPE", "文件内容不是受支持的图片"));
        } catch (IOException e) {
            throw ApiException.badRequest("UNREADABLE_FILE", "文件无法读取");
        }
    }
}
