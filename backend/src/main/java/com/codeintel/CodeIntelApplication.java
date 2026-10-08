package com.codeintel;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableAsync;

@SpringBootApplication
@EnableAsync
public class CodeIntelApplication {
    public static void main(String[] args) {
        SpringApplication.run(CodeIntelApplication.class, args);
    }
}
