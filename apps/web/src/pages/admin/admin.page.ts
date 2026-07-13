import { ROUTES } from '@rb/config/routes';
import { mountSectionPage } from '../shared/section-page';

export const mount = () => mountSectionPage({
  title: 'Admin',
  route: ROUTES.admin,
  table: 'admin_audit_logs',
  emptyMessage: 'No activity records are available.'
});
