import { Injectable, signal } from '@angular/core';
import { CustomViewMetadata } from '../models/custom-view.model';

/**
 * Service for managing registered custom views
 * Used by the menu component to dynamically build navigation cards
 */
@Injectable({
  providedIn: 'root'
})
export class CustomViewRegistryService {
  private views = signal<CustomViewMetadata[]>([]);

  /**
   * Read-only signal of all registered views, sorted by order
   */
  readonly registeredViews = this.views.asReadonly();

  /**
   * Register multiple custom views
   * Views are automatically sorted by order property (lower numbers first)
   * @param metadata Array of view metadata to register
   */
  registerViews(metadata: CustomViewMetadata[]): void {
    const sorted = [...metadata].sort((a, b) => (a.order ?? 999) - (b.order ?? 999));
    this.views.set(sorted);
    console.log(`✓ Registered ${sorted.length} custom views:`, sorted.map(v => v.title));
  }

  /**
   * Get view metadata by route
   * @param route Route path to search for
   * @returns View metadata if found, undefined otherwise
   */
  getViewByRoute(route: string): CustomViewMetadata | undefined {
    return this.views().find(v => v.route === route);
  }

  /**
   * Get all registered view routes
   * @returns Array of route paths
   */
  getAllRoutes(): string[] {
    return this.views().map(v => v.route);
  }
}
