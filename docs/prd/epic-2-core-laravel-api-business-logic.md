# Epic 2: Core Laravel API & Business Logic

**Goal:** Build the comprehensive Laravel REST API that serves as the backbone of FuelIntel, providing all pricing intelligence endpoints that both the Telegram bot and web dashboard will consume. This epic transforms raw price data into actionable insights through business logic for competitor analysis, historical trends, geographic filtering, and price calculations. Upon completion, any client can access full pricing intelligence via well-documented API endpoints.

## Story 2.1: API Authentication & User Management

As a platform administrator,
I want to implement JWT-based authentication and user registration,
so that gas station owners can securely access their personalized data.

### Acceptance Criteria

1: User registration endpoint (/api/v1/auth/register) creates accounts with email, password, and station details
2: Login endpoint (/api/v1/auth/login) returns JWT token valid for 24 hours with refresh capability
3: User profile includes station_id, name, location (entidad, municipio), and subscription tier
4: Password reset flow implemented with secure token generation and email notification
5: API middleware validates JWT tokens and attaches user context to all protected routes
6: Rate limiting implemented per user tier (free: 100/hour, paid: 1000/hour)

## Story 2.2: Current Pricing Endpoints

As a gas station owner,
I want to query current fuel prices for my competitors,
so that I can make informed pricing decisions.

### Acceptance Criteria

1: GET /api/v1/prices/current returns latest prices for all stations with optional filters (entidad, municipio, brand)
2: GET /api/v1/prices/station/{id} returns detailed pricing for specific station including all fuel types
3: GET /api/v1/prices/nearby accepts lat/lng and radius, returns stations sorted by distance
4: Response includes station details, all fuel prices, last update time, and price change indicators
5: Results paginated with 50 stations per page and proper meta information
6: Response time under 500ms for queries returning up to 100 stations

## Story 2.3: Historical Data & Trends API

As a pricing analyst,
I want to access historical price data and trends,
so that I can identify patterns and optimize pricing strategies.

### Acceptance Criteria

1: GET /api/v1/prices/history/{station_id} returns price changes for specified date range (default 7 days)
2: GET /api/v1/trends/station/{id} calculates trend metrics (avg, min, max, volatility) for specified period
3: GET /api/v1/trends/market returns aggregate market trends by geographic area
4: Endpoint supports grouping by day, week, or month with proper aggregation
5: Include percentage changes and comparison to market average in responses
6: Chart-ready data format with proper time series structure for frontend consumption

## Story 2.4: Competitor Analysis Endpoints

As a station manager,
I want to compare my prices against local competitors,
so that I can maintain competitive positioning.

### Acceptance Criteria

1: GET /api/v1/competitors returns competitor list based on user's station location
2: GET /api/v1/analysis/ranking shows user's price position among competitors (1st cheapest, 2nd, etc.)
3: GET /api/v1/analysis/spread returns price spread analysis (difference from min, max, average)
4: Competitor definition configurable by radius (default 5km) or same municipio
5: Analysis includes separate rankings for each fuel type (Regular, Premium, Diesel)
6: Response includes recommendations like "Your Premium is 3% above market average"

## Story 2.5: Geographic Aggregation API

As a regional manager,
I want to view pricing data aggregated by geographic regions,
so that I can understand market dynamics across areas.

### Acceptance Criteria

1: GET /api/v1/geo/estados returns average prices grouped by estado (state)
2: GET /api/v1/geo/municipios/{estado} returns average prices for all municipios in a state
3: GET /api/v1/geo/stats/{municipio} returns detailed statistics for specific municipio
4: Endpoints include station count, price ranges, and top/bottom performers
5: Support for comparison between multiple geographic areas
6: Heat map data structure for visualization of geographic price variations

## Story 2.6: API Documentation & Testing

As an API consumer,
I want comprehensive documentation and testing tools,
so that I can integrate efficiently with the FuelIntel platform.

### Acceptance Criteria

1: OpenAPI/Swagger documentation auto-generated and accessible at /api/documentation
2: Postman collection exported with example requests for all endpoints
3: API versioning clearly documented with deprecation policy
4: Rate limit headers (X-RateLimit-Limit, X-RateLimit-Remaining) included in all responses
5: Comprehensive error messages with clear problem descriptions and solution hints
6: API health dashboard showing endpoint status and response times
