import { Injectable, Logger } from '@nestjs/common';
import { ScraperService } from '../scraper/scraper.service';

@Injectable()
export class AdsService {
  private readonly logger = new Logger(AdsService.name);

  constructor(private readonly scraperService: ScraperService) {}

  async getAllAdIds(): Promise<string[]> {
    this.logger.log('Fetching all ad IDs');
    
    try {
      const adIds = await this.scraperService.getAllAdIds();
      this.logger.log(`Retrieved ${adIds.length} ad IDs`);
      return adIds;
    } catch (error) {
      this.logger.error('Failed to fetch ad IDs:', error.message);
      throw error;
    }
  }

  async getAdsCount(): Promise<number> {
    const adIds = await this.getAllAdIds();
    return adIds.length;
  }
} 