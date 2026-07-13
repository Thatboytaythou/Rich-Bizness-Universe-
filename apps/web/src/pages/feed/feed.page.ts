import { ROUTES } from '@rb/config/routes';
import { mountSectionPage } from '../shared/section-page';

export const mount = () => mountSectionPage({ title: 'Feed', route: ROUTES.feed, table: 'feed_posts', emptyMessage: 'No feed posts yet.' });
