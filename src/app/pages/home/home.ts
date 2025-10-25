import { Component, inject } from '@angular/core';
import { AuthService } from '../../services/auth';

@Component({
  selector: 'app-home',
  imports: [],
  templateUrl: './home.html',
  styleUrl: './home.scss',
})
export class Home {
   categoryData = [
    // { name: 'Day Greetings' },
    { name: 'Greetings' },
    { name: 'Social Post' },
    { name: 'Brochures' }
  ];
  private auth = inject(AuthService);
  logout(): void {
    this.auth.logout();
  }
}
