# Testing Strategy

## Testing Pyramid

```
         E2E Tests (10%)
        /              \
    Integration Tests (30%)
      /                  \
Frontend Unit (30%)  Backend Unit (30%)
```

## Test Organization

### Frontend Tests

```
apps/web/tests/
├── unit/           # Component tests
├── integration/    # Service tests
└── e2e/           # User flow tests
```

### Backend Tests

```
apps/api/tests/
├── Unit/          # Service/model tests
├── Feature/       # API endpoint tests
└── Integration/   # External service tests
```

### E2E Tests

```
tests/e2e/
├── auth.spec.ts
├── pricing.spec.ts
└── alerts.spec.ts
```

## Test Examples

### Frontend Component Test

```typescript
// apps/web/tests/unit/PriceCard.test.tsx
import { render, screen } from '@testing-library/react';
import { PriceCard } from '@/components/features/pricing/PriceCard';

describe('PriceCard', () => {
  it('shows price increase indicator', () => {
    render(
      <PriceCard
        fuelType="regular"
        currentPrice={23.50}
        previousPrice={22.50}
        lastUpdated="2024-01-13"
      />
    );

    expect(screen.getByText('$23.50')).toBeInTheDocument();
    expect(screen.getByText('+4.4%')).toBeInTheDocument();
    expect(screen.getByTestId('trend-up')).toBeInTheDocument();
  });
});
```

### Backend API Test

```php
// apps/api/tests/Feature/PriceApiTest.php
class PriceApiTest extends TestCase
{
    public function test_nearby_prices_requires_coordinates()
    {
        $response = $this->getJson('/api/v1/prices/nearby');

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['lat', 'lng']);
    }

    public function test_nearby_prices_returns_stations()
    {
        $user = User::factory()->create();

        $response = $this->actingAs($user)
            ->getJson('/api/v1/prices/nearby?lat=19.4326&lng=-99.1332');

        $response->assertStatus(200)
            ->assertJsonStructure([
                'data' => [
                    '*' => ['numero', 'nombre', 'distance_km', 'current_prices']
                ]
            ]);
    }
}
```

### E2E Test

```typescript
// tests/e2e/pricing.spec.ts
import { test, expect } from "@playwright/test";

test("user can check competitor prices", async ({ page }) => {
  await page.goto("/login");
  await page.fill("[name=email]", "test@example.com");
  await page.fill("[name=password]", "password");
  await page.click("button[type=submit]");

  await page.waitForURL("/dashboard");
  await page.click("text=Competitors");

  await expect(page.locator(".competitor-card")).toHaveCount(5);
  await expect(page.locator(".price-comparison")).toBeVisible();
});
```
