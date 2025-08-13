<!-- ⚠️ AUTO-GENERATED FILE - DO NOT EDIT DIRECTLY ⚠️
This file is automatically assembled from sharded documents in docs/prd/
To make edits, modify the files in docs/prd/ and run: md-tree assemble docs/prd docs/prd.md
Last assembled: 2025-08-13 -->

# FuelIntel Product Requirements Document (PRD)

## Goals and Background Context

### Goals

- Enable gas station owners to make data-driven pricing decisions within minutes instead of hours
- Provide instant competitive intelligence through natural language queries in Spanish
- Aggregate and analyze government pricing data with historical trends unavailable elsewhere
- Reduce time spent on manual competitor price checking from 30 minutes to 2 minutes daily
- Achieve 50 paying gas stations in first 6 months with 25,000 MXN monthly recurring revenue
- Deliver actionable pricing recommendations through mobile-first interfaces (Telegram bot and web dashboard)
- Maintain 99.5% data accuracy with sub-3 second response times for all queries

### Background Context

FuelIntel addresses a critical gap in the Mexican fuel retail market where ~12,000 gas station owners struggle with manual price tracking using poorly designed government platforms. The existing government API (api-reportediario.cne.gob.mx) provides current pricing data but lacks historical analysis, while commercial solutions like gaspre.mx offer overly complex charts that busy station owners don't have time to interpret.

Our solution transforms this complexity into simplicity through AI-powered natural language processing, allowing owners to ask questions like "¿Cuánto está cobrando la competencia por la Premium hoy?" and receive instant, actionable answers. By combining automated data collection, intelligent analytics, and conversational interfaces, FuelIntel turns pricing intelligence from a time-consuming task into a competitive advantage, particularly crucial in Mexico's price-capped regulatory environment where optimal pricing directly impacts profitability.

### Change Log

| Date       | Version | Description                                 | Author    |
| ---------- | ------- | ------------------------------------------- | --------- |
| 2025-01-13 | 1.0     | Initial PRD creation based on Project Brief | John (PM) |

## Requirements

### Functional

- FR1: The system must automatically scrape daily pricing data from the government API (api-reportediario.cne.gob.mx) for all fuel types (Diesel, Premium, Regular) across all Mexican gas stations
- FR2: The system must store all historical pricing data permanently, only creating new database records when price changes are detected, with each change timestamped precisely
- FR3: The Telegram bot must support both natural language queries in Spanish AND structured commands (e.g., /help, /precios_competencia, /mi_ranking, /alertas) with responses within 3 seconds
- FR4: The system must provide location-based filtering to compare competitor prices by Entidad (state) and Municipio (municipality)
- FR5: The web dashboard must display current prices, historical trends, and competitor comparisons in a mobile-optimized interface
- FR6: The system must generate real-time alerts when competitor prices change by more than a configurable threshold (default 5%)
- FR7: The natural language processor must understand common industry terminology and variations (e.g., "gasolina verde" for Regular, "roja" for Premium)
- FR8: The system must calculate and display average prices, price ranges, and ranking positions within geographic areas
- FR9: The dashboard must provide downloadable reports of pricing data in CSV format for specified date ranges
- FR10: The system must track government price caps and alert users when prices approach regulatory limits
- FR11: The bot must provide pricing recommendations based on competitor analysis and historical trends
- FR12: The system must maintain a station profile for each user including their station ID, location, and pricing preferences
- FR13: The system must implement efficient change detection to minimize database storage by only recording price changes with exact datetime stamps
- FR14: The bot must provide a comprehensive command menu including /start, /help, /precios_competencia, /historial, /promedios, /ranking, /alertas, and /configuracion
- FR15: The system must enable deep analytics and forecasting capabilities using the complete historical dataset for future feature development

### Non Functional

- NFR1: The system must achieve 99.9% uptime with automated failover capabilities
- NFR2: All API responses must complete within 3 seconds under normal load conditions
- NFR3: The system must handle 10,000+ daily API scrapes from government sources without failure
- NFR4: Data accuracy must maintain 99.5% accuracy compared to government source data
- NFR5: The platform must support concurrent usage by 500+ gas stations without performance degradation
- NFR6: All sensitive data must be encrypted in transit (TLS 1.3) and at rest (AES-256)
- NFR7: The system must implement rate limiting to prevent API abuse (100 requests per minute per user)
- NFR8: The mobile web interface must achieve a Lighthouse performance score of 90+ on mobile devices
- NFR9: The Telegram bot must maintain session state for contextual conversations lasting up to 30 minutes
- NFR10: The system must comply with Mexican data privacy regulations (similar to GDPR requirements)
- NFR11: Database queries must use indexed searches with response times under 100ms for 95% of queries
- NFR12: The system must auto-scale infrastructure based on load with cost optimization for bootstrap budget constraints

