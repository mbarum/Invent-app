// This line must be at the very top to ensure path aliases are registered
// before any other modules are imported.
import { loadConfig } from 'tsconfig-paths';
import path from 'path';
// FIX: Import process to handle potential missing Node.js global types.
import process from 'process';


// Explicitly load the tsconfig.json from the current directory to register path aliases.
// This is a robust way to ensure that @masuma-ea/types is resolved correctly when
// running knex commands with ts-node in any environment.
const tsconfigPath = path.resolve(__dirname, './tsconfig.json');
const configLoaderResult = loadConfig(tsconfigPath);

if (configLoaderResult.resultType === 'failed') {
    console.error('CRITICAL: Could not load tsconfig.json to map paths.');
    console.error(configLoaderResult.message);
    process.exit(1);
}


import type { Knex } from 'knex';
import dotenv from 'dotenv';

// Ensure the .env file from the backend root is loaded
// In a CommonJS module environment (as configured in tsconfig.json),
// __dirname is a global variable, so we don't need to derive it.
dotenv.config({ path: path.resolve(__dirname, './.env') });

const config: { [key: string]: Knex.Config } = {
  development: {
    client: 'mysql2',
    connection: {
      host: process.env.DB_HOST || 'localhost',
      port: Number(process.env.DB_PORT) || 3306,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
    },
    migrations: {
      directory: './src/db/migrations',
      extension: 'ts',
    },
    seeds: {
      directory: './src/db/seeds',
      extension: 'ts',
    }
  },
  production: {
    client: 'mysql2',
    connection: {
      host: process.env.DB_HOST,
      port: Number(process.env.DB_PORT),
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
    },
    migrations: {
      directory: './src/db/migrations',
      extension: 'ts',
    },
    seeds: {
      directory: './src/db/seeds',
      extension: 'ts',
    }
  },
};

export default config;