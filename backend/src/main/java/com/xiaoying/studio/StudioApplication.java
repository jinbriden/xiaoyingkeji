package com.xiaoying.studio;

import org.mybatis.spring.annotation.MapperScan;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.ConfigurationPropertiesScan;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@ConfigurationPropertiesScan
@EnableScheduling
@MapperScan(basePackages = "com.xiaoying.studio", annotationClass = org.apache.ibatis.annotations.Mapper.class)
public class StudioApplication {

    public static void main(String[] args) {
        SpringApplication.run(StudioApplication.class, args);
    }
}
