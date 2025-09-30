// FIX: Import process to handle potential missing Node.js global types.
import process from 'process';
import knex, { Knex } from 'knex';
import dotenv from 'dotenv';

dotenv.config();

// --- Case Conversion Utilities ---

const toCamel = (s: string): string => {
  return s.replace(/(_\w)/g, (m) => m[1].toUpperCase());
};

const toSnake = (s: string): string => {
  return s.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
};

const processKeys = (obj: any, processor: (key: string) => string): any => {
  if (Array.isArray(obj)) {
    return obj.map(v => processKeys(v, processor));
  }
  // FIX: Replaced 'obj.constructor === Object' with a less strict check.
  // This correctly handles database row objects (e.g., RowDataPacket) which
  // are objects but don't have the default Object constructor, ensuring case
  // conversion works for all database query results.
  if (obj !== null && typeof obj === 'object' && !Array.isArray(obj) && !(obj instanceof Date)) {
    const newObj: { [key: string]: any } = {};
    for (const key of Object.keys(obj)) {
      newObj[processor(key)] = processKeys(obj[key], processor);
    }
    return newObj;
  }
  return obj;
};

// --- Knex Configuration ---
// FIX: Added case conversion to automatically map camelCase in the app (e.g., partNumber)
// to snake_case in the database (e.g., part_number). This resolves "Unknown column" errors
// and ensures data is correctly fetched and displayed.
const knexConfig: Knex.Config = {
  client: 'mysql2',
  connection: {
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  },
  pool: { min: 2, max: 10 },
  
  // Convert camelCase identifiers in code to snake_case for the DB
  wrapIdentifier: (value, origImpl) => {
    if (value === '*') return origImpl(value);
    return origImpl(toSnake(value));
  },

  // Convert snake_case results from DB to camelCase for the code
  postProcessResponse: (result) => {
    return processKeys(result, toCamel);
  },
};


// --- PRODUCTION READINESS NOTE ---
// For a production environment, it is CRITICAL to configure automated,
// regular backups for this database. This should be done through your
// hosting provider's control panel (e.g., CloudPanel's backup features)
// or a dedicated database management tool. Data loss is irreversible.
// Ensure backups are stored securely and tested periodically.

const db = knex(knexConfig);

console.log(`Attempting to connect to MySQL database '${process.env.DB_NAME}' via Knex...`);

// FIX: Added a .catch() block to handle potential connection errors gracefully.
db.raw('SELECT 1+1 AS result').then(() => {
    console.log(`✅ Database connected successfully to '${process.env.DB_NAME}' via Knex!`);
}).catch(err => {
    console.error('❌ Knex database connection failed:', err.message);
    // FIX: Add reference to node types to fix error on process.exit
    /// <reference types="node" />
    process.exit(1); // Exit if DB connection fails
});


export default db;