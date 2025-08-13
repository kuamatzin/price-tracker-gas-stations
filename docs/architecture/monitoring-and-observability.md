# Monitoring and Observability

## Monitoring Stack

- **Frontend Monitoring:** Sentry for React errors, Vercel Analytics for performance
- **Backend Monitoring:** Laravel Telescope (dev), Sentry (production)
- **Error Tracking:** Sentry across all services
- **Performance Monitoring:** CloudFlare Analytics for CDN, custom metrics in CloudWatch

## Key Metrics

**Frontend Metrics:**

- Core Web Vitals (LCP, FID, CLS)
- JavaScript error rate
- API response times
- User interactions per session

**Backend Metrics:**

- Request rate (requests/minute)
- Error rate (4xx, 5xx responses)
- Response time (p50, p95, p99)
- Database query performance
- Queue job processing time
- Scraper success rate

**Business Metrics:**

- Daily active users
- Price queries per user
- Alert trigger rate
- Telegram bot usage