## User Interface Design Goals

### Overall UX Vision

The FuelIntel interface embodies "Simplicity Over Complexity" - transforming data-heavy pricing analytics into conversational, actionable insights. Every interaction should feel as natural as asking a colleague for advice, whether through Telegram chat or the web dashboard. The design prioritizes speed and clarity, allowing gas station owners to get pricing intelligence in under 30 seconds while managing their stations on-the-go. Visual hierarchy emphasizes current prices and immediate actions, with progressive disclosure for deeper analytics.

### Key Interaction Paradigms

- **Conversational First**: Natural language queries and bot commands as primary interaction method
- **Single Thumb Navigation**: All critical actions accessible with one-handed mobile use
- **Glanceable Information**: Key metrics visible within 2 seconds of screen load
- **Smart Defaults**: Pre-configured views based on user's station location and preferences
- **Progressive Complexity**: Simple price checks to advanced analytics in graduated steps
- **Contextual Intelligence**: Proactive alerts and recommendations based on market conditions

### Core Screens and Views

- **Bot Conversation Interface** - Telegram chat with command menu and natural language input
- **Dashboard Home** - Current prices, competitor comparison, quick stats, and alerts
- **Price Comparison View** - Map and list view of nearby competitors with filtering
- **Historical Trends Screen** - Interactive charts showing price movements over time
- **Alerts & Notifications Center** - Configurable price change alerts and recommendations
- **Station Profile Settings** - User preferences, location settings, alert thresholds
- **Analytics Deep Dive** - Advanced charts and forecasting for power users (future phase)

### Accessibility: WCAG AA

The platform will meet WCAG AA standards ensuring usability for all users, including high contrast modes, screen reader compatibility, and keyboard navigation support. Given the target demographic may include older station owners, we'll emphasize larger touch targets (minimum 44x44px) and readable font sizes (minimum 16px base).

### Branding

Clean, professional design reflecting reliability and trust in the fuel industry. Color palette should incorporate subtle fuel industry references (greens for regular, reds for premium) while maintaining a modern, data-driven aesthetic. Typography should be highly legible on small screens with clear numerical displays for prices. No specific brand guidelines provided yet - will follow modern SaaS best practices.

### Target Device and Platforms: Web Responsive

Primary focus on mobile-first responsive web design optimized for smartphones (iOS/Android browsers) with progressive enhancement for tablet and desktop views. Telegram Bot interface for iOS and Android Telegram apps. No native mobile apps in MVP phase.

## Technical Assumptions

### Repository Structure: Monorepo

The project will use a monorepo structure to maintain all components (scraper, API, web frontend, bot) in a single repository, enabling atomic commits across the stack, simplified dependency management, and consistent tooling. This aligns with the single-developer bootstrap approach and BMAD-Method AI-assisted development workflow.

### Service Architecture

Laravel-centric architecture with Laravel serving as the main backend application handling all business logic, API endpoints, Telegram bot integration, and AI/NLP processing. Node.js runs as a dedicated scraper service solely responsible for government API data collection, communicating with Laravel via internal API endpoints. PostgreSQL provides permanent historical price storage with efficient change tracking, while Redis handles caching and session management. The Telegram bot, implemented within Laravel, consumes the same Laravel API endpoints used by the web frontend, ensuring consistency across all interfaces.

### Testing Requirements

Comprehensive testing pyramid including unit tests for all business logic (minimum 80% coverage), integration tests for API endpoints and database operations, end-to-end tests for critical user journeys (bot commands, dashboard flows), automated testing for government API scraper with mock data fallbacks, and manual testing convenience scripts for Telegram bot interactions. CI/CD pipeline will enforce test passage before deployment.

### Additional Technical Assumptions and Requests

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

## Epic List

### Epic 1: Foundation & Data Pipeline (9 Stories)

