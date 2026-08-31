-- Drop the restrictive foreign key that was forcing all transactions to belong to a customer
ALTER TABLE transactions DROP CONSTRAINT IF EXISTS fk_customer_transaction;
ALTER TABLE transactions DROP CONSTRAINT IF EXISTS transactions_party_id_fkey;
