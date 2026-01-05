/**
 * Core models and interfaces for the custom view system
 */

/**
 * Metadata describing a custom view for registration and menu display
 */
export interface CustomViewMetadata {
  /** Display title for the view */
  title: string;

  /** Description shown on the menu card */
  description: string;

  /** Unicode emoji icon for the menu card */
  icon: string;

  /** Route path for navigation (e.g., 'volume-controls') */
  route: string;

  /** Optional badge text (e.g., 'New', 'Beta') */
  badge?: string;

  /** Sort order for menu display (lower numbers appear first) */
  order?: number;
}

/**
 * Menu card data structure for rendering navigation cards
 */
export interface MenuCard {
  /** Display title for the card */
  title: string;

  /** Description text shown on the card */
  description: string;

  /** Unicode emoji icon */
  icon: string;

  /** Route to navigate to when card is clicked */
  route: string;

  /** Optional badge text */
  badge?: string;
}

/**
 * Control selection strategies for custom views
 */
export interface ControlSelectionConfig {
  /** Selection method to use */
  method: 'componentPattern' | 'controlType' | 'componentType' | 'explicitList';

  /** Regex pattern for matching component names (for 'componentPattern' method) */
  componentPattern?: string;

  /** Regex pattern for matching control names within matched components */
  controlPattern?: string;

  /** Control type to filter for (e.g., 'Knob', 'Boolean') (for 'controlType' method) */
  controlType?: string;

  /** Component type to filter for (e.g., 'gain', 'display') (for 'componentType' method) */
  componentType?: string;

  /** Explicit list of components and their controls (for 'explicitList' method) */
  components?: Array<{
    /** Component name */
    component: string;
    /** Optional list of specific control names. If omitted, all controls are included */
    controls?: string[];
  }>;
}

/**
 * Configuration for a custom view
 * Used for config-driven view definitions
 */
export interface CustomViewConfig {
  /** View title */
  title: string;

  /** Optional description */
  description?: string;

  /** Array of control selection configurations to apply */
  controlSelection: ControlSelectionConfig[];

  /** Layout mode for displaying controls */
  layout?: 'grid' | 'list' | 'compact';

  /** How to group controls in the view */
  groupBy?: 'component' | 'type' | 'none';
}
