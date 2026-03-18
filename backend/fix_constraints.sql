-- Remove the restrictive margin constraint
ALTER TABLE products DROP CONSTRAINT IF EXISTS valid_margin;

-- Ensure we can have negative stock if needed (some business models allow it temporarily)
-- But the schema has:
-- stock_quantity INTEGER NOT NULL DEFAULT 0
-- No CHECK constraint on stock_quantity itself was found in grep.

-- Log success
SELECT 'Constraints fixed' as result;
