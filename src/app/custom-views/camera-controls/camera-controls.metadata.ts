import { CustomViewMetadata } from '../../models/custom-view.model';

/**
 * Metadata for Camera Controls custom view
 */
export const CAMERA_CONTROLS_METADATA: CustomViewMetadata = {
  title: 'Camera Controls',
  description: 'Control PTZ cameras with directional arrows',
  icon: '📹',
  route: 'camera-controls',
  order: 3,
  requiredComponents: ['Cameras']
};
