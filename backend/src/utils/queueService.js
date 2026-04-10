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
        const { notificationId } = job.data;
        console.log(`[QUEUE] Processing notification ${notificationId}`);
        
        try {
            await deliverNotification(notificationId);
        } catch (error) {
            console.error(`[QUEUE] Job ${job.id} failed:`, error.message);
            throw error;
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
const enqueueNotification = async (notificationId) => {
    await notificationQueue.add('deliver', { notificationId }, { 
        jobId: `notif_${notificationId}`,
        removeOnComplete: true 
    });
    console.log(`[QUEUE] Enqueued notification ${notificationId}`);
};

module.exports = {
    enqueueNotification,
    initNotificationWorker,
    notificationQueue
};
