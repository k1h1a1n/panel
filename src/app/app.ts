import { Component, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { LoaderComponent } from './pages/loader/loader';

@Component({
  selector: 'app-root',
 imports: [RouterOutlet, LoaderComponent], // ✅ include LoaderComponent here
  template: `
    <app-loader></app-loader>
    <router-outlet></router-outlet>
  `,
  styleUrl: './app.scss'
})
export class App {
  protected readonly title = signal('panel');
}
