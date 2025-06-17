import { IsOptional, IsString, IsNumber, IsBoolean } from 'class-validator';

export class RepublishAllResponseDto {
  message: string;
  timestamp: string;
  processId: string;
  stats?: {
    totalPublishedAdsFound: number;
    requestsSent: number;
    totalAdsScanned?: number;
    unpublishedAdsSkipped?: number;
  };
}

export class RepublishStatusResponseDto {
  isRunning: boolean;
  lastRun?: string;
  nextScheduledRun?: string;
  totalAdsFound: number;
  adsRepublished: number;
  errors: number;
  processId?: string;
  totalAdsScanned?: number;
  unpublishedAdsSkipped?: number;
}

export class AdsListResponseDto {
  adIds: string[];
  totalCount: number;
  timestamp: string;
}

export class RepublishRequestDto {
  @IsOptional()
  @IsString()
  adId?: string;

  @IsOptional()
  @IsBoolean()
  forceRun?: boolean;
}