Establish complete project infrastructure, external services, database schema, and automated government API data collection pipeline. This epic delivers the core data foundation with a working scraper collecting daily price changes, comprehensive testing and CI/CD setup, monitoring infrastructure, and a basic health check endpoint confirming the system is operational. **UPDATED: Now includes critical setup stories for project initialization, external services, testing, and monitoring.**

### Epic 2: Core Laravel API & Business Logic (6 Stories)

Build the main Laravel backend with RESTful API endpoints for price queries, competitor analysis, and historical data access. This epic delivers a fully functional API that can serve pricing intelligence data to any frontend client.

### Epic 3: Telegram Bot Integration (6 Stories)

Implement the Telegram bot within Laravel with both command-based and natural language interfaces for pricing queries. This epic delivers the primary user interface allowing gas station owners to get instant pricing intelligence through Telegram.

### Epic 4: Web Dashboard MVP (6 Stories)

Create the mobile-first React dashboard for visual price monitoring, competitor comparison, and basic analytics. This epic delivers the web interface providing visual insights and configuration options beyond what's available in the bot.

### Epic 5: Intelligence & Alerts System (6 Stories)

Add proactive monitoring, price change alerts, and AI-powered recommendations for pricing optimization. This epic transforms the platform from reactive queries to proactive intelligence that helps station owners optimize pricing strategies.

## Epic 1: Foundation & Data Pipeline

**Goal:** Establish the technical foundation and data collection infrastructure that powers the entire FuelIntel platform. This epic creates the monorepo structure, sets up the database schema optimized for permanent price change tracking, implements the Node.js scraper for government API data collection, and establishes the basic Laravel application with health monitoring endpoints. By the end of this epic, we have a functioning system that automatically collects and stores all Mexican gas station pricing data daily.

### Story 1.0: Project Infrastructure Setup (NEW - CRITICAL)

As a developer,
I want to establish the complete monorepo structure and development environment,
so that all team members can start development with a consistent setup.

#### Acceptance Criteria

1: Repository initialized with Git and proper .gitignore for Node.js, PHP, and React projects
2: Monorepo structure created with /apps (web, api, scraper) and /packages (shared) directories following architecture spec
3: Root package.json configured with npm workspaces linking all applications and packages
4: Docker Compose configuration successfully spins up PostgreSQL (v15), Redis (v7), PHP 8.3/Laravel, and Node.js 20
5: Environment variable templates created for all services with detailed comments (.env.example files)
6: README.md includes complete setup instructions executable in under 15 minutes on Mac/Windows/Linux
7: Shared TypeScript types package (/packages/shared) initialized with fuel types, API interfaces, and model definitions
8: ESLint, Prettier, and commit hooks configured consistently across all workspaces
9: Scripts in root package.json for common tasks (dev, test, lint, format, build)

### Story 1.1: Development Environment Configuration

As a developer,
I want to establish the monorepo structure with Docker configuration,
so that all team members and AI agents can work in a consistent development environment.

#### Acceptance Criteria

1: The monorepo contains clearly structured directories for /scraper (Node.js), /api (Laravel), /web (React), and /shared (common types/utilities)
2: Docker Compose configuration successfully spins up all required services (PostgreSQL, Redis, Node.js, PHP/Laravel)
3: Environment variable templates (.env.example) exist for all services with clear documentation
4: README.md provides clear setup instructions that a new developer can follow in under 15 minutes
5: Git hooks are configured for pre-commit linting and formatting validation
6: The development environment works identically on Mac, Windows, and Linux

### Story 1.2: Database Schema Design

As a system architect,
I want to design and implement an efficient PostgreSQL schema for permanent price storage,
so that we can track all price changes over time without redundant data.

#### Acceptance Criteria

1: Database migrations create tables: stations (numero as primary key, nombre, direccion, lat, lng, entidad_id, municipio_id), entidades (id, nombre matching EntidadFederativaId structure), municipios (id, entidad_id, nombre)
2: Price_changes table stores only changes with columns (station_numero, fuel_type enum ['diesel', 'premium', 'regular'], subproducto text for full fuel description, price decimal(5,2), changed_at timestamp, created_at)
3: Proper indexes on station_numero, changed_at, entidad_id, municipio_id, and composite index on (station_numero, fuel_type, changed_at) for efficient queries
4: Fuel type mapping logic standardizes SubProducto variations (e.g., maps "Premium (con un índice de octano ([RON+MON]/2) mínimo de 91)" to 'premium')
5: Foreign key constraints ensure referential integrity between stations, entidades, and municipios tables
6: Migration includes initial data load for all 32 entidades and their municipios from the catalog API

