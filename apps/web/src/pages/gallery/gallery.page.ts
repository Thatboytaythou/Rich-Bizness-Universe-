import { ROUTES } from '@rb/config/routes';
import { mountSectionPage } from '../shared/section-page';

export const mount = () => mountSectionPage({
  title: 'Gallery',
  route: ROUTES.gallery,
  table: 'feed_posts',
  section: 'gallery',
  emptyMessage: 'No gallery drops yet.'
});
