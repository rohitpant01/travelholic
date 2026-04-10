const { Queue, Worker } = require('bullmq');
const IORedis = require('ioredis');

const REDIS_URL = process.env.REDIS_URL;
// 🔒 SOFT DISABLE: Change to true only when 503 issues are fully resolved.
const ENABLE_REDIS = false; 

let connection = null;
let notificationQueue = null;
let useQueue = false;

if (REDIS_URL && ENABLE_REDIS) {
  try {
    connection = new IORedis(REDIS_URL, { 
      maxRetriesPerRequest: null,
      connectTimeout: 5000, 
      enableReadyCheck: false,
      retryStrategy: (times) => {
        const delay = Math.min(times * 100, 3000);
        return delay;
      },
      reconnectOnError: (err) => {
        console.warn('[REDIS] Reconnect error:', err.message);
        return true;
      }
    });

    connection.on('error', (err) => {
      console.warn('[REDIS] Connection error:', err.message);
      useQueue = false;
    });

    connection.on('connect', () => {
      console.log('✅ [REDIS] Connected successfully');
      useQueue = true;
    });

    notificationQueue = new Queue('notifications', { 
      connection,
      defaultJobOptions: {
        attempts: 5,
        backoff: { type: 'exponential', delay: 5000 },
        removeOnComplete: true,
        removeOnFail: false,
      }
    });
  } catch (err) {
    console.warn('⚠️ [QUEUE] Falling back to immediate mode (Redis missing/failed):', err.message);
    useQueue = false;
  }
} else {
  console.log('ℹ️ [QUEUE] REDIS_URL not found. Using immediate background delivery.');
}

/**
 * Initialize the Notification Worker
 */
const initNotificationWorker = () => {
    if (!useQueue || !connection) return null;
    const { deliverNotification } = require('./notificationService');
    
    try {
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
    } catch (err) {
        console.error('[QUEUE] Worker initialization failed:', err.message);
        return null;
    }
};

/**
 * Add a notification to the queue
 */
const enqueueNotification = async (notificationId) => {
    if (useQueue && notificationQueue) {
        try {
            const idStr = notificationId.toString();
            await notificationQueue.add('deliver', { notificationId: idStr }, { 
                jobId: `notif_${idStr}`,
                removeOnComplete: true 
            });
            console.log(`[QUEUE] Enqueued notification ${idStr}`);
            return;
        } catch (err) {
            console.error('[QUEUE] Enqueue failed, falling back to immediate delivery:', err.message);
        }
    }
    
    // Fallback: Immediate delivery in background
    const { deliverNotification } = require('./notificationService');
    deliverNotification(notificationId).catch(err => console.error('[FALLBACK] Delivery failed:', err.message));
};

module.exports = {
    enqueueNotification,
    initNotificationWorker,
    notificationQueue
};
