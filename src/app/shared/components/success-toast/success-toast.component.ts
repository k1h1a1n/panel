import { Component, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LoaderService } from '../../services/loader.service';

@Component({
  selector: 'app-success-toast',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div *ngIf="successMessage()" class="success-toast">
      <span class="success-icon">✅</span>
      <span class="success-text">{{ successMessage() }}</span>
      <button class="close-btn" (click)="onClose()">✕</button>
    </div>
  `,
  styles: [`
    .success-toast {
      position: fixed;
      bottom: 20px;
      left: 20px;
      background-color: #d1e7dd;
      color: #0f5132;
      padding: 15px 20px;
      border-radius: 4px;
      border: 1px solid #badbcc;
      display: flex;
      align-items: center;
      gap: 10px;
      z-index: 9998;
      box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
      animation: slideIn 0.3s ease-in-out;
    }

    .success-icon {
      font-size: 18px;
    }

    .success-text {
      flex: 1;
    }

    .close-btn {
      background: none;
      border: none;
      color: #0f5132;
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
        transform: translateX(-400px);
        opacity: 0;
      }
      to {
        transform: translateX(0);
        opacity: 1;
      }
    }
  `]
})
export class SuccessToastComponent {
  private loaderService = inject(LoaderService);
  successMessage = computed(() => this.loaderService.successMessage());

  onClose(): void {
    this.loaderService.clearSuccess();
  }
}
