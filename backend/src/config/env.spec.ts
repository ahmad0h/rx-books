import { validateDatabaseEnv, validateEnv } from './env.js';

describe('validateEnv', () => {
  const valid = {
    DATABASE_URL: 'mysql://rxbooks:secret@mysql:3306/rxbooks',
    JWT_SECRET: 'x'.repeat(32),
  };

  it('accepts a valid configuration and applies defaults', () => {
    expect(validateEnv(valid)).toEqual({
      DATABASE_URL: valid.DATABASE_URL,
      DATABASE_TLS: false,
      PORT: 3000,
      APP_VERSION: '0.1.0-dev',
      JWT_SECRET: valid.JWT_SECRET,
      SESSION_HOURS: 8,
      COOKIE_SECURE: false,
      DEMO_USERS_ENABLED: false,
      DEMO_ADMIN_EMAIL: 'admin@rxbooks.test',
      DEMO_ADMIN_PASSWORD: '',
      DEMO_CLIENT_EMAIL: 'client@rxbooks.test',
      DEMO_CLIENT_PASSWORD: '',
      ANTHROPIC_API_KEY: '',
      AI_MODEL: 'claude-opus-5-5',
      AI_EFFORT: 'low',
    });
  });

  it('reads the AI settings and rejects bad ones', () => {
    expect(
      validateEnv({
        ...valid,
        ANTHROPIC_API_KEY: ' sk-test ',
        AI_MODEL: 'claude-sonnet-5-5',
        AI_EFFORT: 'medium',
      }),
    ).toMatchObject({
      ANTHROPIC_API_KEY: 'sk-test',
      AI_MODEL: 'claude-sonnet-5-5',
      AI_EFFORT: 'medium',
    });
    expect(() => validateEnv({ ...valid, AI_MODEL: 'gpt-5' })).toThrow(
      /AI_MODEL/,
    );
    expect(() => validateEnv({ ...valid, AI_EFFORT: 'max' })).toThrow(
      /AI_EFFORT/,
    );
  });

  it('reads optional settings when set', () => {
    const env = validateEnv({
      ...valid,
      PORT: '4000',
      DATABASE_TLS: 'TRUE',
      COOKIE_SECURE: 'true',
      SESSION_HOURS: '12',
      APP_VERSION: '1.2.3',
    });
    expect(env).toMatchObject({
      PORT: 4000,
      DATABASE_TLS: true,
      COOKIE_SECURE: true,
      SESSION_HOURS: 12,
      APP_VERSION: '1.2.3',
    });
  });

  it('rejects a missing or short JWT_SECRET', () => {
    expect(() => validateEnv({ DATABASE_URL: valid.DATABASE_URL })).toThrow(
      'JWT_SECRET',
    );
    expect(() => validateEnv({ ...valid, JWT_SECRET: 'short' })).toThrow(
      'JWT_SECRET',
    );
  });

  it('requires strong demo passwords when demo users are on', () => {
    expect(() => validateEnv({ ...valid, DEMO_USERS_ENABLED: 'true' })).toThrow(
      'DEMO_ADMIN_PASSWORD',
    );
    const env = validateEnv({
      ...valid,
      DEMO_USERS_ENABLED: 'true',
      DEMO_ADMIN_PASSWORD: 'a'.repeat(12),
      DEMO_CLIENT_PASSWORD: 'b'.repeat(12),
    });
    expect(env.DEMO_USERS_ENABLED).toBe(true);
  });

  it('rejects an invalid PORT or SESSION_HOURS', () => {
    expect(() => validateEnv({ ...valid, PORT: 'abc' })).toThrow('PORT');
    expect(() => validateEnv({ ...valid, SESSION_HOURS: '0' })).toThrow(
      'SESSION_HOURS',
    );
  });
});

describe('validateDatabaseEnv', () => {
  it('rejects a missing DATABASE_URL', () => {
    expect(() => validateDatabaseEnv({})).toThrow('DATABASE_URL is required');
  });

  it('rejects a non-MySQL DATABASE_URL', () => {
    expect(() =>
      validateDatabaseEnv({ DATABASE_URL: 'postgres://u:p@h/db' }),
    ).toThrow('mysql://');
  });
});
