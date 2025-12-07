import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output, OnChanges, SimpleChanges } from '@angular/core';
import { ConfirmDialogComponent } from '../../../shared/components/confirm-dialog/confirm-dialog.component';

@Component({
    selector: 'app-sync-image-modal',
    standalone: true,
    templateUrl: './sync-image-modal.html',
    styleUrl: './sync-image-modal.scss',
    imports: [CommonModule, ConfirmDialogComponent],
})
export class SyncImageModalComponent implements OnChanges {
    @Input() image: any = null;
    @Input() visible = false;
    @Output() closed = new EventEmitter<void>();
    @Output() languageChange = new EventEmitter<{ lang: string; image: any }>();
    @Output() sync = new EventEmitter<any>();

    languages = [
        { code: 'EN', label: 'English' },
        { code: 'HI', label: 'Hindi' },
        { code: 'MR', label: 'Marathi' },
        { code: 'OT', label: 'Other' },
    ];

    protected confirmShow = false;
    protected confirmMsg = '';
    protected confirmTitle = 'Confirm';
    private pendingAction: 'language' | 'sync' | null = null;
    private pendingPayload: any = null;

    close(): void {
        this.closed.emit();
    }

    ngOnChanges(changes: SimpleChanges): void {
        if (changes['image'] && this.image) {
            // ensure default language is English when none provided
            if (!this.image.lang) {
                this.image.lang = 'EN';
            }
        }
    }

    get imagePreviewUrl(): string {
        if (!this.image) return '';
        return this.image.link || this.image.preview || '';
    }

    startLanguageChange(code: string): void {
        if (!this.image) return;
        this.requestConfirm('language', `Change language to ${code}?`, code);
    }

    startSync(): void {
        if (!this.image) return;
        this.requestConfirm('sync', 'Sync this image?', this.image);
    }

    protected onConfirmDecision(result: boolean): void {
        this.confirmShow = false;
        if (!result) {
            this.pendingAction = null;
            this.pendingPayload = null;
            return;
        }

        if (this.pendingAction === 'language') {
            const code = this.pendingPayload as string;
            this.languageChange.emit({ lang: code, image: this.image });
        } else if (this.pendingAction === 'sync') {
            this.sync.emit(this.image);
        }

        this.pendingAction = null;
        this.pendingPayload = null;
    }

    private requestConfirm(action: 'language' | 'sync', msg: string, payload: any): void {
        this.pendingAction = action;
        this.pendingPayload = payload;
        this.confirmMsg = msg;
        this.confirmTitle = 'Confirm';
        this.confirmShow = true;
    }
}
