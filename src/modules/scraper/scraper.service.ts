import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import * as cheerio from 'cheerio';
import { AdScrapeResult } from '../../common/interfaces/ad.interface';

@Injectable()
export class ScraperService {
  private readonly logger = new Logger(ScraperService.name);

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {}

  async getAllAdIds(): Promise<string[]> {
    this.logger.log('Starting to scrape all ad IDs');

    const allAdIds: string[] = [];
    let totalScanned = 0;
    let totalPublished = 0;
    let totalUnpublishedSkipped = 0;

    // Start by trying to scrape multiple pages in parallel
    const maxConcurrentPages =
      this.configService.get('rateLimit.maxConcurrentRequests', 20) / 4; // Use 1/4 of concurrent limit for pages
    const pagesToTry = Math.min(5, maxConcurrentPages); // Try up to 5 pages initially

    try {
      // Scrape first few pages in parallel to see how many we actually have
      const initialPagePromises = [];
      for (let page = 1; page <= pagesToTry; page++) {
        initialPagePromises.push(this.scrapeAdsPage(page));
      }

      const initialResults = await Promise.allSettled(initialPagePromises);
      let lastValidPage = 0;

      // Process results and determine actual page count
      for (let i = 0; i < initialResults.length; i++) {
        const result = initialResults[i];
        if (result.status === 'fulfilled' && result.value.adIds.length > 0) {
          allAdIds.push(...result.value.adIds);
          totalScanned += result.value.totalAdsScanned || 0;
          totalPublished += result.value.publishedAdsFound || 0;
          totalUnpublishedSkipped += result.value.unpublishedAdsSkipped || 0;
          lastValidPage = i + 1;
        }
      }

      // If we found ads on the last page we tried, continue scraping more pages
      if (lastValidPage === pagesToTry) {
        let currentPage = pagesToTry + 1;
        let hasNextPage = true;

        while (hasNextPage) {
          try {
            this.logger.debug(`Scraping additional page ${currentPage}`);
            const result = await this.scrapeAdsPage(currentPage);

            if (result.adIds.length === 0) {
              hasNextPage = false;
            } else {
              allAdIds.push(...result.adIds);
              totalScanned += result.totalAdsScanned || 0;
              totalPublished += result.publishedAdsFound || 0;
              totalUnpublishedSkipped += result.unpublishedAdsSkipped || 0;
              currentPage++;

              // Small delay to avoid overwhelming the server
              await this.sleep(100);
            }
          } catch (error) {
            this.logger.error(
              `Error scraping page ${currentPage}:`,
              error.message,
            );
            break;
          }
        }
      }
    } catch (error) {
      this.logger.error(
        'Error in parallel scraping, falling back to sequential:',
        error.message,
      );
      // Fallback to sequential processing if parallel fails
      return this.getAllAdIdsSequential();
    }

    const uniqueAdIds = [...new Set(allAdIds)];
    this.logger.log(
      `Scraping completed: ${uniqueAdIds.length} unique published ads found` +
        ` (${totalScanned} total ads scanned, ${totalUnpublishedSkipped} unpublished ads skipped)`,
    );

    return uniqueAdIds;
  }

  private async getAllAdIdsSequential(): Promise<string[]> {
    this.logger.log('Using sequential scraping fallback');

    const allAdIds: string[] = [];
    let currentPage = 1;
    let hasNextPage = true;
    let totalScanned = 0;
    let totalPublished = 0;
    let totalUnpublishedSkipped = 0;

    while (hasNextPage) {
      try {
        const result = await this.scrapeAdsPage(currentPage);
        allAdIds.push(...result.adIds);

        totalScanned += result.totalAdsScanned || 0;
        totalPublished += result.publishedAdsFound || 0;
        totalUnpublishedSkipped += result.unpublishedAdsSkipped || 0;

        hasNextPage = result.hasNextPage && result.adIds.length > 0;
        currentPage++;

        if (hasNextPage) {
          await this.sleep(200); // Minimal delay
        }
      } catch (error) {
        this.logger.error(`Error scraping page ${currentPage}:`, error.message);
        break;
      }
    }

    return [...new Set(allAdIds)];
  }

  async scrapeAdsPage(page: number = 1): Promise<AdScrapeResult> {
    const baseUrl = this.configService.get('clasificados.baseUrl');
    const adminPath = this.configService.get('clasificados.adminPath');
    const cookies = this.configService.get('clasificados.cookies');
    const userAgent = this.configService.get('headers.userAgent');
    const acceptLanguage = this.configService.get('headers.acceptLanguage');

    const url = `${baseUrl}${adminPath}?page=${page}`;

    try {
      const response = await firstValueFrom(
        this.httpService.get(url, {
          headers: {
            accept:
              'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
            'accept-language': acceptLanguage,
            'cache-control': 'no-cache',
            cookie: cookies,
            pragma: 'no-cache',
            priority: 'u=0, i',
            referer: `${baseUrl}${adminPath}`,
            'sec-ch-ua':
              '"Google Chrome";v="137", "Chromium";v="137", "Not/A)Brand";v="24"',
            'sec-ch-ua-mobile': '?0',
            'sec-ch-ua-platform': '"macOS"',
            'sec-fetch-dest': 'document',
            'sec-fetch-mode': 'navigate',
            'sec-fetch-site': 'same-origin',
            'sec-fetch-user': '?1',
            'upgrade-insecure-requests': '1',
            'user-agent': userAgent,
          },
          timeout: 10000,
        }),
      );
      // if (response.status !== 200) {
      //   throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      // }

      return this.parseHtmlForAdIds(response.data, page);
    } catch (error) {
      this.logger.error(`Failed to scrape page ${page}:`, error.message);
      throw error;
    }
  }

