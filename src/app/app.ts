import { Component, signal, inject } from '@angular/core';
import { LoaderService } from './shared/services/loader.service';
import { RouterOutlet, Router, NavigationEnd } from '@angular/router';
import { Sidebar } from './layout/sidebar/sidebar';
import { Header } from './layout/header/header';
import { CommonModule } from '@angular/common';
import { PulseLoaderComponent } from './shared/components/pulse-loader/pulse-loader.component';
import { ErrorToastComponent } from './shared/components/error-toast/error-toast.component';
import { SuccessToastComponent } from './shared/components/success-toast/success-toast.component';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, Sidebar, Header, CommonModule, PulseLoaderComponent, ErrorToastComponent, SuccessToastComponent],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App {
  protected readonly title = signal('panel');
  private router = inject(Router);
  private loaderService = inject(LoaderService);
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

  loaderIsLoading(): boolean {
    return this.loaderService.isLoading();
  }

  loaderError(): string | null {
    return this.loaderService.errorMessage();
  }
}
