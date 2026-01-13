import { CustomViewMetadata } from '../../models/custom-view.model';

/**
 * Metadata for Named Controls custom view
 */
export const NAMED_CONTROLS_METADATA: CustomViewMetadata = {
  title: 'Named Controls',
  description: 'Quick access to named controls defined in ExternalControls.xml',
  icon: '🎛️',
  route: 'named-controls',
  order: 8,
  requiredComponents: []
};
