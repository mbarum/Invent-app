import knex from 'knex';
import dotenv from 'dotenv';

dotenv.config();

// --- PRODUCTION READINESS NOTE ---
// For a production environment, it is CRITICAL to configure automated,
// regular backups for this database. This should be done through your
// hosting provider's control panel (e.g., CloudPanel's backup features)
// or a dedicated database management tool. Data loss is irreversible.
// Ensure backups are stored securely and tested periodically.

const db = knex({
  client: 'mysql2',
  connection: {
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  },
  pool: { min: 2, max: 10 }
});

console.log('Attempting to connect to MySQL database via Knex...');

// FIX: Added a .catch() block to handle potential connection errors gracefully.
db.raw('SELECT 1+1 AS result').then(() => {
    console.log('✅ Database connected successfully via Knex!');
}).catch(err => {
    console.error('❌ Knex database connection failed:', err.message);
});


export default db;