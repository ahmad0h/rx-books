import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { validateDatabaseEnv } from '../config/env.js';
import { buildDataSourceOptions } from './database.config.js';

/**
 * Used only by the TypeORM command line (see the migration:* scripts in
 * package.json), which runs against the compiled code in dist/.
 */
export default new DataSource(
  buildDataSourceOptions(validateDatabaseEnv(process.env)),
);
