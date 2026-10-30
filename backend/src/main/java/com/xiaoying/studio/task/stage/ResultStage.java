package com.xiaoying.studio.task.stage;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;

import com.xiaoying.studio.common.StorageService;
import com.xiaoying.studio.task.StageFailedException;
import com.xiaoying.studio.task.StageName;
import org.springframework.stereotype.Component;

/** 结果整理：把生成文件移入结果目录，得到最终的存储路径。 */
@Component
public class ResultStage implements TaskStage {

    private final StorageService storageService;

    public ResultStage(StorageService storageService) {
        this.storageService = storageService;
    }

    @Override
    public StageName name() {
        return StageName.RESULT;
    }

    @Override
    public void execute(StageContext context) {
        Path generated = context.getGeneratedFile();
        if (generated == null || !Files.isRegularFile(generated)) {
            throw new StageFailedException("未找到生成结果");
        }
        String resultPath = "results/" + context.getTask().getId() + ".png";
        try {
            Files.move(generated, storageService.resolve(resultPath), StandardCopyOption.REPLACE_EXISTING);
        } catch (IOException e) {
            throw new StageFailedException("结果文件保存失败", e);
        }
        context.setResultPath(resultPath);
    }
}