  private parseHtmlForAdIds(html: string, currentPage: number): AdScrapeResult {
    const $ = cheerio.load(html);
    const adIds: string[] = [];
    let totalAdsScanned = 0;
    let publishedAdsFound = 0;
    let unpublishedAdsSkipped = 0;

    // Find all ad sections and check their status
    $('.item-aviso').each((_, adSection) => {
      const $adSection = $(adSection);

      // Try to find the ad ID from various sources within this section
      let adId: string | null = null;

      // Method 1: Look for elements with pattern id="itempub{adId}"
      const itemPubElement = $adSection.find('[id^="itempub"]').first();
      if (itemPubElement.length > 0) {
        const id = itemPubElement.attr('id');
        if (id) {
          const extractedId = id.replace('itempub', '');
          if (extractedId && /^\d+$/.test(extractedId)) {
            adId = extractedId;
          }
        }
      }

      // Method 2: Look for checkbox inputs with name="nids[]"
      if (!adId) {
        const checkboxElement = $adSection.find('input[name="nids[]"]').first();
        if (checkboxElement.length > 0) {
          const value = checkboxElement.attr('value');
          if (value && /^\d+$/.test(value)) {
            adId = value;
          }
        }
      }

      // Method 3: Look for tab-label divs with numeric IDs
      if (!adId) {
        const tabLabelElement = $adSection.find('.tab-label[id]').first();
        if (tabLabelElement.length > 0) {
          const id = tabLabelElement.attr('id');
          if (id && /^\d+$/.test(id)) {
            adId = id;
          }
        }
      }

      // Method 4: Look for "N° Aviso:" text and extract the ID
      if (!adId) {
        $adSection.find('h4').each((_, h4Element) => {
          const text = $(h4Element).text().trim();
          if (text.includes('N° Aviso:') || /^\d+$/.test(text)) {
            if (/^\d+$/.test(text)) {
              adId = text;
              return false; // Break the loop
            }
            // Check the next sibling
            const nextSibling = $(h4Element).next('h4');
            if (nextSibling.length > 0) {
              const siblingText = nextSibling.text().trim();
              if (/^\d+$/.test(siblingText)) {
                adId = siblingText;
                return false; // Break the loop
              }
            }
          }
        });
      }

      // If we found an ad ID, check its status
      if (adId) {
        totalAdsScanned++;

        // Look for the status within this ad section
        // Status is in format: <small class="m0 bold">Estado:</small><small class="m0 px1">Publicado</small>
        let isPublished = false;

        $adSection.find('small:contains("Estado:")').each((_, statusLabel) => {
          // Find the next small element that should contain the status value
          const statusValue = $(statusLabel).next('small').text().trim();
          if (statusValue === 'Publicado') {
            isPublished = true;
            return false; // Break the loop
          }
        });

        // Alternative method: look for the status in a more flexible way
        if (!isPublished) {
          $adSection.find('small').each((_, smallElement) => {
            const text = $(smallElement).text().trim();
            if (text === 'Publicado') {
              // Check if the previous sibling contains "Estado:"
              const prevSibling = $(smallElement).prev('small');
              if (
                prevSibling.length > 0 &&
                prevSibling.text().trim() === 'Estado:'
              ) {
                isPublished = true;
                return false; // Break the loop
              }
            }
          });
        }

        // Only add the ad ID if it's published
        if (isPublished) {
          adIds.push(adId);
          publishedAdsFound++;
          this.logger.debug(`Found published ad: ${adId}`);
        } else {
          unpublishedAdsSkipped++;
          this.logger.debug(`Skipping ad ${adId} - not published`);
        }
      }
    });

    // Fallback: if no ads found with the new method, try the old method for backward compatibility
    if (adIds.length === 0) {
      this.logger.debug(
        'No ads found with new method, trying fallback approach',
      );

      // Original method as fallback
      $('[id^="itempub"]').each((_, element) => {
        const id = $(element).attr('id');
        if (id) {
          const adId = id.replace('itempub', '');
          if (adId && /^\d+$/.test(adId)) {
            adIds.push(adId);
          }
        }
      });

      $('input[name="nids[]"]').each((_, element) => {
        const value = $(element).attr('value');
        if (value && /^\d+$/.test(value)) {
          adIds.push(value);
        }
      });

      $('.tab-label[id]').each((_, element) => {
        const id = $(element).attr('id');
        if (id && /^\d+$/.test(id)) {
          adIds.push(id);
        }
      });
    }

    // Check if there's a next page by looking for pagination or checking if we got any results
    const hasNextPage = adIds.length > 0 && adIds.length >= 10; // Assuming pagination shows ~10+ items per page

    // Alternative: look for pagination links or "next" buttons
    const nextPageExists =
      $('a[href*="page="]').length > 0 ||
      $('.pagination').length > 0 ||
      $('[href*="page=' + (currentPage + 1) + '"]').length > 0;

    this.logger.debug(
      `Page ${currentPage}: Found ${adIds.length} published ad IDs (${totalAdsScanned} total scanned, ${unpublishedAdsSkipped} unpublished skipped)`,
    );

    return {
      adIds: [...new Set(adIds)], // Remove duplicates
      totalPages: 0, // We'll calculate this dynamically
      currentPage,
      hasNextPage: hasNextPage || nextPageExists,
      totalAdsScanned,
      publishedAdsFound,
      unpublishedAdsSkipped,
    };
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
