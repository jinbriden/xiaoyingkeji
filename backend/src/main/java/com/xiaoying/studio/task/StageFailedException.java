package com.xiaoying.studio.task;

/** 阶段执行失败，message 会展示给用户，需写成易懂的中文。 */
public class StageFailedException extends RuntimeException {

    public StageFailedException(String message) {
        super(message);
    }

    public StageFailedException(String message, Throwable cause) {
        super(message, cause);
    }
}
