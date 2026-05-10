import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NotificationEntity } from '@app/shared/entities/Notification.entity';
import { EmailWorkerController } from './email-worker.controller';
import { EmailWorkerService } from './email-worker.service';
import { MailService } from './mail.service';
import { ConfigModule } from '@nestjs/config';
import { makeCounterProvider, makeGaugeProvider, makeHistogramProvider, PrometheusModule } from '@willsoto/nestjs-prometheus';

@Module({
  imports: [
    ConfigModule.forRoot(),
    PrometheusModule.register({
      path: '/metrics',
      defaultMetrics: { enabled: true },
    }),
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DB_HOST ?? 'localhost',
      port: +(process.env.DB_PORT ?? 5432),
      username: process.env.POSTGRES_USER,
      password: process.env.POSTGRES_PASSWORD,
      database: process.env.POSTGRES_DB,
      entities: [NotificationEntity],
      synchronize: false,
    }),
    TypeOrmModule.forFeature([NotificationEntity]),
  ],
  controllers: [EmailWorkerController],
  providers: [
    makeCounterProvider({
      name: 'notifications_total',
      help: 'Total notifications processed',
      labelNames: ['channel', 'status'],
    }),
    makeHistogramProvider({
      name: 'notifications_delivery_duration_seconds',
      help: 'Time from created to sent',
      buckets: [0.1, 0.5, 1, 5, 10, 30],
      labelNames: ['channel'],
    }),
    makeGaugeProvider({
      name: 'notifications_queue_depth',
      help: 'Current messages waiting in queue',
      labelNames: ['queue'],
    }),
    EmailWorkerService, MailService],
})
export class EmailWorkerModule {}