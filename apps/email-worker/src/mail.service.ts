import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private transporter: nodemailer.Transporter;

  constructor() {
    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST ?? 'sandbox.smtp.mailtrap.io',
      port: Number(process.env.SMTP_PORT ?? 2525),
      auth: {
        user: process.env.SMTP_USER ?? '',
        pass: process.env.SMTP_PASS ?? '',
      },
    });
  }

  async sendEmail(to: string, subject: string, html: string): Promise<void> {
    await this.transporter.sendMail({
      from: '"Notification Gateway" <noreply@company.com>',
      to,
      subject,
      html,
    });
    this.logger.log(`Email sent to ${to}`);
  }
}