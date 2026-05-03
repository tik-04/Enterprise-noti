import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { NotificationChannel, NotificationStatus } from '../enum/Notification.enum';

@Entity('notifications')
export class NotificationEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index({ unique: true })
  @Column({ name: 'idempotency_key', type: 'varchar', length: 255, unique: true })
  idempotencyKey!: string;

  @Column({ type: 'varchar', length: 20, enum: NotificationChannel })
  channel!: NotificationChannel;

  @Column({ type: 'varchar', length: 255 })
  recipient!: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  subject!: string | null;

  @Column({ type: 'text' })
  body!: string;

  @Index()
  @Column({
    type: 'varchar',
    length: 20,
    enum: NotificationStatus,
    default: NotificationStatus.PENDING,
  })
  status!: NotificationStatus;

  @Column({ type: 'int', default: 0 })
  attempts!: number;

  @Column({ name: 'error_message', type: 'text', nullable: true })
  errorMessage!: string | null;

  @Column({ name: 'sent_at', type: 'timestamptz', nullable: true })
  sentAt!: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}