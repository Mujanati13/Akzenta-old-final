import { NavMenuItem } from '@core/interfaces';

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
    href: '/all-entries',
    title: 'All Entries',
    active: false,
    icon: 'see_all',
  },
  {
    href: '/clients',
    title: 'Clients',
    active: false,
    icon: 'clients',
  },
  {
    href: '/anfragen',
    title: 'Requests',
    active: false,
    icon: 'question',
    divider: true,
  },
  {
    href: '/notifications',
    title: 'News',
    active: false,
    icon: 'notifications',
    divider: true,
    tag: true,
  },
  {
    href: '/favorites',
    title: 'Favorites',
    active: false,
    icon: 'favorite_filled',
    divider: true,
  },
];
