import {
  buildDataSourceOptions,
  buildTypeOrmOptions,
  ENTITIES,
  MIGRATIONS,
} from './database.config.js';

describe('database config', () => {
  const url = 'mysql://rxbooks:secret@mysql:3306/rxbooks';

  it('connects to MySQL with safe defaults', () => {
    expect(
      buildDataSourceOptions({ DATABASE_URL: url, DATABASE_TLS: false }),
    ).toMatchObject({
      type: 'mysql',
      url,
      ssl: undefined,
      timezone: 'Z',
      dateStrings: ['DATE'],
      synchronize: false,
      entities: ENTITIES,
      migrations: MIGRATIONS,
    });
  });

  it('turns on verified TLS when DATABASE_TLS is true', () => {
    expect(
      buildDataSourceOptions({ DATABASE_URL: url, DATABASE_TLS: true }),
    ).toMatchObject({
      ssl: { rejectUnauthorized: true },
    });
  });

  it('runs pending migrations when the app starts', () => {
    expect(
      buildTypeOrmOptions({ DATABASE_URL: url, DATABASE_TLS: false }),
    ).toMatchObject({
      migrationsRun: true,
    });
  });
});
