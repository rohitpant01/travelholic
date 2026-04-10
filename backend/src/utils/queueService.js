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
      // Fix 1: Robust retry strategy that doesn't crash the process
      retryStrategy: (times) => {
        if (times > 5) {
            console.error('[REDIS] Max retries reached. Disabling queue.');
            useQueue = false;
            return null; // stop retrying
        }
        return Math.min(times * 500, 2000);
      },
      reconnectOnError: (err) => {
        console.warn('[REDIS] Reconnect error:', err.message);
        return true;
      }
    });

    connection.on('error', (err) => {
      console.warn('[REDIS] Connection error (non-fatal):', err.message);
      useQueue = false;
    });

    connection.on('connect', () => {
      console.log('✅ [REDIS] Connected successfully');
      if (ENABLE_REDIS) useQueue = true;
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

/**
 * Fix 3: Get current Redis status for health check
 */
const getRedisStatus = () => {
    if (!ENABLE_REDIS) return 'disabled';
    if (!connection) return 'not_initialized';
    return connection.status === 'ready' ? 'connected' : connection.status;
};

module.exports = {
    enqueueNotification,
    initNotificationWorker,
    notificationQueue,
    getRedisStatus
};
