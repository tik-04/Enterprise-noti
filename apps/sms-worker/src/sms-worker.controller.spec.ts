import { Test, TestingModule } from '@nestjs/testing';
import { SmsWorkerController } from './sms-worker.controller';
import { SmsWorkerService } from './sms-worker.service';

describe('SmsWorkerController', () => {
  let smsWorkerController: SmsWorkerController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [SmsWorkerController],
      providers: [SmsWorkerService],
    }).compile();

    smsWorkerController = app.get<SmsWorkerController>(SmsWorkerController);
  });

  describe('root', () => {
    it('should return "Hello World!"', () => {
      expect(smsWorkerController.getHello()).toBe('Hello World!');
    });
  });
});
