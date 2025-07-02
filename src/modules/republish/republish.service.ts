import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { v4 as uuidv4 } from 'uuid';
import { ScraperService } from '../scraper/scraper.service';
import {
  RepublishResult,
  RepublishStatus,
} from '../../common/interfaces/ad.interface';

@Injectable()
export class RepublishService {
  private readonly logger = new Logger(RepublishService.name);
  private isRunning = false;
  private lastRun?: Date;
  private totalAdsFound = 0;
  private adsRepublished = 0;
  private errors = 0;
  private currentProcessId?: string;
  private totalAdsScanned = 0;
  private unpublishedAdsSkipped = 0;

  constructor(
    private readonly configService: ConfigService,
    private readonly scraperService: ScraperService,
  ) {}

  @Cron(CronExpression.EVERY_30_MINUTES) // This will be overridden by configuration
  async handleCronRepublish() {
    const cronSchedule = this.configService.get('cron.schedule');
    this.logger.log(`Cron job triggered with schedule: ${cronSchedule}`);
    await this.republishAllAds();
  }

  async republishAllAds(
    forceRun = false,
  ): Promise<{ processId: string; stats: any }> {
    if (this.isRunning && !forceRun) {
      throw new Error('Republishing process is already running');
    }

    const processId = uuidv4();
    this.currentProcessId = processId;
    this.isRunning = true;
    this.errors = 0;
    this.adsRepublished = 0;
    this.totalAdsScanned = 0;
    this.unpublishedAdsSkipped = 0;

    try {
      this.logger.log(`Starting republish process [${processId}]`);

      // Step 1: Get all ad IDs (only published ones)
      // Note: the scraper already filters for published ads and tracks statistics
      const adIds = await this.scraperService.getAllAdIds();
      this.totalAdsFound = adIds.length;

      // The scraper has already done the filtering, so these numbers represent
      // the actual scanning that happened during the process
      this.logger.log(
        `Scraper found ${adIds.length} published ads ready for republishing`,
      );

      if (adIds.length === 0) {
        this.logger.warn('No published ads found to republish');
        return {
          processId,
          stats: {
            totalPublishedAdsFound: 0,
            requestsSent: 0,
            totalAdsScanned: this.totalAdsScanned,
            unpublishedAdsSkipped: this.unpublishedAdsSkipped,
          },
        };
      }

      this.logger.log(`Found ${adIds.length} published ads to republish`);

      // Step 2: Republish all ads in parallel
      const results = await this.republishAdsInParallel(adIds);

      // Step 3: Process results - all requests are considered successful
      const successful = results.length;
      const failed = 0;

      this.adsRepublished = successful;
      this.errors = failed;
      this.lastRun = new Date();

      this.logger.log(
        `Republish process completed [${processId}]: ${successful} requests sent`,
      );

      return {
        processId,
        stats: {
          totalPublishedAdsFound: adIds.length,
          requestsSent: successful,
          totalAdsScanned: this.totalAdsScanned,
          unpublishedAdsSkipped: this.unpublishedAdsSkipped,
        },
      };
    } catch (error) {
      this.logger.error(
        `Republish process failed [${processId}]:`,
        error.message,
      );
      throw error;
    } finally {
      this.isRunning = false;
      this.currentProcessId = undefined;
    }
  }

  private async republishAdsInParallel(
    adIds: string[],
  ): Promise<RepublishResult[]> {
    const maxConcurrent = this.configService.get(
      'rateLimit.maxConcurrentRequests',
      5,
    );
    const results: RepublishResult[] = [];

    // Process ads in chunks to respect rate limiting
    for (let i = 0; i < adIds.length; i += maxConcurrent) {
      const chunk = adIds.slice(i, i + maxConcurrent);

      this.logger.debug(
        `Processing chunk ${Math.floor(i / maxConcurrent) + 1}: ${chunk.length} ads`,
      );

      const chunkPromises = chunk.map((adId) => this.republishSingleAd(adId));
      const chunkResults = await Promise.allSettled(chunkPromises);

      // Convert PromiseSettledResult to RepublishResult - all are considered successful
      const processedResults: RepublishResult[] = chunkResults.map(
        (result, index) => {
          const adId = chunk[index];
          // Always return success since we only care about making the request
          return {
            adId,
            success: true,
            timestamp: new Date(),
          };
        },
      );

      results.push(...processedResults);

      // Add minimal delay between chunks
      if (i + maxConcurrent < adIds.length) {
        const delay = this.configService.get('rateLimit.requestDelayMs', 300);
        await this.sleep(delay);
      }
    }

    return results;
  }

  private async republishSingleAd(adId: string): Promise<RepublishResult> {
    try {
      await this.makeRepublishRequest(adId);

      return {
        adId,
        success: true,
        timestamp: new Date(),
      };
    } catch (error) {
      this.logger.debug(
        `Request for ad ${adId} completed with status: ${error.message || 'unknown'}`,
      );

      // Always return success since we only care about making the request
      return {
        adId,
        success: true,
        timestamp: new Date(),
      };
    }
  }

  private async makeRepublishRequest(adId: string): Promise<void> {
    const baseUrl = this.configService.get('clasificados.baseUrl');
    const adminPath = this.configService.get('clasificados.adminPath');
    const republishPath = this.configService.get('clasificados.republishPath');
    const cookies = this.configService.get('clasificados.cookies');
    const userAgent = this.configService.get('headers.userAgent');
    const acceptLanguage = this.configService.get('headers.acceptLanguage');

    const url = `${baseUrl}${adminPath}${republishPath}/${adId}`;

    try {
      // Use AbortController for timeout control
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout

      const response = await fetch(url, {
        method: 'GET',
        signal: controller.signal,
        headers: {
          accept:
            'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'accept-language': acceptLanguage,
          cookie: cookies,
          referer: `${baseUrl}${adminPath}`,
          'user-agent': userAgent,
        },
      });

      clearTimeout(timeoutId);

      this.logger.debug(
        `Request sent for ad ${adId} - Status: ${response.status}`,
      );
    } catch (error) {
      this.logger.debug(`Request completed for ad ${adId}:`, error.message);
      // Don't throw error, just log and continue
    }
  }

  getStatus(): RepublishStatus {
    return {
      isRunning: this.isRunning,
      lastRun: this.lastRun,
      nextScheduledRun: this.getNextScheduledRun(),
      totalAdsFound: this.totalAdsFound,
      adsRepublished: this.adsRepublished,
      errors: this.errors,
      processId: this.currentProcessId,
      totalAdsScanned: this.totalAdsScanned,
      unpublishedAdsSkipped: this.unpublishedAdsSkipped,
    };
  }

  private getNextScheduledRun(): Date | undefined {
    // This is a simplified calculation - in a real implementation,
    // you might want to use a proper cron parser
    if (!this.lastRun) {
      return undefined;
    }

    const schedule = this.configService.get('cron.schedule', '0 0 */25 * * *');

    // For the default schedule "0 0 */25 * * *" (every 25 hours)
    // Add 25 hours to the last run
    if (schedule.includes('*/25')) {
      return new Date(this.lastRun.getTime() + 25 * 60 * 60 * 1000);
    }

    // For other schedules, add 24 hours as fallback
    return new Date(this.lastRun.getTime() + 24 * 60 * 60 * 1000);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
