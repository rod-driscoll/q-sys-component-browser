import { CustomViewMetadata } from '../../models/custom-view.model';

export const ROOM_CONTROLS_METADATA: CustomViewMetadata = {
  title: 'Room Controls',
  description: 'Full room control interface with source selection, cameras, volume, and system power',
  icon: '🏢',
  route: 'room-controls',
  requiredComponents: ['UCI Text Helper'],
  order: 5
};
