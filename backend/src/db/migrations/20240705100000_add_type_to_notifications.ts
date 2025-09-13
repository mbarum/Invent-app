import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('notifications', (table) => {
    table.string('type').nullable().after('link');
    table.string('entity_id').nullable().after('type');
    
    // Add a more specific index for de-duplication checks
    table.index(['user_id', 'type', 'entity_id', 'is_read'], 'idx_notifications_dedupe');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('notifications', (table) => {
    table.dropIndex(['user_id', 'type', 'entity_id', 'is_read'], 'idx_notifications_dedupe');
    table.dropColumn('type');
    table.dropColumn('entity_id');
  });
}
