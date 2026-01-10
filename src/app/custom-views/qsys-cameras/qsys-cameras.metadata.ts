import { CustomViewMetadata } from '../../models/custom-view.model';

/**
 * Metadata for Q-SYS ONVIF Cameras custom view
 * This view automatically discovers and controls all ONVIF camera components
 */
export const QSYS_CAMERAS_METADATA: CustomViewMetadata = {
  title: 'Q-SYS Cameras',
  description: 'Control ONVIF cameras with pan, tilt, and zoom',
  icon: '📷',
  route: 'qsys-cameras',
  order: 4,
  requiredComponents: [] // No specific components required - discovers all onvif_camera_operative types
};
