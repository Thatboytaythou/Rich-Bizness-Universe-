import { ROUTES } from '@rb/config/routes';
import { mountSectionPage } from '../shared/section-page';

export const mount = () => mountSectionPage({
  title: 'Creator',
  route: ROUTES.creator,
  table: 'creator_page_settings',
  emptyMessage: 'Creator setup has not been completed.'
});
