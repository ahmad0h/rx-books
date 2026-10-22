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
  /** Key for Claude (AI suggestions). Empty = AI is switched off. */
  ANTHROPIC_API_KEY: string;
  /** Claude model for AI suggestions. */
  AI_MODEL: string;
  /** How hard the model thinks: low suits classification and keeps it fast and cheap. */
  AI_EFFORT: AiEffort;
}

export const AI_EFFORTS = ['low', 'medium', 'high'] as const;
export type AiEffort = (typeof AI_EFFORTS)[number];

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

  const aiModel = text(raw.AI_MODEL, '').trim() || 'claude-opus-5-5';
  if (!/^claude-[a-z0-9.-]+$/.test(aiModel)) {
    throw new Error('AI_MODEL must be a Claude model id, e.g. claude-opus-5-5');
  }
  const aiEffort = text(raw.AI_EFFORT, '').trim() || 'low';
  if (!(AI_EFFORTS as readonly string[]).includes(aiEffort)) {
    throw new Error(`AI_EFFORT must be one of ${AI_EFFORTS.join(', ')}`);
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
    ANTHROPIC_API_KEY: text(raw.ANTHROPIC_API_KEY, '').trim(),
    AI_MODEL: aiModel,
    AI_EFFORT: aiEffort as AiEffort,
  };
}
