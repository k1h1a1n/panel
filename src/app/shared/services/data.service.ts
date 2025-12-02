import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class SharedApiService {
  private http = inject(HttpClient);

  private get runtimeConfig() {
    return (window as any).__RUNTIME_CONFIG__ || { apiBaseUrl: '/api' };
  }

  getCategoryData(category?: string): Observable<any> {
    const url = `${this.runtimeConfig.apiBaseUrl}/api/${category}`;
    const headers = new HttpHeaders({
      'Content-Type': 'application/json'
    });
    return this.http.get(url, { headers });
  }

  getSocialPost(): Observable<any> {
    const url = `${this.runtimeConfig.intrasoftApiUrl}/devicetemplate/VBZ1/Coupons.json`;
    const headers = new HttpHeaders({
      'Content-Type': 'application/json'
    });
    return this.http.get(url, { headers });
  }

  getGreetings(): Observable<any> {
    const url = `${this.runtimeConfig.intrasoftApiUrl}/devicetemplate/VBZ1/Greetings.json`;
    const headers = new HttpHeaders({
      'Content-Type': 'application/json'
    });
    return this.http.get(url, { headers });
  }

  getBrochures(): Observable<any> {
    const url = `${this.runtimeConfig.intrasoftApiUrl}/devicetemplate/VBZ1/Brochures.json`;
    const headers = new HttpHeaders({
      'Content-Type': 'application/json'
    });
    return this.http.get(url, { headers });
  }

  getImageListPage(queryParams: { [key: string]: string }): Observable<any> {
    const params = new URLSearchParams();

    Object.keys(queryParams).forEach(key => {
      params.append(key, queryParams[key]);
    });

    const url = `${this.runtimeConfig.intrasoftApiUrl}/apidevicetemplate/getmore.php?${params.toString()}`;
    // response is HTML, so specify responseType as 'text' to avoid JSON parsing errors
    return this.http.get(url, { responseType: 'text' });
  }

  covertToHex(input : string) :string { 
    let hexResult = '';
    for (let i = 0; i < input.length; i++) {
        hexResult += input.charCodeAt(i).toString(16).padStart(2, '0');
    }
    return hexResult;
  }
}
