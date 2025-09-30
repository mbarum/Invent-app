import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('stock_request_items', (table) => {
    table.integer('approved_quantity').nullable().after('quantity');
  });

  await knex.schema.alterTable('mpesa_transactions', (table) => {
    table.integer('stock_request_id').unsigned().nullable().references('id').inTable('stock_requests').onDelete('SET NULL').after('sale_id');
    table.index('stock_request_id');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('stock_request_items', (table) => {
    table.dropColumn('approved_quantity');
  });

  await knex.schema.alterTable('mpesa_transactions', (table) => {
    table.dropColumn('stock_request_id');
  });
}