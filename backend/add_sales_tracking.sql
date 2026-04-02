-- ============================================
-- Migration: Add sales tracking columns to products
-- Run this SQL against the production database (Railway/Postgres)
-- ============================================

-- Add sales_count: tracks total units sold for this product
ALTER TABLE products 
ADD COLUMN IF NOT EXISTS sales_count INTEGER DEFAULT 0;

-- Add last_sale_date: tracks the timestamp of the last sale
ALTER TABLE products 
ADD COLUMN IF NOT EXISTS last_sale_date TIMESTAMPTZ;

-- Initialize sales_count from stock_movements for existing data
-- This backfills historical sales data so Top/Recientes are useful immediately
UPDATE products p
SET sales_count = COALESCE((
    SELECT ABS(SUM(sm.quantity))
    FROM stock_movements sm
    WHERE sm.product_id = p.id
      AND sm.movement_type = 'sale'
      AND sm.quantity < 0
      AND sm.deleted_at IS NULL
), 0),
last_sale_date = (
    SELECT MAX(sm.created_at)
    FROM stock_movements sm
    WHERE sm.product_id = p.id
      AND sm.movement_type = 'sale'
      AND sm.deleted_at IS NULL
)
WHERE p.deleted_at IS NULL;

-- Create index for efficient sorting in Top and Recientes queries
CREATE INDEX IF NOT EXISTS idx_products_sales_count ON products (sales_count DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_products_last_sale_date ON products (last_sale_date DESC) WHERE deleted_at IS NULL;

-- Verify migration
SELECT 
    COUNT(*) as total_products,
    COUNT(sales_count) as products_with_sales,
    COUNT(last_sale_date) as products_with_last_sale
FROM products 
WHERE deleted_at IS NULL;
