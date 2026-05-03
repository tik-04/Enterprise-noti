import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import { NotificationChannel } from '../enum/Notification.enum';

export class CreateNotificationDto {
  @IsEnum(NotificationChannel, {
    message: 'channel must be email or sms',
  })
  channel!: NotificationChannel;

  @IsNotEmpty()
  @IsString()
  @MaxLength(255)
  to!: string;

  // subject บังคับเฉพาะ email channel
  @ValidateIf((o) => o.channel === NotificationChannel.EMAIL)
  @IsNotEmpty()
  @IsString()
  @MaxLength(500)
  subject?: string;

  @IsNotEmpty()
  @IsString()
  body!: string;

  @IsUUID('4', { message: 'idempotencyKey must be a valid UUID v4' })
  idempotencyKey!: string;
}