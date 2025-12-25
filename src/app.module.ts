import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';

import { OcrsModule } from './ocrs/ocrs.module';

@Module({
  imports: [OcrsModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule { }
