import { Component, inject } from '@angular/core';
import { AuthService } from '../../services/auth';

@Component({
  selector: 'app-header',
  templateUrl: './header.html',
  styleUrl: './header.scss',
  imports: [],
})
export class Header {
  private auth = inject(AuthService);

  logout(): void {
    this.auth.logout();
  }

  onProfile(): void {
    // placeholder - navigate to profile if needed
  }
}
