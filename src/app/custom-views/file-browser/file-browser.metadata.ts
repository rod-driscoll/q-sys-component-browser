import { CustomViewMetadata } from '../../models/custom-view.model';

/**
 * Metadata for File Browser custom view
 */
export const FILE_BROWSER_METADATA: CustomViewMetadata = {
  title: 'File Browser',
  description: 'Browse and manage files on the Q-SYS Core file system',
  icon: '📁',
  route: 'file-browser',
  order: 7,
  requiredComponents: ['WebSocketRelay']
};
