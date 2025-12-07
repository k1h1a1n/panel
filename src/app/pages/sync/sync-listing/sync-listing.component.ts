import { CommonModule, Location } from '@angular/common';
import { Component, inject, OnInit, signal } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { SharedApiService, LoaderService } from '../../../shared';
import { map } from 'rxjs';
import { SyncImageModalComponent } from './sync-image-modal.component';

interface FolderItem {
    FolderName: string;
    DisplayName: string;
    Code: string;
    Country?: string;
    Folders?: FolderItem[];
    Events?: any[];
    imgList?: any[];
    imgs?: any[];
    images?: any[];
}

@Component({
    selector: 'app-sync-listing',
    templateUrl: './sync-listing.html',
    styleUrl: './sync-listing.scss',
    imports: [CommonModule, SyncImageModalComponent],
})
export class SyncListing implements OnInit {
    private router = inject(Router);
    private route = inject(ActivatedRoute);
    private location = inject(Location);
    private sharedService = inject(SharedApiService);
    private loaderService = inject(LoaderService);

    protected title = signal('Folders');
    protected currentFolders: FolderItem[] = [];
    protected searchQuery = signal('');
    protected breadcrumbPath: string[] = []; // FolderName path for storage
    protected breadcrumbDisplay: string[] = []; // DisplayName for UI
    private stack: FolderItem[][] = []; // stack of folder arrays for back
    private pathStack: string[][] = []; // stack of breadcrumb paths

    protected displayMode = signal<'folders' | 'images'>('folders'); // Toggle between folders and images view
    protected nonCommonImages: any[] = []; // Store non-common images
    protected currentPage = signal(1);
    protected pageSize = 5;
    protected selectedImage: any = null;
    protected imageModalVisible = false;

    get paginatedImages(): any[] {
        const start = (this.currentPage() - 1) * this.pageSize;
        return this.nonCommonImages.slice(start, start + this.pageSize);
    }

    get totalPages(): number {
        return Math.ceil(this.nonCommonImages.length / this.pageSize);
    }

    get pageRange(): number[] {
        const current = this.currentPage();
        const total = this.totalPages;
        const range = [];
        const start = Math.max(1, current - 3);
        const end = Math.min(total, current + 3);
        for (let i = start; i <= end; i++) {
            range.push(i);
        }
        return range;
    }

    get displayFolders(): FolderItem[] {
        const query = this.searchQuery().toLowerCase().trim();
        if (!query) return this.currentFolders;
        return this.currentFolders.filter(folder =>
            folder.DisplayName && folder.DisplayName.toLowerCase().includes(query)
        );
    }

    private syncType = ''; // 'greetings', 'socialpost', 'brochure'
    private STORAGE_KEY = 'sync_breadcrumb_path'; // single key for all categories

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
            // leaf node (no subfolders) - fetch images
            console.log('Selected leaf folder:', folder);

            // get stored breadcrumb path
            let lookinFolder = JSON.parse(localStorage.getItem('sync_breadcrumb_path') || '{}')[this.syncType.charAt(0).toUpperCase() + this.syncType.slice(1)] || '';
            lookinFolder = lookinFolder + '/' + folder.FolderName + '/';
            console.log('LookinFolder path:', lookinFolder);

            // extract path parts
            const pathParts = lookinFolder.split('/').filter((p: string) => p.length > 0);
            const firstPart = pathParts[0] || ''; // e.g., 'Greetings'
            const secondPart = pathParts[1].split('_')[1] || ''; // e.g., 'GCat01_Personal'
            const thirdPart = pathParts[2].split('_')[1] || ''; // e.g., 'GP001_Anniversary' //GP001_Anniversary further split based on _


            // map category to API endpoint
            const categoryMap: { [key: string]: string } = {
                'Greetings': 'greetingData',
                'Coupons': 'socailpostData',
                'Brochures': 'brouchersData'
            };
            const apiCategory = categoryMap[firstPart] || 'greetingData';

