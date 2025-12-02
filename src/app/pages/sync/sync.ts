import { CommonModule } from '@angular/common';
import { Component, inject, OnInit, signal } from '@angular/core';
import { IndexedDBService } from '../../shared';
import { SharedApiService } from '../../shared';
import { LoaderService } from '../../shared';
import { map, of, switchMap, tap } from 'rxjs';
import { Router } from '@angular/router';

@Component({
  selector: 'app-sync',
  imports: [],
  templateUrl: './sync.html',
  styleUrl: './sync.scss',
})
export class Sync implements OnInit {
  private idbsvc = inject(IndexedDBService);
  private apiService = inject(SharedApiService);
  private loaderService = inject(LoaderService);
  private router = inject(Router);
  protected readonly title = signal('listing');
  protected greetingsCount = signal(0);
  protected socialCount = signal(0);
  protected brochureCount = signal(0);
  protected loaderIsLoading = this.loaderService.isLoading;
  protected loaderError = this.loaderService.errorMessage;

  ngOnInit(): void {
    // fetch folder data and compute image counts
    this.apiService.getGreetings().subscribe((data: any) => {
      const folders = data?.Folders || [];
      this.greetingsCount.set(this.countImagesInFolders(folders));
    });

    this.apiService.getSocialPost().subscribe((data: any) => {
      const folders = data?.Folders || [];
      this.socialCount.set(this.countImagesInFolders(folders));
    });

    this.apiService.getBrochures().subscribe((data: any) => {
      const folders = data?.Folders || [];
      this.brochureCount.set(this.countImagesInFolders(folders));
    });
  }

  private countImagesInFolders(items: any[]): number {
    let total = 0;
    if (!Array.isArray(items)) return 0;
    const walk = (arr: any[]) => {
      for (const it of arr) {
        if (!it) continue;
        if (Array.isArray(it.imgList)) total += it.imgList.length;
        if (Array.isArray(it.imgs)) total += it.imgs.length;
        if (Array.isArray(it.images)) total += it.images.length;
        const subs = it.Folders || it.Folders || it.subCategories || it.subcategories || [];
        if (Array.isArray(subs) && subs.length) walk(subs);
      }
    };
    walk(items);
    return total;
  }

  onGreetings() { 
    this.apiService.getGreetings().subscribe((data: any) => {
      const folders = data?.Folders || [];
      this.router.navigate(['/home/sync/greetings'], { state: { folders } });
    });
  }

  onSocialPosts() { 
    this.apiService.getSocialPost().subscribe((data: any) => {
      const folders = data?.Folders || [];
      this.router.navigate(['/home/sync/coupons'], { state: { folders } });
    });
  }

  onBrochures() { 
    this.apiService.getBrochures().subscribe((data: any) => {
      const folders = data?.Folders || [];
      this.router.navigate(['/home/sync/brochures'], { state: { folders } });
    });
  }
}
