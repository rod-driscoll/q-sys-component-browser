import { Routes } from '@angular/router';
import { MenuComponent } from './components/menu/menu.component';
import { QsysBrowser } from './components/qsys-browser/qsys-browser';
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
    component: QsysBrowser,
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
