import { Knex } from "knex";
import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcrypt';
import { UserRole } from '@masuma-ea/types';

export async function seed(knex: Knex): Promise<void> {
    // Use a transaction to ensure all or nothing gets inserted
    await knex.transaction(async (trx) => {
        // Deletes ALL existing entries in reverse order of dependency
        await trx('audit_logs').del();
        await trx('stock_request_items').del();
        await trx('stock_requests').del();
        await trx('mpesa_transactions').del();
        await trx('app_settings').del();
        await trx('shipping_labels').del();
        await trx('sale_items').del();
        await trx('sales').del();
        await trx('invoice_items').del();
        await trx('invoices').del();
        await trx('quotation_items').del();
        await trx('quotations').del();
        await trx('users').del();
        await trx('b2b_applications').del();
        await trx('customers').del();
        await trx('branches').del();
        await trx('products').del();

        // --- INSERTS ---

        // Insert Branches and then retrieve them to get their IDs
        await trx('branches').insert([
            { name: 'Nairobi - Kirinyaga Road', address: 'Kirinyaga Road, Nairobi', phone: '0712345678' },
            { name: 'Mombasa - Jomokenyatta Ave', address: 'Jomokenyatta Avenue, Mombasa', phone: '0787654321' }
        ]);
        const branches = await trx('branches').select('*');
        const branch1 = branches.find(b => b.name === 'Nairobi - Kirinyaga Road');
        if (!branch1) throw new Error("Failed to seed and retrieve Nairobi branch.");

        // Insert Customers and then retrieve them
        await trx('customers').insert([
            { name: 'Walk-in Customer', address: 'N/A', phone: 'N/A' },
            { name: 'John Doe Garage', address: 'Industrial Area, Nrb', phone: '0722000111', kra_pin: 'A001234567Z' }
        ]);
        const customers = await trx('customers').select('*');
        const customer2 = customers.find(c => c.name === 'John Doe Garage');
        if (!customer2) throw new Error("Failed to seed and retrieve John Doe Garage customer.");

        // Insert Products (UUIDs are generated client-side, so no need to retrieve)
        const productsToInsert = [
            { id: uuidv4(), part_number: 'MLS-012', name: 'Shock Absorber', retail_price: 6500, wholesale_price: 5200, stock: 50 },
            { id: uuidv4(), part_number: 'MF-1413', name: 'Oil Filter', retail_price: 800, wholesale_price: 650, stock: 120 },
            { id: uuidv4(), part_number: 'T-247', name: 'Brake Pad Set', retail_price: 4500, wholesale_price: 3800, stock: 80 },
            { id: uuidv4(), part_number: 'MI-310', name: 'Ignition Coil', retail_price: 3200, wholesale_price: 2700, stock: 30 },
            { id: uuidv4(), part_number: 'RU-567', name: 'Control Arm Bushing', retail_price: 1200, wholesale_price: 950, stock: 0 },
        ];
        await trx('products').insert(productsToInsert);
        const insertedProducts = await trx('products').select('*');

        // Insert Users (Admin)
        const salt = await bcrypt.genSalt(10);
        const adminPasswordHash = await bcrypt.hash('jesuslord1J', salt);
        await trx('users').insert({
            id: '93288475-93a8-4e45-ae9c-e19d6ecb26ca', // Use a static UUID for the main admin
            name: 'System Admin',
            email: 'systems@masuma.africa',
            password_hash: adminPasswordHash,
            role: UserRole.SYSTEM_ADMINISTRATOR,
            status: 'Active'
        });

        // Insert a Sale and retrieve it
        const saleNo = `SALE-${Date.now()}`;
        await trx('sales').insert({
            sale_no: saleNo,
            customer_id: customer2.id,
            branch_id: branch1.id,
            tax_amount: 224,
            total_amount: 1624,
            payment_method: 'Cash',
        });
        const sale1 = await trx('sales').where('sale_no', saleNo).first();
        if (!sale1) throw new Error("Failed to seed and retrieve sale.");

        const oilFilter = insertedProducts.find(p => p.part_number === 'MF-1413');
        const ignitionCoil = insertedProducts.find(p => p.part_number === 'MI-310');
        if (!oilFilter || !ignitionCoil) throw new Error("Seed products not found for sale items");

        await trx('sale_items').insert([
            { sale_id: sale1.id, product_id: oilFilter.id, quantity: 1, unit_price: 800 },
            { sale_id: sale1.id, product_id: ignitionCoil.id, quantity: 2, unit_price: 400 },
        ]);

        // Insert a Quotation and retrieve it
        const quotationNo = `QUO-${Date.now()}`;
        await trx('quotations').insert({
            quotation_no: quotationNo,
            customer_id: customer2.id,
            branch_id: branch1.id,
            valid_until: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
            total_amount: 4500,
            status: 'Sent'
        });
        const quotation1 = await trx('quotations').where('quotation_no', quotationNo).first();
        if (!quotation1) throw new Error("Failed to seed and retrieve quotation.");
        
        const brakePads = insertedProducts.find(p => p.part_number === 'T-247');
        if (!brakePads) throw new Error("Seed product 'Brake Pad Set' not found for quotation items");

        await trx('quotation_items').insert([
            { quotation_id: quotation1.id, product_id: brakePads.id, quantity: 1, unit_price: 4500 }
        ]);

        // Insert an Invoice (from the quotation) and retrieve it
        const invoiceNo = `INV-${Date.now()}`;
        await trx('invoices').insert({
            invoice_no: invoiceNo,
            customer_id: customer2.id,
            branch_id: branch1.id,
            quotation_id: quotation1.id,
            due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
            total_amount: 4500,
            amount_paid: 0,
            status: 'Unpaid'
        });
        const invoice1 = await trx('invoices').where('invoice_no', invoiceNo).first();
        if (!invoice1) throw new Error("Failed to seed and retrieve invoice.");

        await trx('invoice_items').insert([
            { invoice_id: invoice1.id, product_id: brakePads.id, quantity: 1, unit_price: 4500 }
        ]);

        // Insert a Shipping Label
        await trx('shipping_labels').insert({
            id: uuidv4(),
            sale_id: sale1.id,
            from_branch_id: branch1.id,
            to_customer_id: customer2.id,
            from_name: branch1.name,
            from_address: branch1.address,
            from_phone: branch1.phone,
            to_name: customer2.name,
            to_address: customer2.address,
            to_phone: customer2.phone,
            weight: 2.5,
            carrier: 'G4S',
            status: 'Draft'
        });
    });
}