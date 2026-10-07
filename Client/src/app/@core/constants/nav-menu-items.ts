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
    href: '/projects',
    title: 'Projekte',
    active: false,
    icon: 'projects',
  },
  {
    href: '/filiale-suchen',
    title: 'Filiale suchen',
    active: false,
    icon: 'search',
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
  {
    href: '/favorites',
    title: 'Favoriten',
    active: false,
    icon: 'favorite_filled',
    divider: true,
  },
  {
    href: '/contact',
    title: 'Kontakt',
    active: false,
    icon: 'envelope-filled',
    divider: true,
  },
];
