# API Specification

## REST API Specification

```yaml
openapi: 3.0.0
info:
  title: FuelIntel API
  version: 1.0.0
  description: Fuel pricing intelligence API for Mexican gas stations
servers:
  - url: https://api.fuelintel.mx/api/v1
    description: Production API
  - url: http://localhost:8000/api/v1
    description: Development server

components:
  securitySchemes:
    bearerAuth:
      type: http
      scheme: bearer
      bearerFormat: JWT

  schemas:
    Station:
      type: object
      properties:
        numero:
          type: string
        nombre:
          type: string
        direccion:
          type: string
        lat:
          type: number
        lng:
          type: number
        current_prices:
          type: object
          properties:
            regular:
              type: number
            premium:
              type: number
            diesel:
              type: number
        distance_km:
          type: number
          nullable: true

    PriceHistory:
      type: object
      properties:
        fuel_type:
          type: string
          enum: [regular, premium, diesel]
        price:
          type: number
        changed_at:
          type: string
          format: date-time

paths:
  /auth/register:
    post:
      summary: Register new user
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required: [email, password, name, station_numero]
              properties:
                email:
                  type: string
                password:
                  type: string
                name:
                  type: string
                station_numero:
                  type: string
      responses:
        201:
          description: User created successfully
          content:
            application/json:
              schema:
                type: object
                properties:
                  user:
                    $ref: "#/components/schemas/User"
                  token:
                    type: string

  /auth/login:
    post:
      summary: User login
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required: [email, password]
              properties:
                email:
                  type: string
                password:
                  type: string
      responses:
        200:
          description: Login successful
          content:
            application/json:
              schema:
                type: object
                properties:
                  user:
                    $ref: "#/components/schemas/User"
                  token:
                    type: string

  /prices/current:
    get:
      summary: Get current prices
      security:
        - bearerAuth: []
      parameters:
        - name: entidad_id
          in: query
          schema:
            type: integer
        - name: municipio_id
          in: query
          schema:
            type: integer
        - name: fuel_type
          in: query
          schema:
            type: string
            enum: [regular, premium, diesel]
        - name: page
          in: query
          schema:
            type: integer
            default: 1
      responses:
        200:
          description: Current prices
          content:
            application/json:
              schema:
                type: object
                properties:
                  data:
                    type: array
                    items:
                      $ref: "#/components/schemas/Station"
                  meta:
                    type: object
                    properties:
                      current_page:
                        type: integer
                      total_pages:
                        type: integer
                      total_items:
                        type: integer

  /prices/nearby:
    get:
      summary: Get nearby station prices
      security:
        - bearerAuth: []
      parameters:
        - name: lat
          in: query
          required: true
          schema:
            type: number
        - name: lng
          in: query
          required: true
          schema:
            type: number
        - name: radius_km
          in: query
          schema:
            type: number
            default: 5
      responses:
        200:
          description: Nearby stations with prices
          content:
            application/json:
              schema:
                type: object
                properties:
                  data:
                    type: array
                    items:
                      $ref: "#/components/schemas/Station"

  /prices/history/{station_numero}:
    get:
      summary: Get price history for a station
      security:
        - bearerAuth: []
      parameters:
        - name: station_numero
          in: path
          required: true
          schema:
            type: string
        - name: days
          in: query
          schema:
            type: integer
            default: 7
        - name: fuel_type
          in: query
          schema:
            type: string
            enum: [regular, premium, diesel]
      responses:
        200:
          description: Price history
          content:
            application/json:
              schema:
                type: object
                properties:
                  station:
                    $ref: "#/components/schemas/Station"
                  history:
                    type: array
                    items:
                      $ref: "#/components/schemas/PriceHistory"

  /competitors:
    get:
      summary: Get competitor analysis
      security:
        - bearerAuth: []
      parameters:
        - name: radius_km
          in: query
          schema:
            type: number
            default: 5
      responses:
        200:
          description: Competitor analysis
          content:
            application/json:
              schema:
                type: object
                properties:
                  user_station:
                    $ref: "#/components/schemas/Station"
                  competitors:
                    type: array
                    items:
                      $ref: "#/components/schemas/Station"
                  analysis:
                    type: object
                    properties:
                      ranking:
                        type: object
                        properties:
                          regular:
                            type: integer
                          premium:
                            type: integer
                          diesel:
                            type: integer
                      average_prices:
                        type: object
                      price_spread:
                        type: object

  /analysis/ranking:
    get:
      summary: Get price ranking position
      security:
        - bearerAuth: []
      responses:
        200:
          description: Ranking position among competitors

  /trends/market:
    get:
      summary: Get market trends
      security:
        - bearerAuth: []
      parameters:
        - name: entidad_id
          in: query
          schema:
            type: integer
        - name: municipio_id
          in: query
          schema:
            type: integer
        - name: period
          in: query
          schema:
            type: string
            enum: [day, week, month]
      responses:
        200:
          description: Market trends and analytics

  /alerts:
    get:
      summary: Get user alerts
      security:
        - bearerAuth: []
      responses:
        200:
          description: List of configured alerts

    post:
      summary: Create new alert
      security:
        - bearerAuth: []
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required: [name, type, conditions]
      responses:
        201:
          description: Alert created

  /telegram/webhook:
    post:
      summary: Telegram bot webhook endpoint
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
      responses:
        200:
          description: Webhook processed

  /health:
    get:
      summary: System health check
      responses:
        200:
          description: System status
          content:
            application/json:
              schema:
                type: object
                properties:
                  status:
                    type: string
                  database:
                    type: boolean
                  redis:
                    type: boolean
                  last_scraper_run:
                    type: string
                    format: date-time
```

**API Authentication Requirements:**

- JWT tokens with 24-hour expiration
- Refresh token rotation for security
- Rate limiting based on subscription tier
- API key authentication for scraper-to-API communication

**Example Request/Response:**

```bash

```
