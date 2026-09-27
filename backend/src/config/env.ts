export interface DatabaseEnv {
  DATABASE_URL: string;
  /** Use TLS for the database connection (production). Local Docker runs without TLS. */
  DATABASE_TLS: boolean;
}

export interface AppEnv extends DatabaseEnv {
  PORT: number;
  APP_VERSION: string;
  /** Secret used to sign session tokens. At least 32 characters. */
  JWT_SECRET: string;
  /** How long a sign-in lasts. */
  SESSION_HOURS: number;
  /** Send the session cookie over HTTPS only. Must be true in production. */
  COOKIE_SECURE: boolean;
  /** Create the demo admin and client users at start-up. Local development only. */
  DEMO_USERS_ENABLED: boolean;
  DEMO_ADMIN_EMAIL: string;
  DEMO_ADMIN_PASSWORD: string;
  DEMO_CLIENT_EMAIL: string;
  DEMO_CLIENT_PASSWORD: string;
}

/** Environment values arrive as strings; anything else is treated as unset. */
function text(value: unknown, fallback: string): string {
  return typeof value === 'string' ? value : fallback;
}

function flag(value: unknown, fallback: boolean): boolean {
  return text(value, String(fallback)).trim().toLowerCase() === 'true';
}

function integer(
  value: unknown,
  fallback: number,
  name: string,
  min: number,
  max: number,
): number {
  const parsed = Number(text(value, String(fallback)));
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
    throw new Error(`${name} must be a whole number between ${min} and ${max}`);
  }
  return parsed;
}

/** Database settings only (also used by the TypeORM command-line tools). */
export function validateDatabaseEnv(raw: Record<string, unknown>): DatabaseEnv {
  const databaseUrl = text(raw.DATABASE_URL, '').trim();
  if (!databaseUrl) {
    throw new Error(
      'DATABASE_URL is required, e.g. mysql://user:password@host:3306/rxbooks',
    );
  }
  let parsed: URL;
  try {
    parsed = new URL(databaseUrl);
  } catch {
    throw new Error('DATABASE_URL is not a valid URL');
  }
  if (parsed.protocol !== 'mysql:') {
    throw new Error('DATABASE_URL must start with mysql://');
  }
  return {
    DATABASE_URL: databaseUrl,
    DATABASE_TLS: flag(raw.DATABASE_TLS, false),
  };
}

/**
 * Validates environment variables once at start-up, so a missing or malformed
 * setting stops the app immediately instead of failing on the first request.
 */
export function validateEnv(raw: Record<string, unknown>): AppEnv {
  const jwtSecret = text(raw.JWT_SECRET, '');
  if (jwtSecret.length < 32) {
    throw new Error(
      'JWT_SECRET is required and must be at least 32 characters',
    );
  }

  const demoUsersEnabled = flag(raw.DEMO_USERS_ENABLED, false);
  const demoAdminPassword = text(raw.DEMO_ADMIN_PASSWORD, '');
  const demoClientPassword = text(raw.DEMO_CLIENT_PASSWORD, '');
  if (
    demoUsersEnabled &&
    (demoAdminPassword.length < 12 || demoClientPassword.length < 12)
  ) {
    throw new Error(
      'DEMO_ADMIN_PASSWORD and DEMO_CLIENT_PASSWORD need at least 12 characters',
    );
  }

  return {
    ...validateDatabaseEnv(raw),
    PORT: integer(raw.PORT, 3000, 'PORT', 1, 65535),
    APP_VERSION: text(raw.APP_VERSION, '0.1.0-dev'),
    JWT_SECRET: jwtSecret,
    SESSION_HOURS: integer(raw.SESSION_HOURS, 8, 'SESSION_HOURS', 1, 72),
    COOKIE_SECURE: flag(raw.COOKIE_SECURE, false),
    DEMO_USERS_ENABLED: demoUsersEnabled,
    DEMO_ADMIN_EMAIL: text(raw.DEMO_ADMIN_EMAIL, 'admin@rxbooks.test'),
    DEMO_ADMIN_PASSWORD: demoAdminPassword,
    DEMO_CLIENT_EMAIL: text(raw.DEMO_CLIENT_EMAIL, 'client@rxbooks.test'),
    DEMO_CLIENT_PASSWORD: demoClientPassword,
  };
}
