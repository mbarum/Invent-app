import type { Knex } from "knex";


export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('products', (table) => {
    table.uuid('id').primary();
    table.string('part_number').notNullable().unique();
    table.string('name').notNullable();
    table.decimal('retail_price', 10, 2).notNullable();
    table.decimal('wholesale_price', 10, 2).notNullable();
    table.integer('stock').notNullable().defaultTo(0);
    table.timestamps(true, true);
  });
  
  await knex.schema.createTable('branches', (table) => {
    table.increments('id').primary();
    table.string('name').notNullable();
    table.string('address');
    table.string('phone');
  });

  await knex.schema.createTable('customers', (table) => {
    table.increments('id').primary();
    table.string('name').notNullable();
    table.string('address');
    table.string('phone');
    table.string('kra_pin').nullable();
  });
  
  await knex.schema.createTable('b2b_applications', (table) => {
    table.uuid('id').primary();
    table.string('business_name').notNullable();
    table.string('kra_pin').notNullable();
    table.string('contact_name').notNullable();
    table.string('contact_email').notNullable().unique();
    table.string('contact_phone').notNullable();
    table.string('password_hash').notNullable();
    table.string('cert_of_inc_url').notNullable();
    table.string('cr12_url').notNullable();
    table.enum('status', ['Pending', 'Approved', 'Rejected']).notNullable().defaultTo('Pending');
    table.timestamp('submitted_at').defaultTo(knex.fn.now());
  });

  await knex.schema.createTable('users', (table) => {
    table.uuid('id').primary();
    table.string('name').notNullable();
    table.string('email').notNullable().unique();
    table.string('password_hash').nullable(); // Nullable for Google Sign-In users
    table.string('role').notNullable();
    table.uuid('b2b_application_id').nullable().references('id').inTable('b2b_applications').onDelete('SET NULL');
    table.integer('customer_id').unsigned().nullable().references('id').inTable('customers').onDelete('SET NULL');
    table.enum('status', ['Active', 'Inactive']).notNullable().defaultTo('Active');
    table.timestamps(true, true);
  });

  await knex.schema.createTable('quotations', (table) => {
    table.increments('id').primary();
    table.string('quotation_no').notNullable().unique();
    table.integer('customer_id').unsigned().notNullable().references('id').inTable('customers');
    table.integer('branch_id').unsigned().notNullable().references('id').inTable('branches');
    table.date('valid_until').notNullable();
    table.decimal('total_amount', 12, 2).notNullable();
    table.string('status').notNullable().defaultTo('Draft');
    table.timestamps(true, true);
  });
  
  await knex.schema.createTable('quotation_items', (table) => {
    table.increments('id').primary();
    table.integer('quotation_id').unsigned().notNullable().references('id').inTable('quotations').onDelete('CASCADE');
    table.uuid('product_id').notNullable().references('id').inTable('products');
    table.integer('quantity').unsigned().notNullable();
    table.decimal('unit_price', 10, 2).notNullable();
  });

  await knex.schema.createTable('invoices', (table) => {
    table.increments('id').primary();
    table.string('invoice_no').notNullable().unique();
    table.integer('customer_id').unsigned().notNullable().references('id').inTable('customers');
    table.integer('branch_id').unsigned().notNullable().references('id').inTable('branches');
    table.integer('quotation_id').unsigned().nullable().references('id').inTable('quotations');
    table.date('due_date').notNullable();
    table.decimal('total_amount', 12, 2).notNullable();
    table.decimal('amount_paid', 12, 2).notNullable().defaultTo(0);
    table.string('status').notNullable().defaultTo('Unpaid');
    table.timestamps(true, true);
  });
  
  await knex.schema.createTable('invoice_items', (table) => {
    table.increments('id').primary();
    table.integer('invoice_id').unsigned().notNullable().references('id').inTable('invoices').onDelete('CASCADE');
    table.uuid('product_id').notNullable().references('id').inTable('products');
    table.integer('quantity').unsigned().notNullable();
    table.decimal('unit_price', 10, 2).notNullable();
  });
  
  await knex.schema.createTable('sales', (table) => {
    table.increments('id').primary();
    table.string('sale_no').notNullable().unique();
    table.integer('customer_id').unsigned().notNullable().references('id').inTable('customers');
    table.integer('branch_id').unsigned().notNullable().references('id').inTable('branches');
    table.decimal('tax_amount', 10, 2).notNullable();
    table.decimal('total_amount', 12, 2).notNullable();
    table.string('payment_method').notNullable();
    table.integer('invoice_id').unsigned().nullable().references('id').inTable('invoices');
    table.timestamps(true, true);
  });
  
  await knex.schema.createTable('sale_items', (table) => {
    table.increments('id').primary();
    table.integer('sale_id').unsigned().notNullable().references('id').inTable('sales').onDelete('CASCADE');
    table.uuid('product_id').notNullable().references('id').inTable('products');
    table.integer('quantity').unsigned().notNullable();
    table.decimal('unit_price', 10, 2).notNullable();
  });

  await knex.schema.createTable('shipping_labels', (table) => {
    table.uuid('id').primary();
    table.integer('sale_id').unsigned().nullable().references('id').inTable('sales');
    table.integer('invoice_id').unsigned().nullable().references('id').inTable('invoices');
    table.integer('from_branch_id').unsigned().notNullable().references('id').inTable('branches');
    table.integer('to_customer_id').unsigned().notNullable().references('id').inTable('customers');
    table.string('from_name').notNullable();
    table.string('from_address').notNullable();
    table.string('from_phone').notNullable();
    table.string('to_name').notNullable();
    table.string('to_address').notNullable();
    table.string('to_phone').notNullable();
    table.decimal('weight', 8, 2).nullable();
    table.string('carrier').nullable();
    table.string('status').notNullable().defaultTo('Draft');
    table.timestamps(true, true);
  });
  
  await knex.schema.createTable('app_settings', (table) => {
    table.string('setting_key').primary();
    table.text('setting_value');
  });
  
  await knex.schema.createTable('mpesa_transactions', (table) => {
    table.increments('id').primary();
    table.string('checkout_request_id').notNullable().unique();
    table.string('merchant_request_id').notNullable();
    table.decimal('amount', 10, 2).notNullable();
    table.string('phone_number').notNullable();
    table.integer('invoice_id').unsigned().nullable().references('id').inTable('invoices');
    table.integer('sale_id').unsigned().nullable().references('id').inTable('sales');
    table.json('transaction_details').nullable();
    table.string('status').notNullable().defaultTo('Pending');
    table.text('result_desc').nullable();
    table.string('mpesa_receipt_number').nullable();
    table.timestamps(true, true);
  });

  await knex.schema.createTable('stock_requests', (table) => {
      table.increments('id').primary();
      table.uuid('b2b_user_id').notNullable().references('id').inTable('users');
      table.integer('branch_id').unsigned().notNullable().references('id').inTable('branches');
      table.enum('status', ['Pending', 'Approved', 'Rejected', 'Shipped']).notNullable().defaultTo('Pending');
      table.timestamps(true, true);
  });

  await knex.schema.createTable('stock_request_items', (table) => {
      table.increments('id').primary();
      table.integer('stock_request_id').unsigned().notNullable().references('id').inTable('stock_requests').onDelete('CASCADE');
      table.uuid('product_id').notNullable().references('id').inTable('products');
      table.integer('quantity').unsigned().notNullable();
      table.decimal('wholesale_price_at_request', 10, 2).notNullable();
  });

  await knex.schema.createTable('audit_logs', (table) => {
      table.increments('id').primary();
      table.uuid('user_id').notNullable().references('id').inTable('users');
      table.string('action').notNullable();
      table.json('details').nullable();
      table.timestamp('created_at').defaultTo(knex.fn.now());
  });
}


export async function down(knex: Knex): Promise<void> {
  // Drop in reverse order of creation due to foreign key constraints
  await knex.schema.dropTableIfExists('audit_logs');
  await knex.schema.dropTableIfExists('stock_request_items');
  await knex.schema.dropTableIfExists('stock_requests');
  await knex.schema.dropTableIfExists('mpesa_transactions');
  await knex.schema.dropTableIfExists('app_settings');
  await knex.schema.dropTableIfExists('shipping_labels');
  await knex.schema.dropTableIfExists('sale_items');
  await knex.schema.dropTableIfExists('sales');
  await knex.schema.dropTableIfExists('invoice_items');
  await knex.schema.dropTableIfExists('invoices');
  await knex.schema.dropTableIfExists('quotation_items');
  await knex.schema.dropTableIfExists('quotations');
  await knex.schema.dropTableIfExists('users');
  await knex.schema.dropTableIfExists('b2b_applications');
  await knex.schema.dropTableIfExists('customers');
  await knex.schema.dropTableIfExists('branches');
  await knex.schema.dropTableIfExists('products');
}
