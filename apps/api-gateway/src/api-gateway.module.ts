import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { ThrottlerModule } from '@nestjs/throttler';
import { NotificationEntity } from '@app/shared/entities/Notification.entity';
import { ApiGatewayController } from './api-gateway.controller';
import { ApiGatewayService } from './api-gateway.service';
import { RedisIdempotencyService } from './redis-idempotency.service';
import { ThrottlerStorageRedisService } from '@nest-lab/throttler-storage-redis';
import Redis from 'ioredis';
import { makeCounterProvider, makeGaugeProvider, makeHistogramProvider, PrometheusModule } from '@willsoto/nestjs-prometheus';
import { ConfigModule, ConfigService } from '@nestjs/config';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    // PostgreSQL
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DB_HOST ?? 'localhost',
      port: +(process.env.DB_PORT ?? 5432),
      username: process.env.POSTGRES_USER,
      password: process.env.POSTGRES_PASSWORD,
      database: process.env.POSTGRES_DB,
      entities: [NotificationEntity],
      synchronize: false,
      migrations: ['dist/migrations/*.js'],
      migrationsRun: false, 
    }),
    TypeOrmModule.forFeature([NotificationEntity]),

    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        throttlers: [{ ttl: 60000, limit: 100 }],
        storage: new ThrottlerStorageRedisService(
          new Redis({
            host: config.get('REDIS_HOST', 'localhost'),
            port: config.get<number>('REDIS_PORT', 6379),
          })
        ),
      }),
      inject: [ConfigService],
    }),

    // RabbitMQ Publisher
    ClientsModule.register([
      {
        name: 'NOTIFICATION_SERVICE',
        transport: Transport.RMQ,
        options: {
          urls: [process.env.RABBITMQ_URL ?? 'amqp://rabbit:rabbit@localhost:5672'],
          queue: 'notifications.email',
          queueOptions: { 
            durable: true,
            arguments: {
              'x-dead-letter-exchange': 'notifications.dlx', // เพิ่มตรงนี้
            }, },
        },
      },
      {
        name: 'SMS_SERVICE',
        transport: Transport.RMQ,
        options: {
          urls: [process.env.RABBITMQ_URL ?? 'amqp://rabbit:rabbit@localhost:5672'] ,
          queue: 'notifications.sms',
          queueOptions: {
            durable: true,
            arguments: { 'x-dead-letter-exchange': 'notifications.dlx' },
          },
        },
      },
    ]),
    PrometheusModule.register({
      path: '/metrics',
      defaultMetrics: { enabled: true }, // CPU, memory, event loop ฟรีเลย
    }),
  ],
  controllers: [ApiGatewayController],
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
    ApiGatewayService, 
    RedisIdempotencyService],
})
export class ApiGatewayModule {}