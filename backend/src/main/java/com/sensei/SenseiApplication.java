package com.sensei;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableAsync;

@SpringBootApplication
@EnableAsync
public class SenseiApplication {
    public static void main(String[] args) {
        SpringApplication.run(SenseiApplication.class, args);
    }
}
