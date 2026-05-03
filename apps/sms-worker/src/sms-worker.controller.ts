import { Controller, Logger } from '@nestjs/common';
import { Ctx, EventPattern, Payload, RmqContext } from '@nestjs/microservices';
import { SmsWorkerService } from './sms-worker.service';

@Controller()
export class SmsWorkerController {
  private readonly logger = new Logger(SmsWorkerController.name);

  constructor(private readonly smsWorkerService: SmsWorkerService) {}

  @EventPattern('notifications.sms')
  async handle(
    @Payload() payload: {
      notificationId: string;
      recipient: string;
      body: string;
    },
    @Ctx() context: RmqContext,
  ) {
    const channel = context.getChannelRef();
    const message = context.getMessage();

    const result = await this.smsWorkerService.process(payload);

    if (result === 'ack') {
      channel.ack(message);
    } else if (result === 'nack-requeue') {
      channel.nack(message, false, true);
    } else {
      channel.nack(message, false, false);
    }
  }
}