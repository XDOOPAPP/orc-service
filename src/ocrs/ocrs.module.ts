import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { OcrsService } from './ocrs.service';
import { OcrsController } from './ocrs.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { OcrWorkerService } from './ocr-worker.service';

@Module({
  imports: [
    PrismaModule,
    ClientsModule.register([
      {
        name: 'RABBITMQ_CLIENT',
        transport: Transport.RMQ,
        options: {
          urls: [process.env.RABBITMQ_URL || 'amqp://fepa:fepa123@localhost:5672'],
          queue: 'ocr_events',
          queueOptions: {
            durable: true,
          },
        },
      },
    ]),
  ],
  controllers: [OcrsController],
  providers: [OcrsService, OcrWorkerService],
})
export class OcrsModule { }
