import { ROLE } from '@app/auth';

export interface NavMenuItem {
  title: string;
  href: string;
  icon?: string;
  url?: string;
  active?: boolean;
  subItems?: NavMenuItem[];
  disabled?: boolean;
  divider?: boolean;
  roles?: ROLE[];
  tag?: boolean | string | number;
}
