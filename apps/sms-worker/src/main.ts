import { NestFactory } from '@nestjs/core';
import { SmsWorkerModule } from './sms-worker.module';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';

async function bootstrap() {
  const app = await NestFactory.createMicroservice<MicroserviceOptions>(
    SmsWorkerModule,
    {
      transport: Transport.RMQ,
      options: {
        urls: ['amqp://rabbit:rabbit@localhost:5672'],
        queue: 'notifications.sms',
        queueOptions: {
          durable: true,
          deadLetterExchange: 'notifications.dlx',
        },
        noAck: false, // ต้อง ACK เองทุกครั้ง
      },
    },
  );
  await app.listen();
  console.log('Sms Worker listening on notifications.sms queue');
}
bootstrap();