            // 1. Fetch API data
            this.sharedService.getCategoryData(apiCategory).subscribe((apiResponse: any) => {
                const apiData = apiResponse?.data || [];
                const isgreeting = (apiCategory === 'greetingData');
                // 2. Extract imgList from API response based on breadcrumb path
                const filteredImgList = this.extractImgListFromApi(apiData, secondPart, thirdPart, isgreeting);
                console.log('Filtered imgList from API:', filteredImgList);

                // 3. Fetch HTML and extract image details
                const queryParams = {
                    ProductId: 'VBZ1',
                    PluginId: 'VBZ1',
                    LookinFolder: this.sharedService.covertToHex(lookinFolder),
                    CatName: this.sharedService.covertToHex(folder.DisplayName),
                    CountryCode: 'IN',
                    App: 'BX'
                };

                this.sharedService.getImageListPage(queryParams).pipe(
                    map((htmlText: string) => this.extractImageUrls(htmlText))
                ).subscribe((imageDetails: any[]) => {
                    console.log('Extracted imageDetails from HTML:', imageDetails);

                    // 4. Compare and find non-common images
                    const nonCommonImages = this.compareAndFindNonCommon(imageDetails, filteredImgList);
                    console.log('Non-common images:', nonCommonImages);

                    // Store and display non-common images
                    this.nonCommonImages = nonCommonImages;
                    this.currentPage.set(1);
                    this.displayMode.set('images');
                });
            });
        }
    }

    /**
     * Extract imgList from nested API response based on breadcrumb parts
     * Supports both greetings (nested subCategories) and social post (flat structure)
     * Normalizes names by removing spaces for flexible matching
     */
    private extractImgListFromApi(apiData: any[], secondPart: string, thirdPart: string, isGreeting: boolean): any[] {
        // Helper: normalize name by removing spaces and converting to lowercase
        const normalize = (name: string): string => {
            return name.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
        };

        const normalizedSecond = normalize(secondPart);
        let normalizedThird = normalize(thirdPart);

        if (normalizedSecond && isGreeting) {
            // Three levels: search for second part category, then third part subcategory
            for (const mainCat of apiData) {
                if (mainCat.name && this.isSimilar(normalize(mainCat.name), normalizedSecond)) {
                    const subCats = mainCat.subCategories || [];
                    for (const subCat of subCats) {
                        if (subCat.name && this.isSimilar(normalize(subCat.name), normalizedThird)) {
                            return subCat.imgList || [];
                        }
                    }
                }
            }
        } else if (!isGreeting) {
            // Two levels: search for second part only (social post, brochures)
            for (const item of apiData) {
                if(normalizedThird === 'socialpost' ){
                    normalizedThird = 'concept0501to0600';
                    // Concept- 0501 to 0600
                }
                const similar = normalize(item.name);
                if (item.name && this.isSimilar(similar, normalizedThird)) {
                    return item.imgList || [];
                }
            }
        }

        return [];
    }

    isSimilar(a: string, b: string, threshold: number = 0.65): boolean {
        // Compare only up to the shortest string length
        const maxLength = Math.max(a.length, b.length);
        let matches = 0;

        for (let i = 0; i < Math.min(a.length, b.length); i++) {
            if (a[i] === b[i]) {
                matches++;
            }
        }

        const similarity = matches / maxLength;
        return similarity >= threshold;
    }

    protected getImageSrc(image: any): string {
        return image.link || '';
    }

    protected openImageModal(image: any): void {
        this.selectedImage = image;
        this.imageModalVisible = true;
    }

    protected closeImageModal(): void {
        this.imageModalVisible = false;
        this.selectedImage = null;
    }

    protected onLanguageChanged(event: { lang: string; image: any }): void {
        if (event?.image) {
            event.image.lang = event.lang;
            console.log('Language changed', event);
        }
    }

    protected async onSyncRequested(image: any): Promise<void> {
        this.closeImageModal();
        if (!image?.link) return;

        this.loaderService.show();

        try {
            // delegate download + save to local backend service
            await this.sendToBackend(image);
        } catch (error) {
            console.error('Sync download failed', error);
            this.loaderService.setError('Failed to download design.');
        } finally {
            this.loaderService.hide();
        }
    }

    private async sendToBackend(image: any): Promise<void> {
        const payload = {
            link: image.link,
            id: image.id,
            imgNo: image.imgNo,
            lang: image.lang || 'EN',
        };

        const response = await fetch('http://localhost:4300/download-image', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });

        if (!response.ok) {
            const text = await response.text();
            throw new Error(`Server error: ${response.status} ${text}`);
        }

        const json = await response.json();
        if (!json.success) {
            throw new Error(json.message || 'Download failed');
        }

        console.log('Sync completed. Assets saved at:', json.assetPath);
    }

    protected goToPage(page: number): void {
        if (page >= 1 && page <= this.totalPages) {
            this.currentPage.set(page);
        }
    }

    protected goBackToFolders(): void {
        this.displayMode.set('folders');
        this.nonCommonImages = [];
        this.currentPage.set(1);
    }


    /**
     * Compare imageDetails (from HTML) with imgList (from API)
     * Return images that are in imageDetails but not in imgList
     */
    private compareAndFindNonCommon(imageDetails: any[], imgList: any[]): any[] {
        // Extract IDs from imgList for quick lookup
        const apiIds = new Set<string>();
        imgList.forEach(img => {
            if (img.id) apiIds.add(img.id.toString());
        });

        // Find images in imageDetails that are NOT in imgList (by ID)
        const nonCommon = imageDetails.filter(detail => {
            const imgId = detail.imgNo || detail.id || '';
            return !apiIds.has(imgId);
        });

        return nonCommon;
    }

    extractImageUrls(html: string): any {
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        const thumbDivs = doc.querySelectorAll('.thumbdesign');
        const imageDetails: { link: string, id: string, imgNo: string }[] = [];

        thumbDivs.forEach(thumb => {
            const img = thumb.querySelector('img');
            const p = thumb.querySelector('p');
            if (img && p) {
                const link = img.src;
                const id = p.getAttribute('data-id') || '';
                const imgNo = p.textContent?.trim() || '';
                imageDetails.push({ link, id, imgNo });
            }
        });

        return imageDetails;
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
        // get existing paths object from localStorage
        const existingData = localStorage.getItem(this.STORAGE_KEY);
        const pathsData: Record<string, string> = existingData ? JSON.parse(existingData) : {};

        // capitalize first letter of syncType (e.g., 'greetings' -> 'Greetings')
        const typeCapitalized = this.syncType.charAt(0).toUpperCase() + this.syncType.slice(1);

        // construct path for current category
        const pathStr = this.breadcrumbPath.join('/');
        const fullPath = pathStr ? `${typeCapitalized}/${pathStr}` : typeCapitalized;

        // update paths object
        pathsData[typeCapitalized] = fullPath;

        // save back to localStorage as JSON
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(pathsData));
    }

    get canGoBack(): boolean {
        return this.stack.length > 0;
    }

    get displayBreadcrumb(): string {
        return this.breadcrumbPath.length ? this.breadcrumbPath.join(' > ') : 'Root';
    }
    onImageClick(image: any): void {
        if (!image) return;
        this.openImageModal(image);
    }   
}
