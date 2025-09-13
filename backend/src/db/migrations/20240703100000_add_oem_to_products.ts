import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('product_oem_numbers', (table) => {
    table.increments('id').primary();
    table.uuid('product_id').notNullable().references('id').inTable('products').onDelete('CASCADE');
    table.string('oem_number').notNullable();
    table.index('product_id');
    table.index('oem_number');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('product_oem_numbers');
}
