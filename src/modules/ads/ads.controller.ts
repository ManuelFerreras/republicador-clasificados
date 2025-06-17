import { Controller, Get, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { AdsService } from './ads.service';
import { AdsListResponseDto } from '../../common/dto/republish.dto';

@Controller('ads')
export class AdsController {
  private readonly logger = new Logger(AdsController.name);

  constructor(private readonly adsService: AdsService) {}

  @Get('list')
  async getAdsList(): Promise<AdsListResponseDto> {
    try {
      this.logger.log('Fetching ads list');
      
      const adIds = await this.adsService.getAllAdIds();
      
      return {
        adIds,
        totalCount: adIds.length,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error('Failed to fetch ads list:', error.message);
      throw new HttpException(
        'Failed to fetch ads list',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('count')
  async getAdsCount(): Promise<{ count: number; timestamp: string }> {
    try {
      this.logger.log('Fetching ads count');
      
      const count = await this.adsService.getAdsCount();
      
      return {
        count,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error('Failed to fetch ads count:', error.message);
      throw new HttpException(
        'Failed to fetch ads count',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
} 