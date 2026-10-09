package com.sensei.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableAsync;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;

import java.util.concurrent.Executor;
import java.util.concurrent.ThreadPoolExecutor;

/**
 * Thread pool for repository ingestion.
 *
 * <p>Ingestion is CPU- and IO-heavy (clone, AST parse, embedding) so it must never run on the
 * request thread. A dedicated, small, bounded pool is used rather than the shared
 * {@code SimpleAsyncTaskExecutor}, because an unbounded executor under a burst of submissions
 * would spawn a thread per repository and exhaust memory.
 *
 * <p>{@code CallerRunsPolicy} is the deliberate back-pressure choice: once the queue is full the
 * submitting thread runs the task itself, which naturally slows submissions down instead of
 * dropping work on the floor.
 */
@Configuration
@EnableAsync
public class AsyncConfig {

    @Value("${app.ingestion.core-pool-size:2}")
    private int corePoolSize;

    @Value("${app.ingestion.max-pool-size:4}")
    private int maxPoolSize;

    @Value("${app.ingestion.queue-capacity:50}")
    private int queueCapacity;

    @Bean(name = "ingestionExecutor")
    public Executor ingestionExecutor() {
        ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();
        executor.setCorePoolSize(corePoolSize);
        executor.setMaxPoolSize(maxPoolSize);
        executor.setQueueCapacity(queueCapacity);
        executor.setThreadNamePrefix("ingestion-");
        executor.setRejectedExecutionHandler(new ThreadPoolExecutor.CallerRunsPolicy());
        executor.setWaitForTasksToCompleteOnShutdown(true);
        executor.setAwaitTerminationSeconds(60);
        executor.initialize();
        return executor;
    }
}
