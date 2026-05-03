import { Counter, Histogram, Gauge } from 'prom-client';

// จำนวน notification แยก channel และ status
export const notificationsTotal = new Counter({
  name: 'notifications_total',
  help: 'Total notifications processed',
  labelNames: ['channel', 'status'] as const,
});

// เวลาตั้งแต่รับ request จนส่งสำเร็จ
export const deliveryDuration = new Histogram({
  name: 'notifications_delivery_duration_seconds',
  help: 'Time from created to sent',
  buckets: [0.1, 0.5, 1, 5, 10, 30],
  labelNames: ['channel'] as const,
});

// จำนวน message ค้างใน queue
export const queueDepth = new Gauge({
  name: 'notifications_queue_depth',
  help: 'Current messages waiting in queue',
  labelNames: ['queue'] as const,
});