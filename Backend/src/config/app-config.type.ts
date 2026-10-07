export type AppConfig = {
  nodeEnv: string;
  name: string;
  workingDirectory: string;
  frontendDomain?: string;
  merchandiserFrontendDomain?: string;
  clientFrontendDomain?: string;
  corsAllowedOrigins?: string;
  corsTrustedHostSuffix?: string;
  backendDomain: string;
  port: number;
  apiPrefix: string;
  fallbackLanguage: string;
  headerLanguage: string;
};
