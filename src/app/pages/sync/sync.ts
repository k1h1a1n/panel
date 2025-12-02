import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { IndexedDBService } from '../../shared';
import { SharedApiService } from '../../shared';
import { LoaderService } from '../../shared';
import { signal } from '@angular/core';
import { map, of, switchMap, tap } from 'rxjs';
import { Router } from '@angular/router';

@Component({
  selector: 'app-sync',
  imports: [],
  templateUrl: './sync.html',
  styleUrl: './sync.scss',
})
export class Sync {
  private idbsvc = inject(IndexedDBService);
  private apiService = inject(SharedApiService);
  private loaderService = inject(LoaderService);
  private router = inject(Router);
  protected readonly title = signal('listing');
  protected loaderIsLoading = this.loaderService.isLoading;
  protected loaderError = this.loaderService.errorMessage;

  onGreetings() { 
    this.apiService.getGreetings().subscribe((data: any) => {
      const folders = data?.Folders || [];
      this.router.navigate(['/home/sync/greetings'], { state: { folders } });
    });
  }

  onSocialPosts() { 
    this.apiService.getSocialPost().subscribe((data: any) => {
      const folders = data?.Folders || [];
      this.router.navigate(['/home/sync/socialpost'], { state: { folders } });
    });
  }

  onBrochures() { 
    this.apiService.getBrochures().subscribe((data: any) => {
      const folders = data?.Folders || [];
      this.router.navigate(['/home/sync/brochure'], { state: { folders } });
    });
  }
}
