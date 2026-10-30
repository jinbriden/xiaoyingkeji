package com.xiaoying.studio.task;

/** 制作阶段，声明顺序就是执行顺序。 */
public enum StageName {
    ASSET_CHECK("素材检查"),
    GENERATE("模拟生成"),
    RESULT("结果整理");

    private final String label;

    StageName(String label) {
        this.label = label;
    }

    public String label() {
        return label;
    }
}
