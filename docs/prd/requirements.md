# Requirements

## Functional

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

## Non Functional

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
