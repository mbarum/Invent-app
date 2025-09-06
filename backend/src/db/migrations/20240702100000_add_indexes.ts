import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('products', (table) => {
    table.index('name'); // For text searches
  });

  await knex.schema.alterTable('users', (table) => {
    table.index('role');
    table.index('customer_id');
    table.index('b2b_application_id');
  });

  await knex.schema.alterTable('customers', (table) => {
    table.index('name');
    table.index('phone');
  });

  await knex.schema.alterTable('sales', (table) => {
    table.index('customer_id');
    table.index('branch_id');
    table.index('created_at');
    table.index('invoice_id');
  });

  await knex.schema.alterTable('sale_items', (table) => {
    table.index('sale_id');
    table.index('product_id');
  });

  await knex.schema.alterTable('invoices', (table) => {
    table.index('customer_id');
    table.index('branch_id');
    table.index('status');
    table.index('created_at');
    table.index('quotation_id');
  });

  await knex.schema.alterTable('quotations', (table) => {
    table.index('customer_id');
    table.index('branch_id');
    table.index('status');
    table.index('created_at');
  });

  await knex.schema.alterTable('shipping_labels', (table) => {
    table.index('sale_id');
    table.index('invoice_id');
    table.index('from_branch_id');
    table.index('to_customer_id');
    table.index('status');
  });

  await knex.schema.alterTable('audit_logs', (table) => {
    table.index('user_id');
    table.index('action');
    table.index('created_at');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('products', (table) => {
    table.dropIndex('name');
  });

  await knex.schema.alterTable('users', (table) => {
    table.dropIndex('role');
    table.dropIndex('customer_id');
    table.dropIndex('b2b_application_id');
  });

  await knex.schema.alterTable('customers', (table) => {
    table.dropIndex('name');
    table.dropIndex('phone');
  });

  await knex.schema.alterTable('sales', (table) => {
    table.dropIndex('customer_id');
    table.dropIndex('branch_id');
    table.dropIndex('created_at');
    table.dropIndex('invoice_id');
  });
  
  await knex.schema.alterTable('sale_items', (table) => {
    table.dropIndex('sale_id');
    table.dropIndex('product_id');
  });

  await knex.schema.alterTable('invoices', (table) => {
    table.dropIndex('customer_id');
    table.dropIndex('branch_id');
    table.dropIndex('status');
    table.dropIndex('created_at');
    table.dropIndex('quotation_id');
  });

  await knex.schema.alterTable('quotations', (table) => {
    table.dropIndex('customer_id');
    table.dropIndex('branch_id');
    table.dropIndex('status');
    table.dropIndex('created_at');
  });

  await knex.schema.alterTable('shipping_labels', (table) => {
    table.dropIndex('sale_id');
    table.dropIndex('invoice_id');
    table.dropIndex('from_branch_id');
    table.dropIndex('to_customer_id');
    table.dropIndex('status');
  });

  await knex.schema.alterTable('audit_logs', (table) => {
    table.dropIndex('user_id');
    table.dropIndex('action');
    table.dropIndex('created_at');
  });
}
