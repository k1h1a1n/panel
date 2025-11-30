import { Component, signal, inject } from '@angular/core';
import { RouterOutlet, Router, NavigationEnd } from '@angular/router';
import { NgIf } from '@angular/common';
import { LoaderComponent } from './pages/loader/loader';
import { Sidebar } from './layout/sidebar/sidebar';
import { Header } from './layout/header/header';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, LoaderComponent, Sidebar, Header, NgIf],
  template: `
    <ng-container *ngIf="showLayout">
      <app-header></app-header>
      <app-sidebar></app-sidebar>
    </ng-container>

    <main [class.content]="showLayout" [class.fullpage]="!showLayout">
      <app-loader></app-loader>
      <router-outlet></router-outlet>
    </main>
  `,
  styleUrl: './app.scss'
})
export class App {
  protected readonly title = signal('panel');
  private router = inject(Router);
  showLayout = true;

  constructor() {
    // initial value
    this.updateLayout(this.router.url);
    // hide header/sidebar on login route (and any child routes)
    this.router.events.subscribe((ev) => {
      if (ev instanceof NavigationEnd) {
        this.updateLayout(ev.urlAfterRedirects || ev.url);
      }
    });
  }

  private updateLayout(url: string): void {
    this.showLayout = !url.startsWith('/login');
  }
}
