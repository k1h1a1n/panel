import { CommonModule, Location } from '@angular/common';
import { Component, inject, OnInit, signal } from '@angular/core';
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
    protected pageSize = 5;
    protected currentPage = signal(1);

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

    ngOnInit(): void {
        const state = (history && (history.state as any)) || {};
        this.imgList = Array.isArray(state.imgList) ? state.imgList : [];
        this.parentList = Array.isArray(state.parentList) ? state.parentList : [];
        this.parentBreadcrumb = Array.isArray(state.breadcrumb) ? state.breadcrumb : [];
        const incomingTitle = state.title || 'Images';
        this.title = incomingTitle;
    }

    get totalPages(): number {
        return Math.max(1, Math.ceil(this.imgList.length / this.pageSize));
    }

    get paginatedImages(): any[] {
        const start = (this.currentPage() - 1) * this.pageSize;
        return this.imgList.slice(start, start + this.pageSize);
    }

    protected goToPage(page: number): void {
        if (page >= 1 && page <= this.totalPages) {
            this.currentPage.set(page);
        }
    }

    backToList(): void {
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

    resolveImageSrc(img: any): string {
        if (!img) return '';
        if (img.downloadUrl) return this.getPreviewUrl(img.downloadUrl);
        return '';
    }

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

    protected getImageSrc(image: any): string {
        return this.resolveImageSrc(image);
    }
}