### Story 1.3: External Services Setup (NEW - CRITICAL)

As a platform operator,
I want to configure all external service accounts and integrations,
so that the application can connect to required third-party services.

#### Acceptance Criteria

1: Telegram bot created via @BotFather with webhook URL configured and token stored securely
2: DeepSeek API account created with API key obtained and credit balance verified for Spanish NLP
3: Vercel account connected to repository with project created for frontend deployment
4: Laravel Forge account configured with server provisioned on Vultr (or alternative)
5: Vultr Object Storage bucket created for report storage with S3-compatible credentials
6: CloudFlare account setup with CDN configuration for static assets (optional but recommended)
7: Sentry project created for error tracking with DSN keys for all three applications
8: GitHub repository created with proper branch protection rules and team access configured
9: Documentation created listing all external services, their purpose, and setup steps
10: Secrets management strategy documented (GitHub Secrets for CI/CD, .env for local)

### Story 1.4: Government API Scraper Implementation

As a data analyst,
I want an automated Node.js scraper that collects pricing data from the government API,
so that our system always has current pricing information.

#### Acceptance Criteria

1: Scraper fetches all 32 estados from api-catalogo.cne.gob.mx/api/utiles/entidadesfederativas then iterates through each estado to get municipios from api-catalogo.cne.gob.mx/api/utiles/municipios?EntidadFederativaId={id}
2: For each municipio, scraper calls api-reportediario.cne.gob.mx/api/EstacionServicio/Petroliferos?entidadId={estado}&municipioId={municipio} to retrieve pricing data for all stations
3: Parser correctly extracts station data (Numero as station_id, Nombre, Direccion, lat/lng if available) and price data (Producto type mapping Diésel/Gasolinas, SubProducto for specific fuel grade, PrecioVigente as current price)
4: Change detection compares PrecioVigente against last stored price for each station/fuel combination, only creating new price_changes records when values differ
5: Scraper handles API failures gracefully with exponential backoff retry logic (base delay 1s, multiplier 2, max delay 30s, max 5 retries) and continues processing remaining municipios if one fails
6: Detailed logging captures estados processed, municipios checked, total stations found, price changes detected, and any API errors with specific endpoint details
7: Rate limiting implemented for government API calls (max 10 requests/second with 100ms delay between calls)
8: Circuit breaker pattern implemented to halt scraping after 10 consecutive failures

### Story 1.5: Laravel Application Foundation

As a backend developer,
I want to establish the core Laravel application with basic health endpoints,
so that we can monitor system status and begin building API functionality.

#### Acceptance Criteria

1: Laravel application boots successfully with proper database and Redis connections
2: Health check endpoint (/api/health) returns system status including database connectivity, Redis status, and last scraper run time
3: Laravel scheduling configured to trigger Node.js scraper daily at configured time
4: Basic API versioning structure established (/api/v1/)
5: Laravel logs properly configured with daily rotation and error alerting
6: Telescope or similar debugging tool configured for development environment

### Story 1.6: Scraper-to-Laravel Integration

As a system integrator,
I want the Node.js scraper to communicate with Laravel API after each run,
so that Laravel maintains awareness of data collection status.

#### Acceptance Criteria

1: Scraper calls Laravel webhook endpoint upon completion with summary statistics
2: Laravel stores scraper run history including start time, end time, records processed, and changes detected
3: Failed scraper runs trigger Laravel error handling and admin notifications
4: Manual trigger endpoint in Laravel can initiate scraper run on-demand
5: Laravel can query current data freshness and alert if data is stale (>25 hours old)
6: Integration includes proper authentication between services using API keys
7: Webhook authentication uses HMAC-SHA256 signature verification with shared secret
8: Database connection pool configured with min 2, max 10 connections
9: Scraper health metrics exposed at /metrics endpoint for monitoring

### Story 1.7: Testing & CI/CD Setup (NEW - CRITICAL)

As a development team,
I want automated testing and deployment pipelines configured,
so that code quality is maintained and deployments are reliable.

#### Acceptance Criteria

