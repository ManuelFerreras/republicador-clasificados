import {
  Controller,
  Post,
  Get,
  Body,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { RepublishService } from './republish.service';
import {
  RepublishAllResponseDto,
  RepublishStatusResponseDto,
  RepublishRequestDto,
  RepublishByIdsRequestDto,
  RepublishByIdsResponseDto,
} from '../../common/dto/republish.dto';

@Controller('republish')
export class RepublishController {
  private readonly logger = new Logger(RepublishController.name);

  constructor(private readonly republishService: RepublishService) {}

  @Post('all')
  async republishAll(
    @Body() body: RepublishRequestDto = {},
  ): Promise<RepublishAllResponseDto> {
    try {
      this.logger.log('Manual republish all triggered');

      const result = await this.republishService.republishAllAds(body.forceRun);

      return {
        message: 'Republishing process completed',
        timestamp: new Date().toISOString(),
        processId: result.processId,
        stats: result.stats,
      };
    } catch (error) {
      this.logger.error('Failed to start republish process:', error.message);

      if (error.message.includes('already running')) {
        throw new HttpException(
          'Republishing process is already running',
          HttpStatus.CONFLICT,
        );
      }

      throw new HttpException(
        'Failed to start republishing process',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('specific')
  async republishSpecific(
    @Body() body: RepublishByIdsRequestDto,
  ): Promise<RepublishByIdsResponseDto> {
    try {
      this.logger.log(
        `Manual republish specific ads triggered for ${body.adIds.length} ads`,
      );

      const result = await this.republishService.republishSpecificAds(
        body.adIds,
        body.forceRun,
      );

      return {
        message: `Republishing process completed for ${body.adIds.length} specific ads`,
        timestamp: new Date().toISOString(),
        processId: result.processId,
        stats: result.stats,
      };
    } catch (error) {
      this.logger.error(
        'Failed to start specific ads republish process:',
        error.message,
      );

      if (error.message.includes('already running')) {
        throw new HttpException(
          'Republishing process is already running',
          HttpStatus.CONFLICT,
        );
      }

      throw new HttpException(
        'Failed to start specific ads republishing process',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('status')
  async getStatus(): Promise<RepublishStatusResponseDto> {
    try {
      const status = this.republishService.getStatus();

      return {
        isRunning: status.isRunning,
        lastRun: status.lastRun?.toISOString(),
        nextScheduledRun: status.nextScheduledRun?.toISOString(),
        totalAdsFound: status.totalAdsFound,
        adsRepublished: status.adsRepublished,
        errors: status.errors,
        processId: status.processId,
        totalAdsScanned: status.totalAdsScanned,
        unpublishedAdsSkipped: status.unpublishedAdsSkipped,
      };
    } catch (error) {
      this.logger.error('Failed to get republish status:', error.message);
      throw new HttpException(
        'Failed to get republish status',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
