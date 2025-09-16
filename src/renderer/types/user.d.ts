export interface User {
  id: string;
  username: string;
  firstname?: string;
  lastname?: string;
  fullname: string;
  email: string;
  sitename?: string;
  siteurl?: string;
}

export interface AuthenticationState {
  isAuthenticated: boolean;
  isInitialized: boolean; // Track if auth state has been loaded from persistence
  user: User | null;
  authMethod: 'moodle' | null;
  lastAuthCheck: string | null;
}
