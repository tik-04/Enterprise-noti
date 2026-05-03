import {
  ConflictException,
  Inject,
  Injectable,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ClientProxy } from '@nestjs/microservices';
import { Repository } from 'typeorm';
import { NotificationEntity } from '@app/shared/entities/Notification.entity';
import { CreateNotificationDto } from '@app/shared/dto/notification.dto';
import { NotificationChannel } from '@app/shared/enum/Notification.enum';
import { RedisIdempotencyService } from './redis-idempotency.service';
import { Counter, Histogram, Gauge } from 'prom-client';

@Injectable()
export class ApiGatewayService {
  private readonly logger = new Logger(ApiGatewayService.name);

  constructor(
    @Inject('PROM_METRIC_NOTIFICATIONS_TOTAL')
    private readonly notificationsTotal: Counter<string>,

    @Inject('PROM_METRIC_NOTIFICATIONS_DELIVERY_DURATION_SECONDS')
    private readonly deliveryDuration: Histogram<string>,

    @Inject('PROM_METRIC_NOTIFICATIONS_QUEUE_DEPTH')
    private readonly queueDepth: Gauge<string>,

    @Inject('SMS_SERVICE')
    private readonly smsClient: ClientProxy,
    
    @InjectRepository(NotificationEntity)
    private readonly notificationRepo: Repository<NotificationEntity>,
    @Inject('NOTIFICATION_SERVICE')
    private readonly rmqClient: ClientProxy,
    private readonly idempotency: RedisIdempotencyService,
  ) {}

  async send(dto: CreateNotificationDto): Promise<{ notificationId: string; status: string }> {
    // 1. เช็ค idempotency
    if (await this.idempotency.isDuplicate(dto.idempotencyKey)) {
      const notificationId = await this.idempotency.getNotificationId(dto.idempotencyKey);
      this.logger.warn(`Duplicate request — idempotencyKey: ${dto.idempotencyKey}`);
      return { notificationId: notificationId!, status: 'already_accepted' };
    }

    const existing = await this.notificationRepo.findOne({
      where: { idempotencyKey: dto.idempotencyKey },
    });
    if (existing) {
      // sync กลับเข้า Redis ด้วย
      await this.idempotency.lock(dto.idempotencyKey, existing.id);
      return { notificationId: existing.id, status: 'already_accepted' };
    }

    // 2. INSERT DB สถานะ PENDING
    const notification = this.notificationRepo.create({
      idempotencyKey: dto.idempotencyKey,
      channel: dto.channel,
      recipient: dto.to,
      subject: dto.subject ?? null,
      body: dto.body,
    });
    const saved = await this.notificationRepo.save(notification);

    // 3. ล็อค idempotency key ใน Redis
    await this.idempotency.lock(dto.idempotencyKey, saved.id);

    // 4. Publish event ไป RabbitMQ
    let queue = '';
    if (dto.channel === NotificationChannel.EMAIL) {
      queue = 'notifications.email'
      this.rmqClient.emit(queue, {
        notificationId: saved.id,
        channel: saved.channel,
        recipient: saved.recipient,
        subject: saved.subject,
        body: saved.body,
      });
    } else {
      queue = 'notifications.sms'
      this.smsClient.emit(queue, {
        notificationId: saved.id,
        channel: saved.channel,
        recipient: saved.recipient,
        body: saved.body,
      });
    }

    this.queueDepth.inc({ queue: queue });

    this.logger.log(`Published notificationId: ${saved.id} → queue: ${queue}`);

    return { notificationId: saved.id, status: 'accepted' };
  }

  async getStatus(id: string) {
    const notification = await this.notificationRepo.findOne({ where: { id } });
    if (!notification) return null;

    return {
      id: notification.id,
      status: notification.status,
      channel: notification.channel,
      recipient: notification.recipient,
      attempts: notification.attempts,
      sentAt: notification.sentAt,
      createdAt: notification.createdAt,
    };
  }
}