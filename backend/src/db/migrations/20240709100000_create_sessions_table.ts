
import type { Knex } from "knex";

/**
 * This migration creates the 'sessions' table, which is required by
 * `connect-session-knex` to store user session data in the database.
 * Without this table, user sessions are not persisted, causing authentication
 * to fail on subsequent requests after login.
 */
export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('sessions', (table) => {
    // 'sid' is the session ID, used as the primary key.
    table.string('sid').primary();
    
    // 'sess' stores the session data as a JSON object.
    table.json('sess').notNullable();
    
    // 'expired' is a timestamp used by the session store to manage
    // and clean up expired sessions. It is indexed for performance.
    table.timestamp('expired').notNullable().index();
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('sessions');
}
