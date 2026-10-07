import { InitialDataUser } from '@app/core/services/initializer.service';
import { ClientCompany } from '@app/@core/services/client-company.service';

export interface AppDataState {
  user: InitialDataUser | null;
  clientCompanies: ClientCompany[];
  // Add other app data properties here
  settings: any | null;
  loading: boolean;
  error: string | null;
  initialDataLoaded: boolean;
}

export const initialAppDataState: AppDataState = {
  user: null,
  clientCompanies: [],
  settings: null,
  loading: false,
  error: null,
  initialDataLoaded: false,
};
