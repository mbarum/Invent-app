import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('quotations', (table) => {
    // Add columns after 'valid_until' to match the logical flow of calculations
    table.decimal('subtotal', 12, 2).notNullable().defaultTo(0).after('valid_until');
    table.decimal('discount_amount', 12, 2).notNullable().defaultTo(0).after('subtotal');
    table.decimal('tax_amount', 12, 2).notNullable().defaultTo(0).after('discount_amount');
    
    // Ensure total_amount is not nullable and has a default, in case it wasn't set correctly before
    table.decimal('total_amount', 12, 2).notNullable().defaultTo(0).alter();
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('quotations', (table) => {
    table.dropColumn('subtotal');
    table.dropColumn('discount_amount');
    table.dropColumn('tax_amount');
    
    // Reverting total_amount alteration is not strictly necessary but good practice
    // Assuming it was not nullable before, just dropping the new columns is enough.
    // If we wanted to revert the default, we would need a more complex alter statement.
  });
}