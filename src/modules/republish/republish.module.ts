import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { RepublishController } from './republish.controller';
import { RepublishService } from './republish.service';
import { ScraperModule } from '../scraper/scraper.module';

@Module({
  imports: [ConfigModule, ScheduleModule.forRoot(), ScraperModule],
  controllers: [RepublishController],
  providers: [RepublishService],
  exports: [RepublishService],
})
export class RepublishModule {}
