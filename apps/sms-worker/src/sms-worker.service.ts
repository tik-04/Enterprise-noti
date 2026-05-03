import { Inject, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Counter, Gauge } from 'prom-client';
import { NotificationEntity } from '@app/shared/entities/Notification.entity';
import { NotificationStatus } from '@app/shared/enum/Notification.enum';
import { SmsService } from './sms-service';

const MAX_ATTEMPTS = 3;

@Injectable()
export class SmsWorkerService {
  private readonly logger = new Logger(SmsWorkerService.name);

  constructor(
    @Inject('PROM_METRIC_NOTIFICATIONS_TOTAL')
    private readonly notificationsTotal: Counter<string>,
    @Inject('PROM_METRIC_NOTIFICATIONS_QUEUE_DEPTH')
    private readonly queueDepth: Gauge<string>,
    @InjectRepository(NotificationEntity)
    private readonly notificationRepo: Repository<NotificationEntity>,
    private readonly smsService: SmsService,
  ) {}

  async process(payload: {
    notificationId: string;
    recipient: string;
    body: string;
  }): Promise<'ack' | 'nack-requeue' | 'nack-dead'> {
    const { notificationId, recipient, body } = payload;

    const notification = await this.notificationRepo.findOne({
      where: { id: notificationId },
    });

    if (!notification) {
      this.logger.warn(`Notification ${notificationId} not found — ACK and skip`);
      return 'ack';
    }

    try {
      await this.smsService.sendSms(recipient, body);

      await this.notificationRepo.update(notificationId, {
        status: NotificationStatus.SENT,
        sentAt: new Date(),
      });

      this.notificationsTotal.inc({ channel: 'sms', status: 'sent' });
      this.queueDepth.dec({ queue: 'notifications.sms' });
      this.logger.log(`Notification ${notificationId} → SENT`);
      return 'ack';

    } catch (error) {
      const attempts = notification.attempts + 1;
      this.logger.warn(`Notification ${notificationId} failed (attempt ${attempts})`);

      if (attempts >= MAX_ATTEMPTS) {
        await this.notificationRepo.update(notificationId, {
          status: NotificationStatus.DEAD,
          attempts,
          errorMessage: (error as Error).message,
        });
        this.notificationsTotal.inc({ channel: 'sms', status: 'failed' });
        this.queueDepth.dec({ queue: 'notifications.sms' });
        this.logger.error(`Notification ${notificationId} → DEAD`);
        return 'nack-dead';
      }

      await this.notificationRepo.update(notificationId, {
        status: NotificationStatus.RETRYING,
        attempts,
        errorMessage: (error as Error).message,
      });

      const delayMs = Math.pow(2, attempts) * 1000;
      await new Promise((r) => setTimeout(r, delayMs));
      return 'nack-requeue';
    }
  }
}