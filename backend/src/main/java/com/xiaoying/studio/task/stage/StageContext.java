package com.xiaoying.studio.task.stage;

import java.awt.image.BufferedImage;
import java.nio.file.Path;
import java.util.List;

import com.xiaoying.studio.task.Task;

/** 在一次任务执行的各阶段之间传递中间结果。 */
public class StageContext {

    private final Task task;
    private List<BufferedImage> images = List.of();
    private Path generatedFile;
    private String resultPath;

    public StageContext(Task task) {
        this.task = task;
    }

    public Task getTask() {
        return task;
    }

    public List<BufferedImage> getImages() {
        return images;
    }

    public void setImages(List<BufferedImage> images) {
        this.images = images;
    }

    public Path getGeneratedFile() {
        return generatedFile;
    }

    public void setGeneratedFile(Path generatedFile) {
        this.generatedFile = generatedFile;
    }

    public String getResultPath() {
        return resultPath;
    }

    public void setResultPath(String resultPath) {
        this.resultPath = resultPath;
    }
}