1: PHPUnit configured for Laravel with example test for health endpoint passing
2: Vitest configured for React application with example component test passing
3: Jest configured for Node.js scraper with example unit test passing
4: Playwright installed with basic E2E test for login flow (can be marked as pending)
5: GitHub Actions workflow created for CI that runs on all pull requests
6: CI pipeline runs linting, type checking, and all test suites with status checks
7: CD pipeline configured to deploy frontend to Vercel on main branch merge
8: CD pipeline triggers Laravel Forge deployment via webhook on main branch merge
9: Test coverage reporting configured with minimum thresholds (60% for MVP)
10: Pre-commit hooks prevent commits with failing tests or linting errors

### Story 1.8: Monitoring & Logging Setup (NEW - RECOMMENDED)

As a platform operator,
I want comprehensive monitoring and logging from day one,
so that we can track errors and performance issues immediately.

#### Acceptance Criteria

1: Sentry SDK integrated in Laravel API with error boundary configuration
2: Sentry SDK integrated in React application with source map upload
3: Sentry SDK integrated in Node.js scraper with unhandled rejection tracking
4: Laravel Telescope installed and configured for local development debugging
5: Winston logger configured in Node.js scraper with daily rotation and error files
6: Structured logging format established (JSON with correlation IDs)
7: CloudWatch or equivalent configured for infrastructure monitoring (CPU, memory, disk)
8: Health check endpoints implemented for all services (/health returning status)
9: Uptime monitoring configured (UptimeRobot or similar) for production endpoints
10: Alert rules defined for critical errors (Sentry), service downtime, and API response times

### Story Execution Order

The stories in Epic 1 should be executed in the following sequence to ensure proper dependencies:

1. **Story 1.0** - Project Infrastructure Setup (Foundation)
2. **Story 1.1** - Development Environment Configuration (Docker/Local Dev)
3. **Story 1.2** - Database Schema Design (Data Layer)
4. **Story 1.3** - External Services Setup (Third-party Dependencies)
5. **Story 1.4** - Government API Scraper Implementation (Data Collection)
6. **Story 1.5** - Laravel Application Foundation (API Core)
7. **Story 1.6** - Scraper-to-Laravel Integration (Service Communication)
8. **Story 1.7** - Testing & CI/CD Setup (Quality Gates)
9. **Story 1.8** - Monitoring & Logging Setup (Observability)

This sequence ensures that infrastructure is in place before development, external services are configured before use, and monitoring is established to track the health of all components from the beginning.

## Epic 2: Core Laravel API & Business Logic

**Goal:** Build the comprehensive Laravel REST API that serves as the backbone of FuelIntel, providing all pricing intelligence endpoints that both the Telegram bot and web dashboard will consume. This epic transforms raw price data into actionable insights through business logic for competitor analysis, historical trends, geographic filtering, and price calculations. Upon completion, any client can access full pricing intelligence via well-documented API endpoints.

### Story 2.1: API Authentication & User Management

As a platform administrator,
I want to implement JWT-based authentication and user registration,
so that gas station owners can securely access their personalized data.

#### Acceptance Criteria

1: User registration endpoint (/api/v1/auth/register) creates accounts with email, password, and station details
2: Login endpoint (/api/v1/auth/login) returns JWT token valid for 24 hours with refresh capability
3: User profile includes station_id, name, location (entidad, municipio), and subscription tier
4: Password reset flow implemented with secure token generation and email notification
5: API middleware validates JWT tokens and attaches user context to all protected routes
6: Rate limiting implemented per user tier (free: 100/hour, paid: 1000/hour)

### Story 2.2: Current Pricing Endpoints

As a gas station owner,
I want to query current fuel prices for my competitors,
so that I can make informed pricing decisions.

#### Acceptance Criteria

1: GET /api/v1/prices/current returns latest prices for all stations with optional filters (entidad, municipio, brand)
2: GET /api/v1/prices/station/{id} returns detailed pricing for specific station including all fuel types
3: GET /api/v1/prices/nearby accepts lat/lng and radius, returns stations sorted by distance
4: Response includes station details, all fuel prices, last update time, and price change indicators
5: Results paginated with 50 stations per page and proper meta information
6: Response time under 500ms for queries returning up to 100 stations

### Story 2.3: Historical Data & Trends API

As a pricing analyst,
I want to access historical price data and trends,
so that I can identify patterns and optimize pricing strategies.

#### Acceptance Criteria

1: GET /api/v1/prices/history/{station_id} returns price changes for specified date range (default 7 days)
2: GET /api/v1/trends/station/{id} calculates trend metrics (avg, min, max, volatility) for specified period
3: GET /api/v1/trends/market returns aggregate market trends by geographic area
4: Endpoint supports grouping by day, week, or month with proper aggregation
5: Include percentage changes and comparison to market average in responses
6: Chart-ready data format with proper time series structure for frontend consumption

