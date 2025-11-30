import { Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class LoaderService {
  private requestCount = 0;
  public isLoading = signal(false);
  public errorMessage = signal<string | null>(null);

  show(): void {
    this.requestCount++;
    this.isLoading.set(true);
  }

  hide(): void {
    this.requestCount--;
    if (this.requestCount <= 0) {
      this.requestCount = 0;
      this.isLoading.set(false);
    }
  }

  setError(message: string): void {
    this.errorMessage.set(message);
    setTimeout(() => this.errorMessage.set(null), 5000); // Clear after 5s
  }

  clearError(): void {
    this.errorMessage.set(null);
  }
}
