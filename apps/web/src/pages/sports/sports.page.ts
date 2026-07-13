import { ROUTES } from '@rb/config/routes';
import { mountSectionPage } from '../shared/section-page';

export const mount = () => mountSectionPage({
  title: 'Sports',
  route: ROUTES.sports,
  table: 'sports_posts',
  emptyMessage: 'No sports posts yet.'
});
