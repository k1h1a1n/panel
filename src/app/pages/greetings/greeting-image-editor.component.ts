import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { ConfirmDialogComponent } from '../../shared/components/confirm-dialog/confirm-dialog.component';

@Component({
  selector: 'app-greeting-image-editor',
  templateUrl: './greeting-image-editor.html',
  styleUrl: './greeting-image-editor.scss',
  imports: [CommonModule, ConfirmDialogComponent],
})
export class GreetingImageEditor {
  @Input() image: any = null; // expects object with id, imagePreviewUrl, downloadUrl, lang, enabled
  @Output() updated = new EventEmitter<any>();
  @Output() deleted = new EventEmitter<any>();
  @Output() closed = new EventEmitter<void>();

  // language mapping for dropdown
  public languages = [
    { code: 'HI', label: 'Hindi' },
    { code: 'EN', label: 'English' },
    { code: 'MR', label: 'Marathi' },
    { code: 'OT', label: 'Other' },
  ];

  close(): void {
    this.closed.emit();
  }

  private dwnloadLinkPrefix = 'https://k1h1a1n.fun/';

  protected getPreviewUrl(url?: string): string {
    if (!url) return '';
    const lastSlashIndex = url.lastIndexOf('/');
    return this.dwnloadLinkPrefix + url.substring(0, lastSlashIndex + 1) + 'preview.png';
  }

  // Confirm dialog state
  protected confirmShow = false;
  protected confirmMsg = '';
  protected confirmTitle = 'Confirm';
  private pendingAction: 'language' | 'enabled' | 'delete' | null = null;
  private pendingPayload: any = null;

  protected requestConfirm(action: 'language' | 'enabled' | 'delete', msg: string, payload?: any) {
    this.pendingAction = action;
    this.pendingPayload = payload;
    this.confirmMsg = msg;
    this.confirmTitle = 'Confirm';
    this.confirmShow = true;
  }

  protected onConfirmDecision(result: boolean) {
    this.confirmShow = false;
    if (!result) {
      this.pendingAction = null;
      this.pendingPayload = null;
      return;
    }

    // if yes, perform action
    if (this.pendingAction === 'language') {
      const code = this.pendingPayload as string;
      if (this.image) {
        this.image.lang = code;
        this.changeLanguageApi(code, this.image);
        this.updated.emit({ type: 'language', image: this.image });
      }
    } else if (this.pendingAction === 'enabled') {
      if (this.image) {
        this.image.enabled = !!this.pendingPayload;
        this.enableDisableApi(this.image.enabled, this.image);
        this.updated.emit({ type: 'enabled', image: this.image });
      }
    } else if (this.pendingAction === 'delete') {
      if (this.image) {
        this.deleteImageApi(this.image);
        this.deleted.emit(this.image);
      }
    }

    this.pendingAction = null;
    this.pendingPayload = null;
  }

  onLanguageSelect(code: string): void {
    if (!this.image) return;
    // ask for confirmation via custom dialog
    this.requestConfirm('language', `Change language to ${code}?`, code);
  }

  toggleEnabled(): void {
    if (!this.image) return;
    const action = this.image.enabled ? 'disable' : 'enable';
    const desired = !this.image.enabled;
    this.requestConfirm('enabled', `Are you sure you want to ${action} this image?`, desired);
  }

  onDelete(): void {
    if (!this.image) return;
    this.requestConfirm('delete', 'Are you sure you want to delete this image? This action cannot be undone.', null);
  }

  // API stubs - implement actual API calls here
  private changeLanguageApi(code: string, image: any): void {
    // TODO: call backend to update language
    console.log('changeLanguageApi stub', code, image);
  }

  private enableDisableApi(enabled: boolean, image: any): void {
    // TODO: call backend to enable/disable image
    console.log('enableDisableApi stub', enabled, image);
  }

  private deleteImageApi(image: any): void {
    // TODO: call backend to delete image
    console.log('deleteImageApi stub', image);
  }
}
