import { CommonModule, Location } from '@angular/common';
import { Component, inject, OnInit, signal } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';

interface FolderItem {
  FolderName: string;
  DisplayName: string;
  Code: string;
  Country?: string;
  Folders?: FolderItem[];
  Events?: any[];
}

@Component({
  selector: 'app-sync-listing',
  templateUrl: './sync-listing.html',
  styleUrl: './sync-listing.scss',
  imports: [CommonModule],
})
export class SyncListing implements OnInit {
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private location = inject(Location);

  protected title = signal('Folders');
  protected currentFolders: FolderItem[] = [];
  protected searchQuery = signal('');
  protected breadcrumbPath: string[] = []; // FolderName path for storage
  protected breadcrumbDisplay: string[] = []; // DisplayName for UI
  private stack: FolderItem[][] = []; // stack of folder arrays for back
  private pathStack: string[][] = []; // stack of breadcrumb paths

  get displayFolders(): FolderItem[] {
    const query = this.searchQuery().toLowerCase().trim();
    if (!query) return this.currentFolders;
    return this.currentFolders.filter(folder => 
      folder.DisplayName && folder.DisplayName.toLowerCase().includes(query)
    );
  }

  private syncType = ''; // 'greetings', 'socialpost', 'brochure'
  private STORAGE_KEY = 'sync_breadcrumb_path';

  ngOnInit(): void {
    // get sync type from route
    this.route.params.subscribe(params => {
      this.syncType = params['type'] || 'greetings';
    });

    const state = (history && (history.state as any)) || {};
    const incomingFolders = state.folders || [];

    if (Array.isArray(incomingFolders) && incomingFolders.length > 0) {
      this.currentFolders = incomingFolders;
      // clear breadcrumb on initial load
      this.breadcrumbPath = [];
      this.breadcrumbDisplay = [];
    } else {
      this.currentFolders = [];
    }
  }

  onFolderClick(folder: FolderItem): void {
    if (!folder) return;

    // check if this folder has nested subfolders
    const subs = folder.Folders || [];
    if (Array.isArray(subs) && subs.length > 0) {
      // drill into subfolder level
      this.stack.push(this.currentFolders);
      this.pathStack.push([...this.breadcrumbPath]);

      this.breadcrumbPath.push(folder.FolderName);
      this.breadcrumbDisplay.push(folder.DisplayName);

      // update localStorage with current path
      this.savePathToStorage();

      this.currentFolders = subs;
    } else {
      // leaf node (no subfolders)
      console.log('Selected leaf folder:', folder);
    }
  }

  goBack(): void {
    if (this.stack.length === 0) {
      this.location.back();
      return;
    }

    this.currentFolders = this.stack.pop() || [];
    const prevPath = this.pathStack.pop() || [];
    this.breadcrumbPath = [...prevPath];

    // also pop displayName breadcrumb
    this.breadcrumbDisplay.pop();

    // update localStorage
    this.savePathToStorage();
  }

  private savePathToStorage(): void {
    const pathStr = this.breadcrumbPath.join('/');
    localStorage.setItem(this.STORAGE_KEY, pathStr);
  }

  get canGoBack(): boolean {
    return this.stack.length > 0;
  }

  get displayBreadcrumb(): string {
    return this.breadcrumbPath.length ? this.breadcrumbPath.join(' > ') : 'Root';
  }
}
