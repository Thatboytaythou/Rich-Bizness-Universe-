import { ROUTES } from '@rb/config/routes';
import { mountSectionPage } from '../shared/section-page';

export const mount = () => mountSectionPage({
  title: 'Live',
  route: ROUTES.live,
  table: 'live_streams',
  emptyMessage: 'No live streams are active.'
});
