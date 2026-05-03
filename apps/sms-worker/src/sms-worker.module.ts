import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PrometheusModule } from '@willsoto/nestjs-prometheus';
import { makeCounterProvider, makeGaugeProvider } from '@willsoto/nestjs-prometheus';
import { NotificationEntity } from '@app/shared/entities/Notification.entity';
import { SmsWorkerController } from './sms-worker.controller';
import { SmsWorkerService } from './sms-worker.service';
import { SmsService } from './sms-service';

@Module({
  imports: [
    ConfigModule.forRoot(),
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DB_HOST ?? 'localhost',
      port: 5432,
      username: process.env.POSTGRES_USER,
      password: process.env.POSTGRES_PASSWORD,
      database: process.env.POSTGRES_DB,
      entities: [NotificationEntity],
      synchronize: false,
    }),
    TypeOrmModule.forFeature([NotificationEntity]),
    PrometheusModule.register({
      path: '/metrics',
      defaultMetrics: { enabled: true },
    }),
  ],
  controllers: [SmsWorkerController],
  providers: [
    makeCounterProvider({
      name: 'notifications_total',
      help: 'Total notifications processed',
      labelNames: ['channel', 'status'],
    }),
    makeGaugeProvider({
      name: 'notifications_queue_depth',
      help: 'Current messages waiting in queue',
      labelNames: ['queue'],
    }),
    SmsWorkerService,
    SmsService,
  ],
})
export class SmsWorkerModule {}