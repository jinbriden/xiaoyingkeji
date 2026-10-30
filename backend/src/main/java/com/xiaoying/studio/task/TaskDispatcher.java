package com.xiaoying.studio.task;

import java.time.Instant;
import java.util.List;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Semaphore;

import jakarta.annotation.PostConstruct;
import jakarta.annotation.PreDestroy;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * 以 MySQL 任务表作为队列：定时取出最早的等待任务，抢占成功后交给固定大小的线程池。
 * 空闲线程不足时任务留在表中排队，因此提交接口和查询接口都不参与任务推进。
 */
@Component
@ConditionalOnProperty(name = "app.task.dispatcher-enabled", havingValue = "true")
public class TaskDispatcher {

    private static final Logger log = LoggerFactory.getLogger(TaskDispatcher.class);

    private final TaskMapper taskMapper;
    private final TaskRunner taskRunner;
    private final TaskService taskService;
    private final ExecutorService workers;
    private final Semaphore idleWorkers;

    public TaskDispatcher(TaskMapper taskMapper, TaskRunner taskRunner, TaskService taskService,
                          @Value("${app.task.worker-threads}") int workerThreads) {
        this.taskMapper = taskMapper;
        this.taskRunner = taskRunner;
        this.taskService = taskService;
        this.workers = Executors.newFixedThreadPool(workerThreads);
        this.idleWorkers = new Semaphore(workerThreads);
    }

    /** 在调度开始前执行，避免把本次启动刚领取的任务误判为遗留任务。 */
    @PostConstruct
    void failInterruptedTasks() {
        int count = taskService.failInterruptedTasks();
        if (count > 0) {
            log.warn("Marked {} interrupted tasks as failed", count);
        }
    }

    @Scheduled(fixedDelayString = "${app.task.dispatch-interval-ms}")
    void dispatch() {
        int idle = idleWorkers.availablePermits();
        if (idle == 0) {
            return;
        }
        List<String> pendingIds = taskMapper.findPendingIds(idle);
        for (String taskId : pendingIds) {
            if (taskMapper.claim(taskId, Instant.now()) == 1) {
                idleWorkers.acquireUninterruptibly();
                workers.execute(() -> runAndRelease(taskId));
            }
        }
    }

    private void runAndRelease(String taskId) {
        try {
            taskRunner.run(taskId);
        } catch (RuntimeException e) {
            log.error("Task {} stopped unexpectedly", taskId, e);
            taskMapper.markFailed(taskId, null, "任务执行异常", Instant.now());
        } finally {
            idleWorkers.release();
        }
    }

    @PreDestroy
    void shutdown() {
        workers.shutdownNow();
    }
}
