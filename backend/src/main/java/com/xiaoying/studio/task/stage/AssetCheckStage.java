package com.xiaoying.studio.task.stage;

import java.awt.image.BufferedImage;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;

import javax.imageio.ImageIO;

import com.xiaoying.studio.asset.Asset;
import com.xiaoying.studio.asset.AssetMapper;
import com.xiaoying.studio.common.StorageService;
import com.xiaoying.studio.task.StageFailedException;
import com.xiaoying.studio.task.StageName;
import org.springframework.stereotype.Component;

/** 素材检查：确认每个素材文件仍然存在，并且能解码为图片。 */
@Component
public class AssetCheckStage implements TaskStage {

    private final AssetMapper assetMapper;
    private final StorageService storageService;

    public AssetCheckStage(AssetMapper assetMapper, StorageService storageService) {
        this.assetMapper = assetMapper;
        this.storageService = storageService;
    }

    @Override
    public StageName name() {
        return StageName.ASSET_CHECK;
    }

    @Override
    public void execute(StageContext context) {
        List<Asset> assets = assetMapper.findByTask(context.getTask().getId());
        if (assets.isEmpty()) {
            throw new StageFailedException("任务没有关联素材");
        }
        List<BufferedImage> images = new ArrayList<>(assets.size());
        for (int i = 0; i < assets.size(); i++) {
            images.add(readImage(assets.get(i), i + 1));
        }
        context.setImages(images);
    }

    private BufferedImage readImage(Asset asset, int number) {
        Path path = storageService.resolve(asset.getStoragePath());
        if (!Files.isRegularFile(path)) {
            throw new StageFailedException("第 " + number + " 张素材文件已丢失");
        }
        try {
            BufferedImage image = ImageIO.read(path.toFile());
            if (image == null) {
                throw new StageFailedException("第 " + number + " 张素材无法解析为图片");
            }
            return image;
        } catch (IOException e) {
            throw new StageFailedException("第 " + number + " 张素材已损坏", e);
        }
    }
}
