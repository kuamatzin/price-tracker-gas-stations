# Security and Performance

## Security Requirements

**Frontend Security:**

- CSP Headers: `default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline';`
- XSS Prevention: React's automatic escaping + DOMPurify for user content
- Secure Storage: JWT in httpOnly cookies (future), localStorage with expiry (MVP)

**Backend Security:**

- Input Validation: Laravel Form Requests for all user input
- Rate Limiting: 100/hour (free), 1000/hour (paid)
- CORS Policy: Configured for Vercel domain only

**Authentication Security:**

- Token Storage: localStorage with 24hr expiry (MVP), httpOnly cookies (future)
- Session Management: Redis-backed with 30min timeout
- Password Policy: Min 8 chars, 1 uppercase, 1 number

## Performance Optimization

**Frontend Performance:**

- Bundle Size Target: <200KB gzipped initial bundle
- Loading Strategy: Code splitting by route, lazy loading for charts
- Caching Strategy: SWR for API calls, 5min cache for price data

**Backend Performance:**

- Response Time Target: <500ms p95
- Database Optimization: Indexed queries, connection pooling
- Caching Strategy: Redis cache for expensive queries, 5min TTL