### Story 2.4: Competitor Analysis Endpoints

As a station manager,
I want to compare my prices against local competitors,
so that I can maintain competitive positioning.

#### Acceptance Criteria

1: GET /api/v1/competitors returns competitor list based on user's station location
2: GET /api/v1/analysis/ranking shows user's price position among competitors (1st cheapest, 2nd, etc.)
3: GET /api/v1/analysis/spread returns price spread analysis (difference from min, max, average)
4: Competitor definition configurable by radius (default 5km) or same municipio
5: Analysis includes separate rankings for each fuel type (Regular, Premium, Diesel)
6: Response includes recommendations like "Your Premium is 3% above market average"

### Story 2.5: Geographic Aggregation API

As a regional manager,
I want to view pricing data aggregated by geographic regions,
so that I can understand market dynamics across areas.

#### Acceptance Criteria

1: GET /api/v1/geo/estados returns average prices grouped by estado (state)
2: GET /api/v1/geo/municipios/{estado} returns average prices for all municipios in a state
3: GET /api/v1/geo/stats/{municipio} returns detailed statistics for specific municipio
4: Endpoints include station count, price ranges, and top/bottom performers
5: Support for comparison between multiple geographic areas
6: Heat map data structure for visualization of geographic price variations

### Story 2.6: API Documentation & Testing

As an API consumer,
I want comprehensive documentation and testing tools,
so that I can integrate efficiently with the FuelIntel platform.

#### Acceptance Criteria

1: OpenAPI/Swagger documentation auto-generated and accessible at /api/documentation
2: Postman collection exported with example requests for all endpoints
3: API versioning clearly documented with deprecation policy
4: Rate limit headers (X-RateLimit-Limit, X-RateLimit-Remaining) included in all responses
5: Comprehensive error messages with clear problem descriptions and solution hints
6: API health dashboard showing endpoint status and response times

## Epic 3: Telegram Bot Integration

**Goal:** Deliver the primary user interface through a sophisticated Telegram bot that combines natural language understanding with structured commands, allowing gas station owners to access pricing intelligence conversationally. The bot serves as the main touchpoint for users who prefer quick, mobile-first interactions without opening a web browser. This epic transforms the API into a conversational experience optimized for the daily workflow of busy station owners.

### Story 3.1: Telegram Bot Setup & Command Structure

As a gas station owner,
I want to interact with FuelIntel through Telegram commands,
so that I can quickly access pricing data from my phone.

#### Acceptance Criteria

1: Bot successfully registers with Telegram and responds to messages in production environment
2: /start command initiates registration flow linking Telegram account to FuelIntel user
3: /help command displays comprehensive command list with usage examples in Spanish
4: /comandos shows categorized command menu (Precios, Análisis, Configuración, Ayuda)
5: Bot handles unknown commands gracefully with helpful suggestions
6: Multi-language support structure in place (Spanish default, English future)

### Story 3.2: Price Query Commands

As a bot user,
I want to check current prices using simple commands,
so that I can get pricing information without complex interactions.

#### Acceptance Criteria

1: /precios returns current prices for user's registered station location
2: /precios_competencia shows competitor prices within configured radius
3: /precio_promedio displays average prices for user's municipio
4: /precio [station_name] searches and returns prices for specific station
5: Commands support fuel type filters (/precios premium, /precios diesel)
6: Response formatted as easy-to-read table with emoji indicators for price changes (📈📉)

### Story 3.3: Natural Language Processing Integration

As a conversational user,
I want to ask questions in natural Spanish,
so that I don't need to memorize specific commands.

#### Acceptance Criteria

1: Bot understands variations like "cuánto está la premium?", "precio de diesel", "gasolina verde"
2: DeepSeek API integration processes natural language with <2 second response time
3: Context maintained for follow-up questions ("¿y la regular?" after asking about premium)
4: Bot handles typos and colloquialisms common in Mexican Spanish
5: Fallback to command suggestions when natural language isn't understood
6: Natural language queries logged for continuous improvement

### Story 3.4: Analytics & Insights Commands

As a strategic decision maker,
I want to access trends and analysis through the bot,
so that I can make data-driven pricing decisions.

#### Acceptance Criteria

