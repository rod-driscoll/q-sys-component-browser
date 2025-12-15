import { Component, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { QsysExample } from './components/qsys-example/qsys-example';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, QsysExample],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {
  protected readonly title = signal('q-sys-angular-components');
}
