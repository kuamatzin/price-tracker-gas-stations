# FuelIntel Price Scraper

Node.js-based scraper that collects pricing data from the Mexican government API.

## Features

- Fetches data from 32 Mexican states and ~2,400 municipalities
- Change detection - only stores price changes, not daily snapshots
- Circuit breaker pattern for fault tolerance
- Exponential backoff retry logic
- Rate limiting (10 requests/second)
- Comprehensive logging with Winston
- Health monitoring endpoints
- Dry-run mode for testing

## Quick Start

### Development

```bash
# Install dependencies
npm install

# Copy environment variables
cp .env.example .env

# Run in dry-run mode (no database writes)
DRY_RUN=true npm run scrape

# Run with database writes
npm run scrape

# Development mode with auto-reload
npm run dev
```

### Production

```bash
# Build TypeScript
npm run build

# Run compiled version
npm start
```

## Environment Variables

Create a `.env` file with the following:

```env
DATABASE_URL=postgresql://user:pass@localhost:5432/fuelintel
NODE_ENV=development
LOG_LEVEL=info
MAX_RETRIES=5
RATE_LIMIT=10
SENTRY_DSN=
DRY_RUN=false
```

## API Endpoints

When running, the scraper exposes monitoring endpoints on port 9090:

- `GET /health` - Health check endpoint
- `GET /metrics` - Scraper metrics and statistics
- `GET /status` - Current scraper status

## Docker

```bash
# Build image
docker build -t fuelintel-scraper .

# Run scraper
docker run --env-file .env fuelintel-scraper

# Run with custom command
docker run --env-file .env fuelintel-scraper dev
```

## Scheduling

The scraper can be triggered manually or scheduled via cron/Laravel scheduler:

```bash
# Add to crontab for hourly execution
0 * * * * cd /path/to/scraper && npm run scrape
```

## Architecture

- **Estados Scraper**: Fetches 32 Mexican states
- **Municipios Scraper**: Fetches municipalities for each state
- **Prices Scraper**: Fetches station prices for each municipality
- **Data Parser**: Normalizes fuel types and validates data
- **Change Detector**: Compares with existing prices
- **Orchestrator**: Coordinates all scrapers

## Error Handling

- Exponential backoff: 1s base, 2x multiplier, 30s max, 5 retries
- Circuit breaker: Opens after 10 consecutive failures
- Continues processing other municipios if one fails
- Comprehensive error logging

## Testing

```bash
# Run tests
npm test

# Run tests with coverage
npm run test:coverage

# Watch mode
npm run test:watch
```

## Monitoring

The scraper logs detailed statistics:

- Estados processed
- Municipios checked
- Stations found
- Price changes detected
- New stations added
- API errors

## Performance

- Processes ~2,500 API calls per full run
- Rate limited to 10 requests/second
- Database connection pool: min 2, max 10 connections
- Transaction batching for database writes
