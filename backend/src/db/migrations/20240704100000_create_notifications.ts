
import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('notifications', (table) => {
    table.increments('id').primary();
    table.uuid('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
    table.string('message').notNullable();
    table.string('link').nullable();
    table.boolean('is_read').notNullable().defaultTo(false);
    table.timestamp('created_at').defaultTo(knex.fn.now());
    
    table.index(['user_id', 'is_read']);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('notifications');
}
