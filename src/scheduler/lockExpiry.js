import Slot from '../models/Slot.js';
import config from '../config/index.js';
import { expireLock } from '../services/slotReleaseService.js';

let timer = null;

export async function processExpiredLocks() {
  const now = new Date();
  const lockDurationMs = config.slotLockDuration * 1000;
  const cutoffTime = new Date(now.getTime() - lockDurationMs);

  const expiredSlots = await Slot.find({
    status: 'locked',
    lockedAt: { $lt: cutoffTime }
  });

  const count = expiredSlots.length;
  
  for (const slot of expiredSlots) {
    try {
      await expireLock(slot._id);
    } catch (error) {
      console.error(`释放号源 ${slot._id} 失败:`, error.message);
    }
  }

  return count;
}

export function startLockExpiryScheduler(intervalMinutes = 1) {
  if (timer) {
    stopLockExpiryScheduler();
  }

  const intervalMs = intervalMinutes * 60 * 1000;
  
  timer = setInterval(async () => {
    try {
      const count = await processExpiredLocks();
      if (count > 0) {
        console.log(`[锁号过期清理] 已释放 ${count} 个过期锁号`);
      }
    } catch (error) {
      console.error('[锁号过期清理] 执行失败:', error.message);
    }
  }, intervalMs);

  console.log(`[锁号过期清理] 定时任务已启动，间隔 ${intervalMinutes} 分钟`);
  
  return timer;
}

export function stopLockExpiryScheduler() {
  if (timer) {
    clearInterval(timer);
    timer = null;
    console.log('[锁号过期清理] 定时任务已停止');
  }
}

export default {
  startLockExpiryScheduler,
  stopLockExpiryScheduler,
  processExpiredLocks
};
