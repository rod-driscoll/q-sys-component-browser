import { CustomViewMetadata } from '../../models/custom-view.model';

/**
 * Metadata for Lighting Controls custom view
 */
export const LIGHTING_CONTROLS_METADATA: CustomViewMetadata = {
  title: 'Lighting Controls',
  description: 'Control lighting zones and scenes',
  icon: '💡',
  route: 'lighting-controls',
  order: 3,
  requiredComponents: ['LightingPresets']
};
