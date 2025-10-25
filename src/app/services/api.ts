import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { finalize, Observable } from 'rxjs';
import { LoaderService } from './../services/loader';

@Injectable({
  providedIn: 'root'
})
export class ApiService {

  constructor(
    private http: HttpClient,
    private loaderService: LoaderService
  ) {}

  getCategoryData(category?: string): Observable<any> {
    this.loaderService.show();
    const url = `${environment.apiUrl}/api/${category ?? ''}`;
    return this.http.get(url, {
      headers: { 'Content-Type': 'application/json' }
    }).pipe(
      finalize(() => this.loaderService.hide()) // hides loader whether success or error
    );
  }
}
