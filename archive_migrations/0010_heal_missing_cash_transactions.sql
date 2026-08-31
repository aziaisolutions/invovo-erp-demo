-- This script heals the transactions table directly.
-- If any Sale invoice was saved where 'cash_paid_received' was accidentally recorded as 0 in the database,
-- this will accurately calculate it (Total Bill - Remaining Amount = Cash Received) and fix the ledger.

UPDATE transactions
SET cash_paid_received = total_bill - amount
WHERE transaction_type = 'sale' 
  AND party_type = 'customer'
  AND total_bill IS NOT NULL
  AND total_bill > 0
  AND (cash_paid_received IS NULL OR cash_paid_received = 0)
  AND amount < total_bill;
