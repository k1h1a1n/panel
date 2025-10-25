import { Routes } from "@angular/router";
import { authGuard } from "./guards/auth-guard";
import { Home } from "./pages/home/home";
import { LoginComponent } from "./pages/login/login";

export const routes: Routes = [
  { path: '', redirectTo: 'login', pathMatch: 'full' },
  { path: 'login', component: LoginComponent },
  { path: 'home', component: Home, canActivate: [authGuard] },
  { path: '**', redirectTo: 'login' }
];