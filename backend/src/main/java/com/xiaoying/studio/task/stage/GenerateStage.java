package com.xiaoying.studio.task.stage;

import java.awt.Color;
import java.awt.Graphics2D;
import java.awt.RenderingHints;
import java.awt.image.BufferedImage;
import java.io.IOException;
import java.nio.file.Path;
import java.util.List;

import javax.imageio.ImageIO;

import com.xiaoying.studio.common.StorageService;
import com.xiaoying.studio.task.StageFailedException;
import com.xiaoying.studio.task.StageName;
import org.springframework.stereotype.Component;

/** 模拟生成：把用户素材拼成一张竖版图片，写入临时目录，不调用真实 AI 服务。 */
@Component
public class GenerateStage implements TaskStage {

    private static final int WIDTH = 720;
    private static final int HEIGHT = 1280;
    private static final int GAP = 16;

    private final StorageService storageService;

    public GenerateStage(StorageService storageService) {
        this.storageService = storageService;
    }

    @Override
    public StageName name() {
        return StageName.GENERATE;
    }

    @Override
    public void execute(StageContext context) {
        BufferedImage canvas = compose(context.getImages());
        Path file = storageService.resolve("work/" + context.getTask().getId() + ".png");
        try {
            ImageIO.write(canvas, "png", file.toFile());
        } catch (IOException e) {
            throw new StageFailedException("生成图片写入失败", e);
        }
        context.setGeneratedFile(file);
    }

    private BufferedImage compose(List<BufferedImage> images) {
        BufferedImage canvas = new BufferedImage(WIDTH, HEIGHT, BufferedImage.TYPE_INT_RGB);
        Graphics2D graphics = canvas.createGraphics();
        try {
            graphics.setRenderingHint(RenderingHints.KEY_INTERPOLATION, RenderingHints.VALUE_INTERPOLATION_BILINEAR);
            graphics.setColor(new Color(0x12, 0x14, 0x18));
            graphics.fillRect(0, 0, WIDTH, HEIGHT);

            int columns = images.size() >= 4 ? 2 : 1;
            int rows = (images.size() + columns - 1) / columns;
            int cellWidth = (WIDTH - GAP * (columns + 1)) / columns;
            int cellHeight = (HEIGHT - GAP * (rows + 1)) / rows;
            for (int i = 0; i < images.size(); i++) {
                int x = GAP + (i % columns) * (cellWidth + GAP);
                int y = GAP + (i / columns) * (cellHeight + GAP);
                drawCover(graphics, images.get(i), x, y, cellWidth, cellHeight);
            }
        } finally {
            graphics.dispose();
        }
        return canvas;
    }

    /** 等比缩放并居中裁切，铺满目标区域。 */
    private void drawCover(Graphics2D graphics, BufferedImage image, int x, int y, int width, int height) {
        double scale = Math.max((double) width / image.getWidth(), (double) height / image.getHeight());
        int sourceWidth = (int) Math.round(width / scale);
        int sourceHeight = (int) Math.round(height / scale);
        int sourceX = (image.getWidth() - sourceWidth) / 2;
        int sourceY = (image.getHeight() - sourceHeight) / 2;
        graphics.drawImage(image, x, y, x + width, y + height,
                sourceX, sourceY, sourceX + sourceWidth, sourceY + sourceHeight, null);
    }
}
