import { Injectable, Logger } from '@nestjs/common';
import { Twilio } from 'twilio';

@Injectable()
export class SmsService {
  private readonly logger = new Logger(SmsService.name);
  private client: Twilio;

  constructor() {
    this.client = new Twilio(
      process.env.TWILIO_ACCOUNT_SID ?? '',
      process.env.TWILIO_AUTH_TOKEN ?? '',
    );
  }

  async sendSms(to: string, body: string): Promise<void> {
    // TODO: Replace with Twilio when A2P registration approved
    this.logger.log(`[SMS] to: ${to} | body: ${body}`);
    // Simulate network delay
    await new Promise((r) => setTimeout(r, 200));
  }
}