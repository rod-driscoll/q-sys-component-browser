import { Component, signal, ViewChild, AfterViewInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { QsysBrowser } from './components/qsys-browser/qsys-browser';

// Expose browser component globally for MCP tool integration
declare global {
  interface Window {
    qsysBrowser?: QsysBrowser;
  }
}

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, QsysBrowser],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App implements AfterViewInit {
  protected readonly title = signal('q-sys-angular-components');

  @ViewChild(QsysBrowser) browserComponent?: QsysBrowser;

  ngAfterViewInit(): void {
    // Expose browser component globally so MCP tools can call its methods
    if (this.browserComponent) {
      window.qsysBrowser = this.browserComponent;
      console.log('Browser component exposed on window.qsysBrowser');
      console.log('You can now call:');
      console.log('  window.qsysBrowser.setComponentsFromMCP(componentsArray)');
      console.log('  window.qsysBrowser.setControlsFromMCP(controlsArray)');
    }
  }
}
