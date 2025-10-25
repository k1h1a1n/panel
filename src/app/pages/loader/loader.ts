import { Component, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LoaderService } from '../../services/loader';

@Component({
  selector: 'app-loader',
  imports: [CommonModule],
  template: `
  @if (isLoading()){
    <div  class="loader-overlay">
      <div class="spinner-border text-primary" role="status">
        <span class="visually-hidden">Loading...</span>
      </div>
    </div>
  }
  `,
  styleUrls: ['./loader.scss']
})
export class LoaderComponent {
  private loaderService = inject(LoaderService);

  isLoading = computed(() => this.loaderService.loading());
}
