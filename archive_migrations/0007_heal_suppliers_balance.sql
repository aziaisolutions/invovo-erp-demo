-- This SQL heals the 'payment_due' column in the suppliers table
-- by calculating the exact sum of all valid transactions,
-- ensuring that the "Real-time Payable Credit" dropdown in the app is perfectly synced.

UPDATE suppliers s
SET payment_due = (
  SELECT COALESCE(
    SUM(
      CASE 
        WHEN transaction_type = 'purchase' THEN COALESCE(total_bill, amount, 0) - COALESCE(cash_paid_received, 0)
        WHEN transaction_type IN ('payment_out', 'payment') THEN -COALESCE(cash_paid_received, amount, 0)
        ELSE 0
      END
    ), 0
  )
  FROM transactions t
  WHERE t.party_id = s.id AND t.party_type = 'supplier'
);
