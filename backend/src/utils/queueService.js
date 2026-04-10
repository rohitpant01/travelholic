const { Queue, Worker } = require('bullmq');
const IORedis = require('ioredis');

const REDIS_URL = process.env.REDIS_URL || 'redis://127.0.0.1:6379';
const connection = new IORedis(REDIS_URL, { maxRetriesPerRequest: null });

const notificationQueue = new Queue('notifications', { 
  connection,
  defaultJobOptions: {
    attempts: 5,
    backoff: {
      type: 'exponential',
      delay: 5000, // 5s, then 10s, 20s...
    },
    removeOnComplete: true,
    removeOnFail: false,
  }
});

/**
 * Initialize the Notification Worker
 */
const initNotificationWorker = () => {
    const { deliverNotification } = require('./notificationService');
    
    const worker = new Worker('notifications', async (job) => {
        console.log(`[QUEUE] Processing job ${job.id} for user ${job.data.userId}`);
        const { userId, type, content, data, priority, idempotencyKey } = job.data;
        
        try {
            await deliverNotification(userId, type, content, data, priority, idempotencyKey);
        } catch (error) {
            console.error(`[QUEUE] Job ${job.id} failed:`, error.message);
            throw error; // Rethrow to trigger BullMQ retry
        }
    }, { connection });

    worker.on('completed', (job) => {
        console.log(`[QUEUE] Job ${job.id} completed successfully`);
    });

    worker.on('failed', (job, err) => {
        console.error(`[QUEUE] Job ${job.id} failed after retries:`, err.message);
    });

    return worker;
};

/**
 * Add a notification to the queue
 */
const enqueueNotification = async (userId, type, content, data = {}, priority = 'normal', idempotencyKey = null) => {
    const jobKey = idempotencyKey || `${userId}_${type}_${Date.now()}`;
    await notificationQueue.add(jobKey, {
        userId,
        type,
        content,
        data,
        priority,
        idempotencyKey
    }, { jobId: jobKey });
    console.log(`[QUEUE] Enqueued ${type} for ${userId} (Key: ${jobKey})`);
};

module.exports = {
    enqueueNotification,
    initNotificationWorker,
    notificationQueue
};
