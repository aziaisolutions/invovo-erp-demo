-- Let's check what the transactions table actually contains for this customer
-- It will help us debug why cash_paid_received is showing as 0.

SELECT id, created_at, party_type, transaction_type, amount, total_bill, cash_paid_received, notes
FROM transactions
WHERE party_type = 'customer' 
ORDER BY created_at DESC
LIMIT 5;
