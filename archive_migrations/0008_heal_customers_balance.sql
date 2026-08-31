-- This SQL heals the 'payment_due' column in the customers table
-- by calculating the exact sum of all valid transactions.
-- It ensures that customer balances are perfectly synced across the entire app.

UPDATE customers c
SET payment_due = (
  SELECT COALESCE(
    SUM(
      CASE 
        WHEN transaction_type = 'sale' THEN COALESCE(total_bill, amount, 0) - COALESCE(cash_paid_received, 0)
        WHEN transaction_type IN ('payment_received', 'payment', 'received') THEN -COALESCE(cash_paid_received, amount, 0)
        ELSE 0
      END
    ), 0
  )
  FROM transactions t
  WHERE t.party_id = c.id AND t.party_type = 'customer'
);
