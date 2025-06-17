import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { WinstonModule } from 'nest-winston';
import * as winston from 'winston';
import configuration from './config/configuration';
import { AppController } from './app.controller';
import { AdsModule } from './modules/ads/ads.module';
import { RepublishModule } from './modules/republish/republish.module';
import { ScraperModule } from './modules/scraper/scraper.module';

@Module({
  imports: [
    // Configuration
    ConfigModule.forRoot({
      load: [configuration],
      isGlobal: true,
      cache: true,
    }),

    // Scheduling
    ScheduleModule.forRoot(),

    // Logging
    WinstonModule.forRootAsync({
      useFactory: () => ({
        level: process.env.LOG_LEVEL || 'info',
        format: winston.format.combine(
          winston.format.timestamp(),
          winston.format.errors({ stack: true }),
          winston.format.json(),
        ),
        defaultMeta: { service: 'republicador-clasificados' },
        transports: [
          // Console transport
          new winston.transports.Console({
            format: winston.format.combine(
              winston.format.colorize(),
              winston.format.simple(),
            ),
          }),
          // File transport
          new winston.transports.File({
            filename: process.env.LOG_FILE_PATH || './logs/app.log',
            format: winston.format.combine(
              winston.format.timestamp(),
              winston.format.json(),
            ),
          }),
        ],
      }),
    }),

    // Feature modules
    ScraperModule,
    AdsModule,
    RepublishModule,
  ],
  controllers: [AppController],
})
export class AppModule {} 