export interface Ad {
  id: string;
  title: string;
  price?: string;
  status: string;
  createdAt: string;
  publishedAt: string;
  expiresAt: string;
  visits: number;
  interactions: number;
  interested: number;
  isPremium: boolean;
}

export interface AdScrapeResult {
  adIds: string[];
  totalPages: number;
  currentPage: number;
  hasNextPage: boolean;
  totalAdsScanned?: number;
  publishedAdsFound?: number;
  unpublishedAdsSkipped?: number;
}

export interface RepublishResult {
  adId: string;
  success: boolean;
  error?: string;
  timestamp: Date;
}

export interface RepublishStatus {
  isRunning: boolean;
  lastRun?: Date;
  nextScheduledRun?: Date;
  totalAdsFound: number;
  adsRepublished: number;
  errors: number;
  processId?: string;
  totalAdsScanned?: number;
  unpublishedAdsSkipped?: number;
}
