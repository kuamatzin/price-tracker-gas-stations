# Tech Stack

This is the DEFINITIVE technology selection for the entire FuelIntel project. All development must use these exact versions.

## Technology Stack Table

| Category             | Technology           | Version | Purpose                      | Rationale                                                             |
| -------------------- | -------------------- | ------- | ---------------------------- | --------------------------------------------------------------------- |
| Frontend Language    | TypeScript           | 5.3+    | Type-safe React development  | Prevents runtime errors, better IDE support, crucial for team scaling |
| Frontend Framework   | React                | 18.2+   | Web dashboard UI             | Mature ecosystem, excellent component libraries, specified in PRD     |
| UI Component Library | shadcn/ui            | Latest  | Rapid UI development         | Copy-paste components, Tailwind-based, highly customizable            |
| State Management     | Zustand              | 4.4+    | Global state management      | Simpler than Redux, TypeScript-first, perfect for our scale           |
| Backend Language     | PHP                  | 8.3+    | Laravel runtime              | Laravel 11 requires PHP 8.2+, 8.3 recommended for performance         |
| Backend Framework    | Laravel              | 11.x    | API and business logic       | Latest version with improved performance and streamlined structure    |
| Scraper Language     | Node.js              | 20 LTS  | Government API scraping      | Async/await excellence for concurrent API calls                       |
| API Style            | REST                 | -       | API communication            | Simpler than GraphQL for MVP, well-understood                         |
| Database             | PostgreSQL           | 15+     | Primary data storage         | Change-only storage pattern, JSONB for flexibility                    |
| Cache                | Redis                | 7.0+    | Caching and sessions         | Specified in PRD, managed by Forge                                    |
| File Storage         | Vultr Object Storage | -       | Report storage, backups      | S3-compatible, same vendor as VPS                                     |
| Authentication       | Laravel Sanctum      | 3.3+    | API authentication           | Built-in Laravel solution, perfect for SPA + mobile                   |
| Frontend Testing     | Vitest               | 1.0+    | Unit and component tests     | Faster than Jest, Vite-native                                         |
| Backend Testing      | PHPUnit              | 10.x    | Laravel testing              | Laravel standard, excellent mocking                                   |
| E2E Testing          | Playwright           | 1.40+   | End-to-end testing           | Better than Cypress for multi-browser                                 |
| Build Tool           | Vite                 | 5.0+    | Frontend bundling            | Lightning fast, great DX                                              |
| Bundler              | Vite                 | 5.0+    | Asset bundling               | Same as build tool                                                    |
| IaC Tool             | Laravel Forge        | -       | Infrastructure management    | Already in use, handles deployments                                   |
| CI/CD                | GitHub Actions       | -       | Automated testing/deployment | Free for public repos, integrates with Forge                          |
| Monitoring           | Sentry               | Latest  | Error tracking               | Excellent Laravel/React integration                                   |
| Logging              | Laravel Telescope    | 4.x     | Development debugging        | Built-in Laravel debugging                                            |
| CSS Framework        | Tailwind CSS         | 3.4+    | Utility-first styling        | Required by shadcn/ui, rapid development                              |
| Process Manager      | Supervisor           | 4.2+    | Scraper process management   | Managed by Forge, keeps Node.js scraper running                       |
| Bot Framework        | BotMan               | 2.8+    | Telegram integration         | Laravel-native, simpler than raw SDK                                  |
| AI/NLP               | DeepSeek API         | Latest  | Natural language processing  | Specified in PRD for Spanish NLP                                      |
| HTTP Client          | Axios                | 1.6+    | Frontend API calls           | Promise-based, interceptors for auth                                  |
| Scraper HTTP         | Got                  | 13.0+   | Node.js HTTP requests        | Better than axios for Node.js, retry logic built-in                   |
| Queue System         | Laravel Queues       | -       | Background jobs              | Built-in Laravel, uses Redis driver                                   |
| Scheduler            | Laravel Scheduler    | -       | Cron job management          | Built-in Laravel, triggers scraper                                    |
