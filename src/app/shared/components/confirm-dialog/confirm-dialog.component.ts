import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';

@Component({
  selector: 'app-confirm-dialog',
  templateUrl: './confirm-dialog.component.html',
  styleUrls: ['./confirm-dialog.component.scss'],
  standalone: true,
  imports: [CommonModule],
})
export class ConfirmDialogComponent {
  @Input() msg = 'Are you sure?';
  @Input() title = 'Confirm';
  @Input() show = false;
  @Output() decision = new EventEmitter<boolean>();

  yes(): void {
    this.decision.emit(true);
    this.show = false;
  }

  no(): void {
    this.decision.emit(false);
    this.show = false;
  }

  close(): void {
    this.no();
  }
}
