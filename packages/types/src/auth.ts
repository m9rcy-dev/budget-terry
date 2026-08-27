export interface AuthenticatedUser {
  id: string;
  email: string;
  displayName: string;
  onboardingCompletedAt: string | null;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface AuthResponse extends AuthTokens {
  user: AuthenticatedUser;
  /** Only present when the caller opted into "remember this device" and
   * the call succeeded — see docs/trusted-device-plan.md. */
  deviceTrustToken?: string;
}
