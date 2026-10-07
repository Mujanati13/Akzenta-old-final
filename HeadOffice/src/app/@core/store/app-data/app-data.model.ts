import { InitialDataUser } from '@app/core/services/initializer.service';
import { ClientCompany } from '@app/core/services/client-company.service'; // Import from client-company service

export interface AppDataState {
  user: InitialDataUser | null;
  clientCompanies: ClientCompany[];
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
