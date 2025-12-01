import { CommonModule, Location } from '@angular/common';
import { Component, inject, OnInit } from '@angular/core';
import { Router } from '@angular/router';

@Component({
    selector: 'app-greetings-images',
    templateUrl: './image-preview.html',
    styleUrl: './image-preview.scss',
    imports: [CommonModule],
})
export class ImagePreview implements OnInit {

    dwnloadLinkPrefix = 'https://k1h1a1n.fun/';
    private router = inject(Router);
    private location = inject(Location);

    protected title = 'Images';
    protected imgList: any[] = [];
    protected parentList: any[] = [];
    protected parentBreadcrumb: string[] = [];

    // pagination
    protected pageSize = 8; // show 8 cards per page (4 per row, 2 rows)
    protected currentPage = 1;

    // show a compact range of page buttons
    get pageRange(): number[] {
        const total = this.totalPages;
        const maxButtons = 7;
        let start = Math.max(1, this.currentPage - 3);
        let end = Math.min(total, start + maxButtons - 1);
        if (end - start + 1 < maxButtons) {
            start = Math.max(1, end - maxButtons + 1);
        }
        return Array.from({ length: end - start + 1 }, (_, i) => i + start);
    }

    ngOnInit(): void {
        const state = (history && (history.state as any)) || {};
        this.imgList = Array.isArray(state.imgList) ? state.imgList : [];
        this.parentList = Array.isArray(state.parentList) ? state.parentList : [];
        this.parentBreadcrumb = Array.isArray(state.breadcrumb) ? state.breadcrumb : [];
    }

    get totalPages(): number {
        return Math.max(1, Math.ceil(this.imgList.length / this.pageSize));
    }

    get pagedItems(): any[] {
        const start = (this.currentPage - 1) * this.pageSize;
        return this.imgList.slice(start, start + this.pageSize);
    }

    goTo(page: number): void {
        if (page < 1) page = 1;
        if (page > this.totalPages) page = this.totalPages;
        this.currentPage = page;
    }

    next(): void { this.goTo(this.currentPage + 1); }
    prev(): void { this.goTo(this.currentPage - 1); }

    backToList(): void {
        // navigate back to greetings with parent list and breadcrumb
        try {
            this.router.navigate(['/home/greetings'], { state: { greetingData: this.parentList, breadcrumb: this.parentBreadcrumb } });
        } catch (e) {
            this.location.back();
        }
    }
    getPreviewUrl(url: string): string {
        const lastSlashIndex = url.lastIndexOf('/');
        return this.dwnloadLinkPrefix + url.substring(0, lastSlashIndex + 1) + 'preview.png';
    }

    // prefer full-size image URL where available to avoid blurry previews
    resolveImageSrc(img: any): string {
        if (!img) return '';
        // explicit downloadUrl (usually full size)
        // if (img.downloadUrl) return img.downloadUrl;
        // // if the entry is a plain string it's likely a URL
        // const u = this.getImageUrl(img);
        // if (u) return u;
        // fallback to preview constructed from downloadUrl (if present)
        if (img.downloadUrl) return this.getPreviewUrl(img.downloadUrl);
        return '';
    }
    // helpers to support both string URLs and object entries
    getImageUrl(img: any): string {
        if (!img) return '';
        if (typeof img === 'string') return img;
        return img.url || img.src || img.path || img.image || '';
    }

    getImageId(img: any): string | null {
        if (!img) return null;
        if (typeof img === 'string') return null;
        return img.id || img.imageId || img.imgId || null;
    }

    getImageLang(img: any): string | null {
        if (!img) return null;
        if (typeof img === 'string') return null;
        return img.lang || img.language || img.locale || null;
    }
}