1: /tendencia shows 7-day price trend for user's station area with sparkline chart
2: /ranking displays user's price position among competitors
3: /alerta_cambios notifies of significant price changes in the area
4: /recomendacion provides AI-generated pricing suggestions based on market conditions
5: /historial [días] shows price history for specified number of days
6: Analytics responses include actionable insights, not just raw data

### Story 3.5: User Preferences & Notifications

As a regular user,
I want to configure my preferences and receive proactive alerts,
so that I stay informed without constantly checking.

#### Acceptance Criteria

1: /configurar initiates preference wizard for location, radius, alert thresholds
2: /notificaciones toggles daily summary, price alerts, and recommendation frequency
3: /mi_estacion allows updating registered station details
4: Scheduled notifications send at user-configured times (default 7 AM)
5: Alert thresholds customizable by percentage or peso amount per fuel type
6: /silencio command pauses notifications for specified period

### Story 3.6: Bot Performance & Error Handling

As a platform operator,
I want the bot to handle high load and errors gracefully,
so that users have a reliable experience.

#### Acceptance Criteria

1: Bot handles 100+ concurrent conversations without performance degradation
2: Redis session management maintains conversation state for 30 minutes
3: Timeout handling for API calls with user-friendly timeout messages
4: Error messages in Spanish with clear next steps ("Intenta de nuevo en unos momentos")
5: Admin commands for monitoring bot health and user statistics
6: Graceful degradation when external services (DeepSeek, Laravel API) are unavailable

## Epic 4: Web Dashboard MVP

**Goal:** Create a visually intuitive web dashboard that complements the Telegram bot with rich data visualizations and configuration capabilities. The mobile-first React application provides deeper analytics, visual trend analysis, and administrative functions that benefit from a larger screen format. This epic delivers the visual intelligence layer that transforms data into insights through charts, maps, and comparative visualizations.

### Story 4.1: React Application Setup

As a frontend developer,
I want to establish the React application structure with routing and state management,
so that we can build a scalable dashboard application.

#### Acceptance Criteria

1: React app with TypeScript configured using Vite for fast development builds
2: React Router implements routes for /login, /dashboard, /prices, /analytics, /settings
3: Zustand or Redux Toolkit configured for global state management
4: Shadcn/ui components library integrated with Tailwind CSS configuration
5: Axios configured with interceptors for API authentication and error handling
6: Responsive layout shell with mobile-first breakpoints (320px, 768px, 1024px)

### Story 4.2: Authentication & Dashboard Layout

As a dashboard user,
I want to securely log in and navigate the dashboard,
so that I can access my personalized pricing data.

#### Acceptance Criteria

1: Login page with email/password form and "Remember Me" functionality
2: JWT token storage in localStorage with auto-refresh before expiration
3: Dashboard layout with responsive navigation (hamburger menu on mobile)
4: User profile dropdown with station name, logout option, and settings link
5: Persistent sidebar on desktop, bottom navigation on mobile
6: Loading states and error boundaries for graceful error handling

### Story 4.3: Current Prices & Competitor View

As a visual learner,
I want to see current prices and competitor comparisons visually,
so that I can quickly understand market positioning.

#### Acceptance Criteria

1: Price cards display current prices for all fuel types with trend arrows
2: Competitor table sortable by distance, price, and brand
3: Map view shows competitor locations with price labels (using Leaflet or Mapbox)
4: Color coding indicates price competitiveness (green=cheap, red=expensive)
5: Quick filters for fuel type, distance radius, and brand
6: Export functionality for competitor data in CSV format

### Story 4.4: Historical Trends Visualization

As a data analyst,
I want to see price trends in interactive charts,
so that I can identify patterns and opportunities.

#### Acceptance Criteria

1: Line chart displays price history with selectable date ranges (7, 15, 30 days)
2: Multi-series chart compares user's prices against market average
3: Chart.js or Recharts implementation with zoom and pan capabilities
4: Toggle between fuel types with animated transitions
5: Tooltip shows exact values and percentage changes on hover
6: Trend summary statistics (avg, min, max, volatility) displayed below chart

### Story 4.5: Analytics Dashboard

As a strategic planner,
I want comprehensive analytics in a single view,
so that I can make informed business decisions.

#### Acceptance Criteria

1: Dashboard grid layout with customizable widget arrangement
2: KPI cards show ranking position, price spread, and market position
3: Mini charts display 7-day trends for each fuel type
4: Alert feed shows recent price changes and recommendations
5: Market heat map visualizes regional price variations
6: Performance optimized to load all widgets in under 3 seconds

