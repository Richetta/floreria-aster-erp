-- Sync Database Schema for Florería Aster ERP
-- Run this in your Supabase SQL Editor: https://supabase.com/dashboard/project/lddrseslgkdaetsidyrv → SQL Editor

-- 1. Fix Products table (needed for Top/Recent sales tracking)
ALTER TABLE products ADD COLUMN IF NOT EXISTS sales_count INTEGER DEFAULT 0;
ALTER TABLE products ADD COLUMN IF NOT EXISTS last_sale_date TIMESTAMP WITH TIME ZONE;

-- 2. Ensure Customers table has tracking fields (required for sales processing)
ALTER TABLE customers ADD COLUMN IF NOT EXISTS total_orders INTEGER DEFAULT 0;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS total_spent DECIMAL(10,2) DEFAULT 0.00;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS last_order_date TIMESTAMP WITH TIME ZONE;

-- 3. Verify current column status
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name IN ('products', 'customers');
