import { Routes } from "@angular/router";
import { authGuard } from "./guards/auth-guard";
import { Listing } from "./pages/listing/listing";
import { LoginComponent } from "./pages/login/login";

export const routes: Routes = [
  { path: '', redirectTo: 'login', pathMatch: 'full' },
  { path: 'login', component: LoginComponent },
  { path: 'home/listing', component: Listing, canActivate: [authGuard] },
  { path: '**', redirectTo: 'login' }
];