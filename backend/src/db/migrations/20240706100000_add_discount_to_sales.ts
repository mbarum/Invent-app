import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('sales', (table) => {
    table.decimal('discount_amount', 10, 2).notNullable().defaultTo(0).after('branch_id');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('sales', (table) => {
    table.dropColumn('discount_amount');
  });
}
