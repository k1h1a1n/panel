import { CommonModule, Location } from '@angular/common';
import { Component, inject, OnInit, signal } from '@angular/core';
import { SharedApiService } from '../../shared/services/data.service';
import { IndexedDBService } from '../../shared/services/indexeddb/indexeddb.service';
import { Router } from '@angular/router';

@Component({
  selector: 'app-greetings',
  templateUrl: './greetings.html',
  styleUrl: './greetings.scss',
  imports: [CommonModule],
})
export class Greetings implements OnInit {
  private api = inject(SharedApiService);
  private idb = inject(IndexedDBService);
  private router = inject(Router);
  private location = inject(Location);

  protected title = signal('Greetings');
  protected currentList: any[] = [];
  protected searchQuery = signal('');
  private stack: any[][] = [];
  protected breadcrumb: string[] = [];

  get displayList(): any[] {
    const query = this.searchQuery().toLowerCase().trim();
    if (!query) return this.currentList;
    return this.currentList.filter(item => item.name && item.name.toLowerCase().includes(query));
  }

  ngOnInit(): void {
    const navState = (history && (history.state as any)) || {};
    const incoming = navState.greetingData || null;
    if (incoming) {
      // normalize payload (some endpoints wrap in data.data)
      const data = incoming?.data?.data || incoming?.data || incoming;
      this.currentList = Array.isArray(data) ? data : [];
    } else {
      // fallback: fetch from api or idb directly
      const apiPoint = 'greetingData';
      this.idb
        .getData('HomePageData', apiPoint)
        .subscribe((cached: any) => {
          if (cached) {
            const d = cached?.data?.data || cached?.data || cached;
            this.currentList = Array.isArray(d) ? d : [];
          } else {
            this.api.getCategoryData(apiPoint).subscribe((res: any) => {
              const d = res?.data?.data || res?.data || res;
              this.currentList = Array.isArray(d) ? d : [];
            });
          }
        });
    }
  }

  onItemClick(item: any): void {
    if (!item) return;
    const subs = item.subCategories ?? item.subcategories ?? item.children ?? [];
    if (Array.isArray(subs) && subs.length > 0) {
      // push current list to stack and navigate into subs
      this.stack.push(this.currentList);
      this.breadcrumb.push(item.name);
      this.currentList = subs;
    } else {
      // leaf node — open images if available
      const imgs = item.imgList ?? item.imgs ?? [];
      if (Array.isArray(imgs) && imgs.length > 0) {
        this.router.navigate(['/home/greetings/images'], {
          state: { imgList: imgs, parentList: this.currentList, breadcrumb: this.breadcrumb }
        });
        return;
      }
      console.log('Selected leaf item', item);
    }
  }

  openImages(item: any, $event?: Event): void {
    if ($event) $event.stopPropagation();
    const imgs = item.imgList ?? item.imgs ?? [];
    if (!Array.isArray(imgs) || imgs.length === 0) return;
    this.router.navigate(['/home/greetings/images'], {
      state: { imgList: imgs, parentList: this.currentList, breadcrumb: this.breadcrumb }
    });
  }

  goBack(): void {
    if (this.stack.length === 0) {
      // if no local stack, go back in browser history
      this.location.back();
      return;
    }
    this.currentList = this.stack.pop() || [];
    this.breadcrumb.pop();
  }
}
