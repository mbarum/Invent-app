import knex from 'knex';
import dotenv from 'dotenv';

dotenv.config();

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

db.raw('SELECT 1+1 AS result').then(() => {
    console.log('✅ Database connected successfully via Knex!');
}).catch(err => {
    console.error('❌ Knex database connection failed:', err.message);
});


export default db;
