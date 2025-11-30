import { Injectable, inject } from '@angular/core';
import { HttpInterceptor, HttpRequest, HttpHandler, HttpEvent, HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { finalize, catchError } from 'rxjs/operators';
import { LoaderService } from '../services/loader.service';

/**
 * Class-based interceptor for legacy use or dependency injection
 */
@Injectable()
export class LoaderInterceptor implements HttpInterceptor {
    private loaderService = inject(LoaderService);

    intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
        this.loaderService.show();

        return next.handle(req).pipe(
            finalize(() => {
                this.loaderService.hide();
            }),
            catchError((error: HttpErrorResponse) => {
                const errorMsg = error.error?.message || error.message || 'An error occurred';
                console.error('[LoaderInterceptor] API error:', error);
                this.loaderService.setError(errorMsg);
                return throwError(() => error);
            })
        );
    }
}

/**
 * Functional interceptor for use with provideHttpClient
 */
export const loaderInterceptor: HttpInterceptorFn = (req, next) => {
    console.log('[loaderInterceptor] Intercepted request to:', req.url);
    const loaderService = inject(LoaderService);
    loaderService.show();

    return next(req).pipe(
        finalize(() => {
            loaderService.hide();
        }),
        catchError((error: HttpErrorResponse) => {
            const errorMsg = error.error?.message || error.message || 'An error occurred';
            console.error('[loaderInterceptor] API error:', error);
            loaderService.setError(errorMsg);
            return throwError(() => error);
        })
    );
};
