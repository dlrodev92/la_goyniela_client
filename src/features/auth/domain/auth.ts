import type { OAuthProviderId } from "./oauth";

export type User = {
  id: string;
  email: string;
  displayName: string;
  avatarUrl: string | null;
  isActive: boolean;
  /** System superadmin (not the group admin). Only gates UI; the backend enforces it. False when the API omits it. */
  isSuperadmin: boolean;
  /** Null: the backend does not currently return it. */
  createdAt: string | null;
};

export type Credentials = { email: string; password: string };
export type Registration = { displayName: string; email: string; password: string };
export type Session = { accessToken: string; user: User };

export interface AuthGateway {
  login(credentials: Credentials): Promise<Session>;
  register(registration: Registration): Promise<Session>;
  /** Exchanges a provider token (Google id_token or X access_token) for our session. */
  loginWithProvider(provider: OAuthProviderId, providerToken: string): Promise<Session>;
  currentUser(token: string): Promise<User>;
}

const PLACEHOLDER_EMAIL = /@x\.placeholder$/i;
/** X accounts get a synthetic email; never show it. */
export const displayEmail = (user: Pick<User, "email">): string | null =>
  PLACEHOLDER_EMAIL.test(user.email) ? null : user.email;
