import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import Redis from 'ioredis';

@Injectable()
export class RedisIdempotencyService implements OnModuleInit, OnModuleDestroy {
  private client!: Redis;

  onModuleInit() {
    this.client = new Redis({ host: 'localhost', port: 6379 });
  }

  onModuleDestroy() {
    this.client.quit();
  }

  // คืน true ถ้า key นี้เคยใช้แล้ว (duplicate)
  async isDuplicate(key: string): Promise<boolean> {
    const existing = await this.client.get(`idem:${key}`);
    return existing !== null;
  }

  // ล็อค key พร้อม TTL 24 ชั่วโมง
  async lock(key: string, notificationId: string): Promise<void> {
    await this.client.set(`idem:${key}`, notificationId, 'EX', 86400);
  }

  async getNotificationId(key: string): Promise<string | null> {
    return this.client.get(`idem:${key}`);
  }
}