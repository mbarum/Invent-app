/// <reference types="node" />

// This line must be at the very top to ensure path aliases are registered
// before any other modules are imported.
import 'tsconfig-paths/register';

import type { Knex } from 'knex';
import dotenv from 'dotenv';
import path from 'path';
// FIX: Add url import to derive __dirname in ES module context
import { fileURLToPath } from 'url';

// FIX: __dirname is not available in ES modules. This correctly derives it.
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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