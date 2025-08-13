# Technical Assumptions

## Repository Structure: Monorepo

The project will use a monorepo structure to maintain all components (scraper, API, web frontend, bot) in a single repository, enabling atomic commits across the stack, simplified dependency management, and consistent tooling. This aligns with the single-developer bootstrap approach and BMAD-Method AI-assisted development workflow.

## Service Architecture

Laravel-centric architecture with Laravel serving as the main backend application handling all business logic, API endpoints, Telegram bot integration, and AI/NLP processing. Node.js runs as a dedicated scraper service solely responsible for government API data collection, communicating with Laravel via internal API endpoints. PostgreSQL provides permanent historical price storage with efficient change tracking, while Redis handles caching and session management. The Telegram bot, implemented within Laravel, consumes the same Laravel API endpoints used by the web frontend, ensuring consistency across all interfaces.

## Testing Requirements

Comprehensive testing pyramid including unit tests for all business logic (minimum 80% coverage), integration tests for API endpoints and database operations, end-to-end tests for critical user journeys (bot commands, dashboard flows), automated testing for government API scraper with mock data fallbacks, and manual testing convenience scripts for Telegram bot interactions. CI/CD pipeline will enforce test passage before deployment.

## Additional Technical Assumptions and Requests

- **Frontend Framework**: React.js with TypeScript for type safety, using shadcn/ui component library with Tailwind CSS for rapid, consistent UI development
- **Bot Framework**: Laravel-based Telegram Bot integration using BotMan or Telegram SDK, consuming Laravel API endpoints with Redis-backed session management
- **Database Design**: Efficient schema with price_changes table storing only deltas, indexed by station_id, timestamp, and geographic columns for fast queries
- **API Design**: RESTful endpoints with JWT authentication, rate limiting per user tier, and comprehensive OpenAPI documentation
- **Infrastructure**: Cloud deployment on AWS/GCP with auto-scaling groups, CloudFlare CDN for static assets, and automated backup strategies for PostgreSQL
- **Monitoring**: Sentry for error tracking, CloudWatch/Stackdriver for infrastructure monitoring, and custom analytics dashboard for business KPIs
- **Development Tools**: Docker for local development environment parity, GitHub Actions for CI/CD, and ESLint/Prettier for code consistency
- **Security**: Environment-based configuration management, API key rotation strategy, and OWASP Top 10 compliance for web application security
- **AI/NLP Integration**: DeepSeek API with Spanish language model fine-tuning, fallback responses for common queries to minimize API costs, and conversation context caching
- **Data Pipeline**: Scheduled cron jobs for government API scraping with retry logic, change detection algorithm to minimize database writes, and data validation before storage
