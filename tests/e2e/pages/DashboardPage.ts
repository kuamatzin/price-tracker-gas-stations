import { Page, Locator } from "@playwright/test";

export class DashboardPage {
  readonly page: Page;
  readonly userMenu: Locator;
  readonly logoutButton: Locator;
  readonly mapContainer: Locator;
  readonly stationList: Locator;
  readonly searchInput: Locator;
  readonly filterButton: Locator;
  readonly alertsButton: Locator;
  readonly priceCards: Locator;

  constructor(page: Page) {
    this.page = page;
    this.userMenu = page.getByRole("button", { name: /user menu/i });
    this.logoutButton = page.getByRole("button", { name: /logout/i });
    this.mapContainer = page.getByTestId("map-container");
    this.stationList = page.getByTestId("station-list");
    this.searchInput = page.getByPlaceholder(/search stations/i);
    this.filterButton = page.getByRole("button", { name: /filter/i });
    this.alertsButton = page.getByRole("button", { name: /alerts/i });
    this.priceCards = page.getByTestId("price-card");
  }

  async goto() {
    await this.page.goto("/dashboard");
  }

  async logout() {
    await this.userMenu.click();
    await this.logoutButton.click();
  }

  async searchStation(query: string) {
    await this.searchInput.fill(query);
    await this.searchInput.press("Enter");
  }

  async openFilters() {
    await this.filterButton.click();
  }

  async openAlerts() {
    await this.alertsButton.click();
  }

  async selectStation(stationName: string) {
    await this.page.getByRole("button", { name: stationName }).click();
  }

  async getPriceForFuel(fuelType: "regular" | "premium" | "diesel") {
    const priceElement = await this.page.getByTestId(`price-${fuelType}`);
    return await priceElement.textContent();
  }

  async isMapVisible() {
    return await this.mapContainer.isVisible();
  }

  async getStationCount() {
    const stations = await this.stationList.locator(".station-item").all();
    return stations.length;
  }
}
