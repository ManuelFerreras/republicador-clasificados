import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule } from '@nestjs/config';
import { ScraperService } from './scraper.service';

@Module({
  imports: [HttpModule, ConfigModule],
  providers: [ScraperService],
  exports: [ScraperService],
})
export class ScraperModule {} 