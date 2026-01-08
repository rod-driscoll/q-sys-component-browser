import { Routes } from '@angular/router';
import { MenuComponent } from './components/menu/menu.component';
import { CUSTOM_VIEW_ROUTES } from './custom-views';

export const routes: Routes = [
  {
    path: '',
    component: MenuComponent,
    pathMatch: 'full',
    title: 'Q-SYS Control System'
  },
  {
    path: 'browser',
    loadComponent: () => import('./components/qsys-browser/qsys-browser').then(m => m.QsysBrowser),
    title: 'Component Browser'
  },
  // Custom view routes
  ...CUSTOM_VIEW_ROUTES,
  // Catch-all redirect
  {
    path: '**',
    redirectTo: ''
  }
];
