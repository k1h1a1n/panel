import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface GreetingPayload {
  imageId: string;
  mainCategory: string;
  subcategory?: string;
  downloadUrl: string;
  prevImgUrl: string;
  eventDate?: string | null; // ISO string or yyyy-mm-dd
  isVisible?: number;
  language?: string;
}

@Injectable({ providedIn: 'root' })
export class CrudService {
  private http = inject(HttpClient);

  private get runtimeConfig() {
    return (window as any).__RUNTIME_CONFIG__ || { apiBaseUrl: '/api' };
  }

  private get baseUrl(): string {
    const api = this.runtimeConfig.apiBaseUrl || '/api';
    return api.replace(/\/$/, '');
  }

  private get defaultHeaders(): HttpHeaders {
    return new HttpHeaders({ 'Content-Type': 'application/json' });
  }

  create(payload: GreetingPayload , tablename : string): Observable<any> {
    const url = `${this.baseUrl}/api/${tablename}`;
    return this.http.post(url, payload, { headers: this.defaultHeaders });
  }

  delete(id: string | number, tablename: string): Observable<any> {
    const url = `${this.baseUrl}/api/${tablename}/${id}`;
    return this.http.delete(url, { headers: this.defaultHeaders });
  }

  update(id: string | number, payload: GreetingPayload, tablename: string): Observable<any> {
    const url = `${this.baseUrl}/api/${tablename}/${id}`;
    return this.http.put(url, payload, { headers: this.defaultHeaders });
  }
}
