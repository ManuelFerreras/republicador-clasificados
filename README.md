# Republicador Clasificados

A NestJS backend service that automatically republishes ads on [clasificados.lavoz.com.ar](https://clasificados.lavoz.com.ar) every 25 hours to keep them visible.

## Features

- 🔄 **Automatic Republishing**: Cron job runs every 25 hours to republish all your ads
- 🚀 **Parallel Processing**: All republish requests are executed simultaneously for maximum efficiency
- 📊 **Manual Triggers**: REST API endpoints to manually trigger republishing operations
- 🔍 **HTML Scraping**: Automatically extracts ad IDs from paginated HTML responses
- 🛡️ **Error Handling**: Comprehensive retry logic and error handling
- 📝 **Logging**: Detailed logging with Winston for monitoring and debugging
- ⚙️ **Configurable**: Environment-based configuration for different deployments

## Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd republicador-clasificados
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment variables**
   ```bash
   cp env.example .env
   ```
   
   Edit `.env` with your configuration:
   - Copy your browser cookies from clasificados.lavoz.com.ar
   - Set your preferred cron schedule
   - Configure logging and rate limiting options

4. **Start the application**
   ```bash
   # Development
   npm run start:dev
   
   # Production
   npm run build
   npm run start:prod
   ```

## Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | `3000` |
| `NODE_ENV` | Environment mode | `development` |
| `CRON_SCHEDULE` | Cron expression for automatic republishing | `0 0 */25 * * *` |
| `CRON_TIMEZONE` | Timezone for cron jobs | `America/Argentina/Cordoba` |
| `CLASIFICADOS_BASE_URL` | Base URL for clasificados | `https://clasificados.lavoz.com.ar` |
| `CLASIFICADOS_COOKIES` | Authentication cookies from browser | Required |
| `MAX_CONCURRENT_REQUESTS` | Max parallel requests | `5` |
| `REQUEST_DELAY_MS` | Delay between requests | `1000` |
| `MAX_RETRIES` | Retry attempts for failed requests | `3` |

### Getting Authentication Cookies

1. Open your browser and go to [clasificados.lavoz.com.ar](https://clasificados.lavoz.com.ar)
2. Log in to your account
3. Open Developer Tools (F12)
4. Go to the Network tab
5. Navigate to your ads page (`/admin/avisos`)
6. Find the request to `/admin/avisos` in the Network tab
7. Copy the entire `Cookie` header value
8. Paste it in your `.env` file as `CLASIFICADOS_COOKIES`

## API Endpoints

### Manual Republishing

#### Republish All Ads
```bash
POST /republish/all
```

Triggers immediate republishing of all user ads.

**Response:**
```json
{
  "message": "Republishing process started",
  "timestamp": "2025-01-17T10:30:00.000Z",
  "processId": "uuid-string"
}
```

#### Get Republishing Status
```bash
GET /republish/status
```

Returns the current status of republishing operations.

**Response:**
```json
{
  "isRunning": true,
  "lastRun": "2025-01-17T10:30:00.000Z",
  "nextScheduledRun": "2025-01-18T11:30:00.000Z",
  "totalAdsFound": 25,
  "adsRepublished": 23,
  "errors": 2
}
```

#### Get All Ad IDs
```bash
GET /ads/list
```

Returns all ad IDs found for the user.

**Response:**
```json
{
  "adIds": ["5364587", "5377628", "5481981"],
  "totalCount": 3,
  "timestamp": "2025-01-17T10:30:00.000Z"
}
```

## How It Works

### 1. Ad Discovery
The service scrapes the user's ads page (`/admin/avisos`) with pagination support:
- Makes requests to each page until no more ads are found
- Parses HTML using Cheerio to extract ad IDs from the DOM
- Handles dynamic pagination and rate limiting

### 2. Republishing Process
For each discovered ad ID:
- Makes a GET request to `/admin/avisos/republish/{adId}`
- Includes all necessary headers and cookies for authentication
- Processes all requests in parallel using `Promise.allSettled()`
- Implements retry logic for failed requests

### 3. Scheduling
- Uses `@nestjs/schedule` for cron job management
- Configurable schedule (default: every 25 hours)
- Timezone-aware scheduling
- Automatic startup execution option

## Architecture

```
src/
├── app.module.ts           # Main application module
├── main.ts                 # Application bootstrap
├── config/                 # Configuration management
│   └── configuration.ts    # Environment configuration
├── modules/
│   ├── ads/               # Ad management module
│   │   ├── ads.controller.ts
│   │   ├── ads.service.ts
│   │   └── ads.module.ts
│   ├── republish/         # Republishing module
│   │   ├── republish.controller.ts
│   │   ├── republish.service.ts
│   │   └── republish.module.ts
│   └── scraper/          # HTML scraping module
│       ├── scraper.service.ts
│       └── scraper.module.ts
└── common/               # Shared utilities
    ├── decorators/
    ├── dto/
    ├── interfaces/
    └── utils/
```

## Development

### Running Tests
```bash
# Unit tests
npm run test

# E2E tests  
npm run test:e2e

# Test coverage
npm run test:cov
```

### Code Quality
```bash
# Lint code
npm run lint

# Format code
npm run format
```

### Debugging
The application includes comprehensive logging. Logs are written to:
- Console (development)
- File: `./logs/app.log` (production)

Set `LOG_LEVEL=debug` for detailed debugging information.

## Deployment

### Docker (Optional)
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build
EXPOSE 3000
CMD ["npm", "run", "start:prod"]
```

### PM2 (Recommended for production)
```bash
npm install -g pm2
pm2 start ecosystem.config.js
```

## Monitoring

- Check logs: `tail -f logs/app.log`
- Monitor cron jobs: Use the `/republish/status` endpoint
- Health check: `GET /health` (if implemented)

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Run linting and tests
6. Submit a pull request

## License

MIT License - see LICENSE file for details.

## Support

For issues and questions:
1. Check the logs for error details
2. Verify your cookies are still valid
3. Ensure network connectivity to clasificados.lavoz.com.ar
4. Open an issue in the repository 