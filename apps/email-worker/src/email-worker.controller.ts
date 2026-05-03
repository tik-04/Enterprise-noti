import { Controller, Logger } from '@nestjs/common';
import { Ctx, EventPattern, Payload, RmqContext } from '@nestjs/microservices';
import { EmailWorkerService } from './email-worker.service';

@Controller()
export class EmailWorkerController {
  private readonly logger = new Logger(EmailWorkerController.name);

  constructor(private readonly emailWorkerService: EmailWorkerService) {}

  @EventPattern('notifications.email')
  async handle(
    @Payload() payload: {
      notificationId: string;
      recipient: string;
      subject: string | null;
      body: string;
    },
    @Ctx() context: RmqContext,
  ) {
    const channel = context.getChannelRef();
    const message = context.getMessage();

    const result = await this.emailWorkerService.process(payload);

    if (result === 'ack') {
      channel.ack(message);
    } else if (result === 'nack-requeue') {
      channel.nack(message, false, true);  // requeue = true
    } else {
      channel.nack(message, false, false); // requeue = false → DLQ
    }
  }
}