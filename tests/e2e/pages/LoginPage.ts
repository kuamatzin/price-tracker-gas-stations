import { Page, Locator } from "@playwright/test";

export class LoginPage {
  readonly page: Page;
  readonly emailInput: Locator;
  readonly passwordInput: Locator;
  readonly signInButton: Locator;
  readonly forgotPasswordLink: Locator;
  readonly errorMessage: Locator;
  readonly rememberMeCheckbox: Locator;

  constructor(page: Page) {
    this.page = page;
    this.emailInput = page.getByLabel("Email");
    this.passwordInput = page.getByLabel("Password");
    this.signInButton = page.getByRole("button", { name: /sign in/i });
    this.forgotPasswordLink = page.getByRole("link", {
      name: /forgot password/i,
    });
    this.errorMessage = page.getByRole("alert");
    this.rememberMeCheckbox = page.getByRole("checkbox", {
      name: /remember me/i,
    });
  }

  async goto() {
    await this.page.goto("/login");
  }

  async login(email: string, password: string) {
    await this.emailInput.fill(email);
    await this.passwordInput.fill(password);
    await this.signInButton.click();
  }

  async loginWithRememberMe(email: string, password: string) {
    await this.emailInput.fill(email);
    await this.passwordInput.fill(password);
    await this.rememberMeCheckbox.check();
    await this.signInButton.click();
  }

  async clickForgotPassword() {
    await this.forgotPasswordLink.click();
  }

  async getErrorMessage() {
    return await this.errorMessage.textContent();
  }

  async isLoggedIn() {
    // Check if redirected away from login page
    const url = this.page.url();
    return !url.includes("/login");
  }
}
