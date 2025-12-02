import { CommonModule } from '@angular/common';
import { Component, inject, OnInit, signal } from '@angular/core';
import {IndexedDBService} from '../../shared';
import {SharedApiService} from '../../shared';
import {LoaderService} from '../../shared';
 
import {map, of, switchMap, tap, forkJoin} from 'rxjs';
import { Router } from '@angular/router';
@Component({
  selector: 'app-listing',
  templateUrl: './listing.html',
  styleUrl: './listing.scss',
  imports: [CommonModule],
})
export class Listing implements OnInit {
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
    // fetch counts for each content type and display on cards
    this.fetchCount('greetingData').subscribe(cnt => this.greetingsCount.set(cnt));
    this.fetchCount('socailpostData').subscribe(cnt => this.socialCount.set(cnt));
    this.fetchCount('brouchersData').subscribe(cnt => this.brochureCount.set(cnt));
  }

  private fetchCount(apiPoint: string) {
    return this.idbsvc.getData('HomePageData', apiPoint).pipe(
      switchMap((cachedData) =>
        cachedData
          ? of(cachedData)
          : this.apiService.getCategoryData(apiPoint).pipe(
              map((res: any) => res.data),
              tap((data) => {
                this.idbsvc
                  .setNewCollectionData('HomePageData', apiPoint, data, 'MM:15')
                  .subscribe();
              })
            )
      ),
      map((res: any) => {
        const data = res?.data?.data || res?.data || res || [];
        return this.countImagesInData(data);
      })
    );
  }

  private countImagesInData(data: any): number {
    let total = 0;
    if (!Array.isArray(data)) return 0;
    const walk = (items: any[]) => {
      for (const it of items) {
        if (!it) continue;
        if (Array.isArray(it.imgList)) total += it.imgList.length;
        if (Array.isArray(it.imgs)) total += it.imgs.length;
        if (Array.isArray(it.images)) total += it.images.length;
        const subs = it.subCategories || it.subcategories || it.children || [];
        if (Array.isArray(subs) && subs.length) walk(subs);
      }
    };
    walk(data);
    return total;
  }

  // Called when Day Greetings card is clicked
  async onDayGreetings(apiPoint : any): Promise<void> {
    try {
       this.idbsvc
      .getData('HomePageData', apiPoint)
      .pipe(
        switchMap((cachedData) =>
          cachedData
            ? of(cachedData)
            : this.apiService.getCategoryData(apiPoint).pipe(
                map((res : any) => res.data),
                tap((data) => {
                  this.idbsvc
                    .setNewCollectionData(
                      'HomePageData',
                      apiPoint,
                      data,
                      'MM:15'
                    )
                    .subscribe();
                })
              )
        ),
      )
      .subscribe((res: any) => {
        let data = res?.data?.data || res?.data || res;

        // Navigate to greetings component with fetched data (passed via state)
        try {
          this.router.navigate(['/home/greetings'], { state: { greetingData: data } });
        } catch (e) {
          console.error('Navigation to greetings failed', e);
        }
      });
    } catch (err) {
      console.error('[ListingApp] error calling greeting API', err);
    }
  }
}
