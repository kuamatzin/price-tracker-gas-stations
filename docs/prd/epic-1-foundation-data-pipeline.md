# Epic 1: Foundation & Data Pipeline

**Goal:** Establish the technical foundation and data collection infrastructure that powers the entire FuelIntel platform. This epic creates the monorepo structure, sets up the database schema optimized for permanent price change tracking, implements the Node.js scraper for government API data collection, and establishes the basic Laravel application with health monitoring endpoints. By the end of this epic, we have a functioning system that automatically collects and stores all Mexican gas station pricing data daily.

## Story 1.0: Project Infrastructure Setup (NEW - CRITICAL)

As a developer,  
I want to establish the complete monorepo structure and development environment,  
so that all team members can start development with a consistent setup.

### Acceptance Criteria

1: Repository initialized with Git and proper .gitignore for Node.js, PHP, and React projects
2: Monorepo structure created with /apps (web, api, scraper) and /packages (shared) directories following architecture spec
3: Root package.json configured with npm workspaces linking all applications and packages
4: Docker Compose configuration successfully spins up PostgreSQL (v15), Redis (v7), PHP 8.3/Laravel, and Node.js 20
5: Environment variable templates created for all services with detailed comments (.env.example files)
6: README.md includes complete setup instructions executable in under 15 minutes on Mac/Windows/Linux
7: Shared TypeScript types package (/packages/shared) initialized with fuel types, API interfaces, and model definitions
8: ESLint, Prettier, and commit hooks configured consistently across all workspaces
9: Scripts in root package.json for common tasks (dev, test, lint, format, build)

## Story 1.1: Development Environment Configuration

As a developer,
I want to establish the monorepo structure with Docker configuration,
so that all team members and AI agents can work in a consistent development environment.

### Acceptance Criteria

1: The monorepo contains clearly structured directories for /scraper (Node.js), /api (Laravel), /web (React), and /shared (common types/utilities)
2: Docker Compose configuration successfully spins up all required services (PostgreSQL, Redis, Node.js, PHP/Laravel)
3: Environment variable templates (.env.example) exist for all services with clear documentation
4: README.md provides clear setup instructions that a new developer can follow in under 15 minutes
5: Git hooks are configured for pre-commit linting and formatting validation
6: The development environment works identically on Mac, Windows, and Linux

## Story 1.2: Database Schema Design

As a system architect,
I want to design and implement an efficient PostgreSQL schema for permanent price storage,
so that we can track all price changes over time without redundant data.

### Acceptance Criteria

1: Database migrations create tables: stations (numero as primary key, nombre, direccion, lat, lng, entidad_id, municipio_id), entidades (id, nombre matching EntidadFederativaId structure), municipios (id, entidad_id, nombre)
2: Price_changes table stores only changes with columns (station_numero, fuel_type enum ['diesel', 'premium', 'regular'], subproducto text for full fuel description, price decimal(5,2), changed_at timestamp, created_at)
3: Proper indexes on station_numero, changed_at, entidad_id, municipio_id, and composite index on (station_numero, fuel_type, changed_at) for efficient queries
4: Fuel type mapping logic standardizes SubProducto variations (e.g., maps "Premium (con un índice de octano ([RON+MON]/2) mínimo de 91)" to 'premium')
5: Foreign key constraints ensure referential integrity between stations, entidades, and municipios tables
6: Migration includes initial data load for all 32 entidades and their municipios from the catalog API

## Story 1.3: External Services Setup (NEW - CRITICAL)

As a platform operator,  
I want to configure all external service accounts and integrations,  
so that the application can connect to required third-party services.

### Acceptance Criteria

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

## Story 1.4: Government API Scraper Implementation

As a data analyst,
I want an automated Node.js scraper that collects pricing data from the government API,
so that our system always has current pricing information.

### Acceptance Criteria

1: Scraper fetches all 32 estados from api-catalogo.cne.gob.mx/api/utiles/entidadesfederativas then iterates through each estado to get municipios from api-catalogo.cne.gob.mx/api/utiles/municipios?EntidadFederativaId={id}
2: For each municipio, scraper calls api-reportediario.cne.gob.mx/api/EstacionServicio/Petroliferos?entidadId={estado}&municipioId={municipio} to retrieve pricing data for all stations
3: Parser correctly extracts station data (Numero as station_id, Nombre, Direccion, lat/lng if available) and price data (Producto type mapping Diésel/Gasolinas, SubProducto for specific fuel grade, PrecioVigente as current price)
4: Change detection compares PrecioVigente against last stored price for each station/fuel combination, only creating new price_changes records when values differ
5: Scraper handles API failures gracefully with exponential backoff retry logic (base delay 1s, multiplier 2, max delay 30s, max 5 retries) and continues processing remaining municipios if one fails
6: Detailed logging captures estados processed, municipios checked, total stations found, price changes detected, and any API errors with specific endpoint details
7: Rate limiting implemented for government API calls (max 10 requests/second with 100ms delay between calls)
8: Circuit breaker pattern implemented to halt scraping after 10 consecutive failures

## Story 1.5: Laravel Application Foundation

As a backend developer,
I want to establish the core Laravel application with basic health endpoints,
so that we can monitor system status and begin building API functionality.

### Acceptance Criteria

1: Laravel application boots successfully with proper database and Redis connections
2: Health check endpoint (/api/health) returns system status including database connectivity, Redis status, and last scraper run time
3: Laravel scheduling configured to trigger Node.js scraper daily at configured time
4: Basic API versioning structure established (/api/v1/)
5: Laravel logs properly configured with daily rotation and error alerting
6: Telescope or similar debugging tool configured for development environment

## Story 1.6: Scraper-to-Laravel Integration

As a system integrator,
I want the Node.js scraper to communicate with Laravel API after each run,
so that Laravel maintains awareness of data collection status.

### Acceptance Criteria

1: Scraper calls Laravel webhook endpoint upon completion with summary statistics
2: Laravel stores scraper run history including start time, end time, records processed, and changes detected
3: Failed scraper runs trigger Laravel error handling and admin notifications
4: Manual trigger endpoint in Laravel can initiate scraper run on-demand
5: Laravel can query current data freshness and alert if data is stale (>25 hours old)
6: Integration includes proper authentication between services using API keys
7: Webhook authentication uses HMAC-SHA256 signature verification with shared secret
8: Database connection pool configured with min 2, max 10 connections
9: Scraper health metrics exposed at /metrics endpoint for monitoring

## Story 1.7: Testing & CI/CD Setup (NEW - CRITICAL)

As a development team,  
I want automated testing and deployment pipelines configured,  
so that code quality is maintained and deployments are reliable.

### Acceptance Criteria

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

## Story 1.8: Monitoring & Logging Setup (NEW - RECOMMENDED)

As a platform operator,  
I want comprehensive monitoring and logging from day one,  
so that we can track errors and performance issues immediately.

### Acceptance Criteria

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

## Story Execution Order

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
