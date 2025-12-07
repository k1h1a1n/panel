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
  private titleStack: string[] = [];
  protected editingMap: Record<number, boolean> = {};
  protected editDateMap: Record<number, string> = {};

  get displayList(): any[] {
    const query = this.searchQuery().toLowerCase().trim();
    if (!query) return this.currentList;
    return this.currentList.filter(item => item.name && item.name.toLowerCase().includes(query));
  }

  ngOnInit(): void {
    const navState = (history && (history.state as any)) || {};
    const incoming = navState.greetingData || null;
    const incomingTitle = navState.title || 'Greetings';

    this.title.set(incomingTitle);

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
      this.titleStack.push(this.title());
      this.breadcrumb.push(item.name);
      this.currentList = subs;
      // Update title with the item name
      this.title.set(item.name);
    } else {
      // leaf node — open images if available
      const imgs = item.imgList ?? item.imgs ?? [];
      console.log('Leaf item clicked', item);
      if (Array.isArray(imgs) && imgs.length > 0) {
        const pathSegments = [...this.breadcrumb, item.name];
        this.router.navigate(['/home/greetings/images'], {
          state: { imgList: imgs, parentList: this.currentList, breadcrumb: this.breadcrumb , title : item.name, pathSegments }
        });
        return;
      }
      console.log('Selected leaf item', item);
    }
  }

  /**
   * Return total images for a category item, including nested subcategories
   */
  protected getImageCount(item: any): number {
    if (!item) return 0;
    let total = 0;
    const addIfArray = (v: any) => {
      if (Array.isArray(v)) total += v.length;
    };

    addIfArray(item.imgList);
    addIfArray(item.imgs);
    addIfArray(item.images);

    const subs = item.subCategories || item.subcategories || item.children || [];
    if (Array.isArray(subs) && subs.length) {
      for (const s of subs) {
        total += this.getImageCount(s);
      }
    }

    return total;
  }

  protected formatDate(dateStr?: string): string {
    if (!dateStr) return '';
    const s = dateStr.trim();
    // Handle ISO format YYYY-MM-DD
    const isoMatch = /^\d{4}-\d{2}-\d{2}$/.test(s);
    let day = '';
    let monthNum = 0;
    let year = '';

    if (isoMatch) {
      const parts = s.split('-');
      year = parts[0];
      monthNum = parseInt(parts[1], 10);
      day = parts[2];
    } else if (/^\d{2}[-\/]\d{2}[-\/]\d{4}$/.test(s)) {
      const parts = s.split(/[-\/]/);
      day = parts[0];
      monthNum = parseInt(parts[1], 10);
      year = parts[2];
    } else {
      return dateStr;
    }

    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const month = months[(monthNum || 1) - 1] || String(monthNum);
    // Ensure day is two digits
    if (day.length === 1) day = day.padStart(2, '0');
    return `${day}/${month}/${year}`;
  }

  goBack(): void {
    if (this.stack.length === 0) {
      // if no local stack, go back in browser history
      this.location.back();
      return;
    }
    this.currentList = this.stack.pop() || [];
    this.breadcrumb.pop();
    const previousTitle = this.titleStack.pop() || 'Greetings';
    this.title.set(previousTitle);
  }

  protected startEdit(index: number, item: any, evt?: Event): void {
    if (evt) evt.stopPropagation();
    this.editingMap[index] = true;
    // prefill with ISO yyyy-mm-dd if possible
    const v = item.eventDate || '';
    if (/^\d{4}-\d{2}-\d{2}/.test(v)) {
      this.editDateMap[index] = v.substring(0, 10);
    } else if (/^\d{2}[-\/]\d{2}[-\/]\d{4}$/.test(v)) {
      // convert DD-MM-YYYY to YYYY-MM-DD for input[type=date]
      const parts = v.split(/[-\/]/);
      this.editDateMap[index] = `${parts[2]}-${parts[1]}-${parts[0]}`;
    } else {
      this.editDateMap[index] = '';
    }
  }

  protected saveDate(index: number, item: any, evt?: Event): void {
    if (evt) evt.stopPropagation();
    const newDate = this.editDateMap[index];
    if (newDate) {
      // store as ISO yyyy-mm-dd (matches existing samples)
      item.eventDate = newDate;
    }
    this.editingMap[index] = false;
    delete this.editDateMap[index];
  }

  protected cancelEdit(index: number, evt?: Event): void {
    if (evt) evt.stopPropagation();
    this.editingMap[index] = false;
    delete this.editDateMap[index];
  }
}
