import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import {IndexedDBService} from '../../shared';
import {SharedApiService} from '../../shared';
import {LoaderService} from '../../shared';
import {signal} from '@angular/core';
import {map, of, switchMap, tap} from 'rxjs';
import { Router } from '@angular/router';
@Component({
  selector: 'app-listing',
  templateUrl: './listing.html',
  styleUrl: './listing.scss',
  imports: [CommonModule],
})
export class Listing {
  private idbsvc = inject(IndexedDBService);
  private apiService = inject(SharedApiService);
  private loaderService = inject(LoaderService);
  private router = inject(Router);
  protected readonly title = signal('listing');
  protected loaderIsLoading = this.loaderService.isLoading;
  protected loaderError = this.loaderService.errorMessage;

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