### Story 4.6: Mobile Optimization & PWA

As a mobile user,
I want a native app-like experience on my phone,
so that I can access the dashboard conveniently.

#### Acceptance Criteria

1: Progressive Web App configuration with service worker for offline capability
2: Add to Home Screen prompt with custom icon and splash screen
3: Touch-optimized interactions with swipe gestures for navigation
4: Responsive charts that remain readable on 320px screens
5: Lighthouse score of 90+ for Performance, Accessibility, and Best Practices
6: Offline mode shows cached data with clear "last updated" timestamps

## Epic 5: Intelligence & Alerts System

**Goal:** Transform FuelIntel from a reactive query tool into a proactive intelligence platform that anticipates user needs and provides actionable recommendations. This epic adds the smart layer that monitors market conditions, detects opportunities, and alerts users to important changes. By completion, the platform actively helps station owners optimize their pricing strategy rather than just providing data.

### Story 5.1: Alert Rules Engine

As a platform architect,
I want to build a flexible alert rules engine,
so that users can receive customized notifications based on their criteria.

#### Acceptance Criteria

1: Rules engine supports conditions based on price changes, thresholds, and competitor movements
2: Alert types include immediate (Telegram), daily digest, and weekly summary
3: Rules can combine multiple conditions with AND/OR logic
4: User-specific alert preferences stored and managed through API
5: Alert history tracked with delivery status and user acknowledgment
6: Admin interface to monitor alert volume and delivery success rates

### Story 5.2: Automated Price Monitoring

As a station owner,
I want automatic monitoring of competitor price changes,
so that I'm immediately informed of market movements.

#### Acceptance Criteria

1: System checks for price changes after each scraper run completion
2: Significant changes (>5% or user threshold) trigger immediate alerts
3: Alerts include context: which competitor, fuel type, old/new price, percentage change
4: Daily summary compiles all changes in user's area at configured time
5: Smart grouping prevents alert fatigue (combines multiple small changes)
6: Opt-in for regional alerts beyond immediate competitor radius

### Story 5.3: AI-Powered Recommendations

As a pricing decision maker,
I want AI-generated recommendations based on market analysis,
so that I can optimize my pricing strategy.

#### Acceptance Criteria

1: DeepSeek API analyzes price trends, competitor positions, and historical patterns
2: Recommendations consider day of week, holidays, and seasonal patterns
3: Suggestions include specific actions ("Consider raising Premium by $0.50")
4: Confidence scores indicate recommendation strength based on data quality
5: A/B testing framework tracks recommendation acceptance and outcomes
6: Feedback mechanism allows users to rate recommendation usefulness

### Story 5.4: Predictive Analytics

As a strategic planner,
I want predictions about future price movements,
so that I can plan ahead for market changes.

#### Acceptance Criteria

1: Time series analysis predicts likely price movements for next 7 days
2: Predictions based on historical patterns, trends, and seasonal factors
3: Confidence intervals displayed with predictions (e.g., "likely range $19.50-20.50")
4: Market volatility index indicates prediction reliability
5: Backtesting shows prediction accuracy metrics in dashboard
6: API endpoint provides predictions for integration with business planning tools

### Story 5.5: Opportunity Detection

As a profit optimizer,
I want the system to identify pricing opportunities,
so that I can maximize margins while remaining competitive.

#### Acceptance Criteria

1: Algorithm identifies when user's prices could be adjusted without losing competitive position
2: Opportunities ranked by potential impact on revenue/margin
3: Notifications for "price ceiling" opportunities when all competitors raise prices
4: Detection of "price floor" warnings when market prices drop significantly
5: Weekly opportunity report summarizes missed and captured opportunities
6: Simulation tool shows potential impact of following recommendations

### Story 5.6: Performance Analytics & Reporting

As a business owner,
I want to track the platform's impact on my business,
so that I can measure ROI and optimize usage.

#### Acceptance Criteria

1: Dashboard tracks pricing decisions influenced by FuelIntel recommendations
2: Revenue impact calculator estimates value provided by optimized pricing
3: Competitive position tracking shows ranking improvements over time
4: Monthly reports exportable as PDF with executive summary
5: API usage analytics show which features provide most value
6: Benchmark comparisons against other stations using FuelIntel (anonymized)
