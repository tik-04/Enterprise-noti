import {
  Body,
  Controller,
  Get,
  HttpCode,
  NotFoundException,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { CreateNotificationDto } from '@app/shared/dto/notification.dto';
import { ApiGatewayService } from './api-gateway.service';

@Controller()
@UseGuards(ThrottlerGuard)
export class ApiGatewayController {
  constructor(private readonly apiGatewayService: ApiGatewayService) {}

  @Post('notifications')
  @HttpCode(202)
  async send(@Body() dto: CreateNotificationDto) {
    const result = await this.apiGatewayService.send(dto);

    return {
      notificationId: result.notificationId,
      status: result.status,
      message: result.status === 'already_accepted'
        ? 'Duplicate request — notification already queued'
        : 'Notification accepted and queued',
    };
  }

  @Get('notifications/:id/status')
  async getStatus(@Param('id') id: string) {
    const result = await this.apiGatewayService.getStatus(id);
    if (!result) throw new NotFoundException(`Notification ${id} not found`);
    return result;
  }
}