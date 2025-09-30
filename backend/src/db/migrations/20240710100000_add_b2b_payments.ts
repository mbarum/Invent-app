import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  // Table to track credit limits and balances for B2B clients
  await knex.schema.createTable('b2b_client_credits', (table) => {
    table.uuid('user_id').primary().references('id').inTable('users').onDelete('CASCADE');
    table.decimal('credit_limit', 12, 2).notNullable().defaultTo(0);
    table.decimal('current_balance', 12, 2).notNullable().defaultTo(0);
    table.timestamps(true, true);
  });

  // Table to log payments made by B2B clients
  await knex.schema.createTable('b2b_payments', (table) => {
    table.increments('id').primary();
    table.uuid('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
    table.decimal('amount', 12, 2).notNullable();
    table.string('payment_method').notNullable(); // e.g., 'M-Pesa', 'Bank Transfer', 'Cheque'
    table.string('reference_code').nullable(); // e.g., M-Pesa transaction ID
    table.integer('invoice_id').unsigned().nullable().references('id').inTable('invoices').onDelete('SET NULL');
    table.text('notes').nullable();
    table.timestamp('payment_date').defaultTo(knex.fn.now());

    table.index('user_id');
    table.index('invoice_id');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('b2b_payments');
  await knex.schema.dropTableIfExists('b2b_client_credits');
}
