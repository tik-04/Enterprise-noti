import { Inject, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotificationEntity } from '@app/shared/entities/Notification.entity';
import { NotificationStatus } from '@app/shared/enum/Notification.enum';
import { MailService } from './mail.service';
import { Counter, Gauge, Histogram } from 'prom-client';

const MAX_ATTEMPTS = 3;

@Injectable()
export class EmailWorkerService {
  private readonly logger = new Logger(EmailWorkerService.name);

  constructor(
    @Inject('PROM_METRIC_NOTIFICATIONS_QUEUE_DEPTH')
    private readonly queueDepth: Gauge<string>,

    @Inject('PROM_METRIC_NOTIFICATIONS_TOTAL')
    private readonly notificationsTotal: Counter<string>,

    @Inject('PROM_METRIC_NOTIFICATIONS_DELIVERY_DURATION_SECONDS')
    private readonly deliveryDuration: Histogram<string>,
    
    @InjectRepository(NotificationEntity)
    private readonly notificationRepo: Repository<NotificationEntity>,
    private readonly mailService: MailService,
  ) {}

  async process(payload: {
    notificationId: string;
    recipient: string;
    subject: string | null;
    body: string;
  }): Promise<'ack' | 'nack-requeue' | 'nack-dead'> {
    const { notificationId, recipient, subject, body } = payload;

    // โหลด notification จาก DB
    const notification = await this.notificationRepo.findOne({
      where: { id: notificationId },
    });

    if (!notification) {
      this.logger.warn(`Notification ${notificationId} not found — ACK and skip`);
      return 'ack';
    }

    try {
      // ส่ง email จริง
      await this.mailService.sendEmail(recipient, subject ?? '(no subject)', body);

      // สำเร็จ — UPDATE SENT
      await this.notificationRepo.update(notificationId, {
        status: NotificationStatus.SENT,
        sentAt: new Date(),
      });

      const duration = (Date.now() - notification.createdAt.getTime()) / 1000;
      this.deliveryDuration.observe({ channel: 'email' }, duration);
      this.notificationsTotal.inc({ channel: 'email', status: 'sent' });

      this.queueDepth.dec({ queue: 'notifications.email' });

      this.logger.log(`Notification ${notificationId} → SENT`);
      return 'ack';

    } catch (error) {
      const attempts = notification.attempts + 1;
      this.logger.warn(`Notification ${notificationId} failed (attempt ${attempts})`);

      if (attempts >= MAX_ATTEMPTS) {
        // หมด retry → DEAD
        await this.notificationRepo.update(notificationId, {
          status: NotificationStatus.DEAD,
          attempts,
          errorMessage: (error as Error).message,
        });
        this.logger.error(`Notification ${notificationId} → DEAD`);
        this.notificationsTotal.inc({ channel: 'email', status: 'failed' });
        this.queueDepth.dec({ queue: 'notifications.email' });
        return 'nack-dead';
        
      }

      // ยัง retry ได้ → RETRYING
      await this.notificationRepo.update(notificationId, {
        status: NotificationStatus.RETRYING,
        attempts,
        errorMessage: (error as Error).message,
      });

      // Exponential backoff delay ก่อน requeue
      const delayMs = Math.pow(2, attempts) * 1000; // 2s, 4s, 8s
      await new Promise((r) => setTimeout(r, delayMs));

      return 'nack-requeue';
    }
  }
}