import type { Knex } from "knex";

/**
 * This migration fixes a bug where a successful B2B stock request payment would fail
 * during order processing because the 'Paid' status was not a valid ENUM option in the
 * `stock_requests` table. This change adds 'Paid' to the allowed statuses.
 */
export async function up(knex: Knex): Promise<void> {
  // Modify the ENUM list to include 'Paid' status for B2B stock requests.
  // This is the state a request enters after being 'Approved' and successfully paid for.
  await knex.raw("ALTER TABLE stock_requests MODIFY COLUMN status ENUM('Pending', 'Approved', 'Paid', 'Rejected', 'Shipped') NOT NULL DEFAULT 'Pending'");
}


export async function down(knex: Knex): Promise<void> {
  // This reverts the ENUM list to its original state, excluding 'Paid'.
  // WARNING: If any records have the 'Paid' status, this rollback will fail.
  // Those records would need to be manually updated to a different status first.
  await knex.raw("ALTER TABLE stock_requests MODIFY COLUMN status ENUM('Pending', 'Approved', 'Rejected', 'Shipped') NOT NULL DEFAULT 'Pending'");
}
