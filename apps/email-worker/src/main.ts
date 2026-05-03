import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { EmailWorkerModule } from './email-worker.module';

async function bootstrap() {
  const app = await NestFactory.createMicroservice<MicroserviceOptions>(
    EmailWorkerModule,
    {
      transport: Transport.RMQ,
      options: {
        urls: ['amqp://rabbit:rabbit@localhost:5672'],
        queue: 'notifications.email',
        queueOptions: {
          durable: true,
          deadLetterExchange: 'notifications.dlx',
        },
        noAck: false, // ต้อง ACK เองทุกครั้ง
      },
    },
  );

    // HTTP server แยกสำหรับ /metrics เท่านั้น
  const httpApp = await NestFactory.create(EmailWorkerModule);
  await httpApp.listen(3002);
  
  await app.listen();
  console.log('Email Worker listening on notifications.email queue');
}
bootstrap();