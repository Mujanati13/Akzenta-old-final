import { PERMISSIONS } from '../../auth/enums/permissions.enum';
import { NavMenuItem } from '@core/interfaces';
import { ROLE } from '../../auth/enums/roles.enum';

// THIS FILE CONTAINS THE NAVIGATION MENU ITEMS FOR THE SIDEBAR AND ALL OTHER NAVIGATION MENUS WHICH ARE USED IN THE APPLICATION AND ARE CONSTANT

/**
 * Navigation menu items for WEB Sidebar
 */
export const webSidebarMenuItems: NavMenuItem[] = [
  {
    href: '/dashboard',
    title: 'Dashboard',
    active: true,
    icon: 'dashboard',
  },
  {
    href: '/clients',
    title: 'Kunden',
    active: false,
    icon: 'clients',
  },
  {
    href: '/filiale-suchen',
    title: 'Filiale suchen',
    active: false,
    icon: 'search',
  },
  {
    href: '/users',
    title: 'Benutzer',
    active: false,
    icon: 'users',
    // permissions: [PERMISSIONS.ACCESS_USER],
    // Restrict to admin role
    roles: [ROLE.ADMIN],
  },
  {
    href: '/staff',
    title: 'Personal',
    active: false,
    icon: 'incognito',
  },
  {
    href: '/favorites',
    title: 'Favoriten',
    active: false,
    icon: 'favorite_filled',
    divider: true,
  },
  {
    href: '/notifications',
    title: 'Neuigkeiten',
    active: false,
    icon: 'notifications',
    divider: true,
    tag: true,
  },
];
