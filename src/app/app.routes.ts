import { Routes } from "@angular/router";
import { authGuard } from "./guards/auth-guard";
import { Listing } from "./pages/listing/listing";
import { Greetings } from "./pages/greetings/greetings";
import { LoginComponent } from "./pages/login/login";
import { ImagePreview } from "./pages/greetings/image-preview.component";
import { Sync } from "./pages/sync/sync";
import { SyncListing } from "./pages/sync/sync-listing/sync-listing.component";
import { Setting } from "./pages/setting/setting";

export const routes: Routes = [
  { path: '', redirectTo: 'login', pathMatch: 'full' },
  { path: 'login', component: LoginComponent },
  { path: 'home/listing', component: Listing, canActivate: [authGuard] },
  { path: 'home/sync', component: Sync, canActivate: [authGuard] },
  { path: 'home/sync/:type', component: SyncListing, canActivate: [authGuard] },
  { path: 'home/settings', component: Setting, canActivate: [authGuard] },
  { path: 'home/greetings', component: Greetings, canActivate: [authGuard] },
  { path: 'home/greetings/images', component: ImagePreview, canActivate: [authGuard] },
  { path: '**', redirectTo: 'login' }
];