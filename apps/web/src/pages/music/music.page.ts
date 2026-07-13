import { ROUTES } from '@rb/config/routes';
import { mountSectionPage } from '../shared/section-page';

export const mount = () => mountSectionPage({
  title: 'Music',
  route: ROUTES.music,
  table: 'music_tracks',
  emptyMessage: 'No tracks have been released.'
});
