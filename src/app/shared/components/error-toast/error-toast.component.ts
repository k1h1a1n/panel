import { Component, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LoaderService } from '../../services/loader.service';

@Component({
  selector: 'app-error-toast',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div *ngIf="errorMessage()" class="error-toast">
      <span class="error-icon">⚠️</span>
      <span class="error-text">{{ errorMessage() }}</span>
      <button class="close-btn" (click)="onClose()">✕</button>
    </div>
  `,
  styles: [`
    .error-toast {
      position: fixed;
      bottom: 20px;
      right: 20px;
      background-color: #f8d7da;
      color: #721c24;
      padding: 15px 20px;
      border-radius: 4px;
      border: 1px solid #f5c6cb;
      display: flex;
      align-items: center;
      gap: 10px;
      z-index: 9998;
      box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
      animation: slideIn 0.3s ease-in-out;
    }

    .error-icon {
      font-size: 18px;
    }

    .error-text {
      flex: 1;
    }

    .close-btn {
      background: none;
      border: none;
      color: #721c24;
      cursor: pointer;
      font-size: 16px;
      padding: 0;
      opacity: 0.7;
    }

    .close-btn:hover {
      opacity: 1;
    }

    @keyframes slideIn {
      from {
        transform: translateX(400px);
        opacity: 0;
      }
      to {
        transform: translateX(0);
        opacity: 1;
      }
    }
  `]
})
export class ErrorToastComponent {
  private loaderService = inject(LoaderService);
  errorMessage = computed(() => this.loaderService.errorMessage());

  onClose(): void {
    this.loaderService.clearError();
  }
}
