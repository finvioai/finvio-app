-- FinPilot dev seed data
-- Realistic sample data for a fictional SaaS startup "Luminary Labs"
-- Apply after migrations: supabase db seed --file supabase/seed.sql

-- ─── IDs (stable for reproducibility) ─────────────────────────────────────────
-- org:  11111111-1111-1111-1111-111111111111
-- user: 22222222-2222-2222-2222-222222222222

-- Organization
INSERT INTO organizations (id, name, currency, fiscal_year_start, industry)
VALUES (
  '11111111-1111-1111-1111-111111111111',
  'Luminary Labs',
  'USD',
  1,
  'SaaS'
) ON CONFLICT (id) DO NOTHING;

-- User settings (assumes auth user already exists via signup)
INSERT INTO user_settings (user_id, llm_provider, llm_model)
VALUES (
  '22222222-2222-2222-2222-222222222222',
  'openai',
  'gpt-4o'
) ON CONFLICT (user_id) DO NOTHING;

-- Org member
INSERT INTO org_members (org_id, user_id, role)
VALUES (
  '11111111-1111-1111-1111-111111111111',
  '22222222-2222-2222-2222-222222222222',
  'owner'
) ON CONFLICT DO NOTHING;

-- ─── Customers ────────────────────────────────────────────────────────────────

INSERT INTO customers (id, org_id, external_id, name, email, source, status) VALUES
  ('c0000001-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'cus_stripe_001', 'Acme Corp',         'billing@acme.com',       'stripe', 'active'),
  ('c0000001-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', 'cus_stripe_002', 'Meridian Tech',     'finance@meridian.io',    'stripe', 'active'),
  ('c0000001-0000-0000-0000-000000000003', '11111111-1111-1111-1111-111111111111', 'cus_stripe_003', 'Blue River Media',  'accounts@blueriver.co',  'stripe', 'active'),
  ('c0000001-0000-0000-0000-000000000004', '11111111-1111-1111-1111-111111111111', 'cus_stripe_004', 'NorthStar AI',      'billing@northstar.ai',   'stripe', 'active'),
  ('c0000001-0000-0000-0000-000000000005', '11111111-1111-1111-1111-111111111111', 'cus_stripe_005', 'Verdant Systems',   'ops@verdantsys.com',     'stripe', 'churned')
ON CONFLICT DO NOTHING;

-- ─── Subscriptions ────────────────────────────────────────────────────────────

INSERT INTO subscriptions (org_id, external_id, customer_id, amount, currency, interval, status, plan_name, current_period_start, current_period_end, source) VALUES
  ('11111111-1111-1111-1111-111111111111', 'sub_001', 'c0000001-0000-0000-0000-000000000001', 500,  'usd', 'month', 'active',    'Growth',  '2026-05-01', '2026-06-01', 'stripe'),
  ('11111111-1111-1111-1111-111111111111', 'sub_002', 'c0000001-0000-0000-0000-000000000002', 1200, 'usd', 'month', 'active',    'Pro',     '2026-05-01', '2026-06-01', 'stripe'),
  ('11111111-1111-1111-1111-111111111111', 'sub_003', 'c0000001-0000-0000-0000-000000000003', 800,  'usd', 'month', 'active',    'Growth',  '2026-05-01', '2026-06-01', 'stripe'),
  ('11111111-1111-1111-1111-111111111111', 'sub_004', 'c0000001-0000-0000-0000-000000000004', 2400, 'usd', 'month', 'active',    'Enterprise', '2026-05-01', '2026-06-01', 'stripe'),
  ('11111111-1111-1111-1111-111111111111', 'sub_005', 'c0000001-0000-0000-0000-000000000005', 500,  'usd', 'month', 'cancelled', 'Growth',  '2026-03-01', '2026-04-01', 'stripe')
ON CONFLICT DO NOTHING;

-- ─── Transactions — last 6 months ─────────────────────────────────────────────

INSERT INTO transactions (org_id, type, amount, description, date, category, category_confidence, category_method, source, source_ref_id, currency, is_reviewed, is_reconciled) VALUES

-- December 2025
('11111111-1111-1111-1111-111111111111', 'income',  4200, 'Stripe revenue — Dec',       '2025-12-15', 'SaaS Revenue',          'high', 'rule',  'stripe',  'charge_dec_01', 'usd', true,  false),
('11111111-1111-1111-1111-111111111111', 'expense', 2000, 'AWS cloud infrastructure',   '2025-12-05', 'Infrastructure',        'high', 'rule',  'manual',  'manual_dec_01', 'usd', true,  false),
('11111111-1111-1111-1111-111111111111', 'expense', 1200, 'Team payroll',               '2025-12-28', 'Payroll',               'high', 'rule',  'manual',  'manual_dec_02', 'usd', true,  false),
('11111111-1111-1111-1111-111111111111', 'expense',  150, 'Figma subscription',         '2025-12-01', 'Software',              'high', 'rule',  'manual',  'manual_dec_03', 'usd', true,  false),

-- January 2026
('11111111-1111-1111-1111-111111111111', 'income',  4600, 'Stripe revenue — Jan',       '2026-01-15', 'SaaS Revenue',          'high', 'rule',  'stripe',  'charge_jan_01', 'usd', true,  false),
('11111111-1111-1111-1111-111111111111', 'expense', 2000, 'AWS cloud infrastructure',   '2026-01-05', 'Infrastructure',        'high', 'rule',  'manual',  'manual_jan_01', 'usd', true,  false),
('11111111-1111-1111-1111-111111111111', 'expense', 1400, 'Team payroll',               '2026-01-28', 'Payroll',               'high', 'rule',  'manual',  'manual_jan_02', 'usd', true,  false),
('11111111-1111-1111-1111-111111111111', 'expense',  200, 'Google Workspace',           '2026-01-01', 'Software',              'high', 'rule',  'manual',  'manual_jan_03', 'usd', true,  false),

-- February 2026
('11111111-1111-1111-1111-111111111111', 'income',  5200, 'Stripe revenue — Feb',       '2026-02-15', 'SaaS Revenue',          'high', 'rule',  'stripe',  'charge_feb_01', 'usd', true,  false),
('11111111-1111-1111-1111-111111111111', 'expense', 2200, 'AWS cloud infrastructure',   '2026-02-05', 'Infrastructure',        'high', 'rule',  'manual',  'manual_feb_01', 'usd', true,  false),
('11111111-1111-1111-1111-111111111111', 'expense', 1400, 'Team payroll',               '2026-02-28', 'Payroll',               'high', 'rule',  'manual',  'manual_feb_02', 'usd', true,  false),
('11111111-1111-1111-1111-111111111111', 'expense',  300, 'Conference travel',          '2026-02-20', 'Travel',                'medium', 'ai',  'manual',  'manual_feb_03', 'usd', false, false),

-- March 2026
('11111111-1111-1111-1111-111111111111', 'income',  6000, 'Stripe revenue — Mar',       '2026-03-15', 'SaaS Revenue',          'high', 'rule',  'stripe',  'charge_mar_01', 'usd', true,  false),
('11111111-1111-1111-1111-111111111111', 'income',   800, 'Consulting — Acme Corp',     '2026-03-20', 'Consulting Revenue',    'high', 'user',  'manual',  'manual_mar_00', 'usd', true,  false),
('11111111-1111-1111-1111-111111111111', 'expense', 2200, 'AWS cloud infrastructure',   '2026-03-05', 'Infrastructure',        'high', 'rule',  'manual',  'manual_mar_01', 'usd', true,  false),
('11111111-1111-1111-1111-111111111111', 'expense', 1600, 'Team payroll',               '2026-03-28', 'Payroll',               'high', 'rule',  'manual',  'manual_mar_02', 'usd', true,  false),
('11111111-1111-1111-1111-111111111111', 'expense',  450, 'Notion + Linear + Slack',    '2026-03-01', 'Software',              'high', 'rule',  'manual',  'manual_mar_03', 'usd', true,  false),

-- April 2026
('11111111-1111-1111-1111-111111111111', 'income',  7500, 'Stripe revenue — Apr',       '2026-04-15', 'SaaS Revenue',          'high', 'rule',  'stripe',  'charge_apr_01', 'usd', true,  false),
('11111111-1111-1111-1111-111111111111', 'income',  1200, 'Consulting — Meridian Tech', '2026-04-22', 'Consulting Revenue',    'high', 'user',  'manual',  'manual_apr_00', 'usd', true,  false),
('11111111-1111-1111-1111-111111111111', 'expense', 2500, 'AWS cloud infrastructure',   '2026-04-05', 'Infrastructure',        'high', 'rule',  'manual',  'manual_apr_01', 'usd', true,  false),
('11111111-1111-1111-1111-111111111111', 'expense', 1800, 'Team payroll',               '2026-04-28', 'Payroll',               'high', 'rule',  'manual',  'manual_apr_02', 'usd', true,  false),
('11111111-1111-1111-1111-111111111111', 'expense',  500, 'Legal — contract review',    '2026-04-10', 'Legal & Professional',  'medium', 'ai',  'manual',  'manual_apr_03', 'usd', false, false),
('11111111-1111-1111-1111-111111111111', 'expense',  200, 'Marketing — LinkedIn ads',   '2026-04-15', 'Marketing',             'high', 'rule',  'manual',  'manual_apr_04', 'usd', true,  false),

-- May 2026 (partial — current month)
('11111111-1111-1111-1111-111111111111', 'income',  4900, 'Stripe revenue — May (part)', '2026-05-02', 'SaaS Revenue',         'high', 'rule',  'stripe',  'charge_may_01', 'usd', true,  false),
('11111111-1111-1111-1111-111111111111', 'expense', 2500, 'AWS cloud infrastructure',   '2026-05-05', 'Infrastructure',        'high', 'rule',  'manual',  'manual_may_01', 'usd', true,  false),
('11111111-1111-1111-1111-111111111111', 'expense',  350, 'Vercel Pro plan',            '2026-05-01', 'Infrastructure',        'high', 'rule',  'manual',  'manual_may_02', 'usd', true,  false),
('11111111-1111-1111-1111-111111111111', 'expense',  NULL, 'Unknown vendor charge',     '2026-05-03', NULL,                    'low',  'ai',    'plaid',   'plaid_may_unk', 'usd', false, false)

ON CONFLICT DO NOTHING;

-- Fix the NULL amount row (placeholder for uncategorized review queue demo)
UPDATE transactions SET amount = 85 WHERE source_ref_id = 'plaid_may_unk' AND org_id = '11111111-1111-1111-1111-111111111111';

-- ─── Invoices ─────────────────────────────────────────────────────────────────

INSERT INTO invoices (org_id, invoice_number, customer_name, customer_email, amount, status, due_date, invoice_date, source, created_by) VALUES
  ('11111111-1111-1111-1111-111111111111', 'INV-SEED001', 'Acme Corp',         'billing@acme.com',    3000, 'paid',    '2026-03-31', '2026-03-01', 'manual', '22222222-2222-2222-2222-222222222222'),
  ('11111111-1111-1111-1111-111111111111', 'INV-SEED002', 'Meridian Tech',     'finance@meridian.io', 5000, 'sent',    '2026-05-15', '2026-04-15', 'manual', '22222222-2222-2222-2222-222222222222'),
  ('11111111-1111-1111-1111-111111111111', 'INV-SEED003', 'Blue River Media',  'accounts@blueriver.co',1200, 'overdue', '2026-04-01', '2026-03-15', 'manual', '22222222-2222-2222-2222-222222222222'),
  ('11111111-1111-1111-1111-111111111111', 'INV-SEED004', 'NorthStar AI',      'billing@northstar.ai',8000, 'draft',   '2026-06-01', '2026-05-01', 'manual', '22222222-2222-2222-2222-222222222222')
ON CONFLICT DO NOTHING;

-- ─── Expense reports ──────────────────────────────────────────────────────────

INSERT INTO expense_reports (org_id, title, amount, category, date, status, submitter_id, submitter_name) VALUES
  ('11111111-1111-1111-1111-111111111111', 'Customer dinner — Acme deal', 320, 'Meals & Entertainment', '2026-04-28', 'approved', '22222222-2222-2222-2222-222222222222', 'Demo User'),
  ('11111111-1111-1111-1111-111111111111', 'AWS training course',         499, 'Education',             '2026-05-01', 'pending',  '22222222-2222-2222-2222-222222222222', 'Demo User'),
  ('11111111-1111-1111-1111-111111111111', 'Office supplies',              87, 'Office',                '2026-05-02', 'pending',  '22222222-2222-2222-2222-222222222222', 'Demo User')
ON CONFLICT DO NOTHING;

-- ─── Category rules (org-specific, higher priority than system-wide) ──────────

INSERT INTO category_rules (org_id, pattern, category, transaction_type, priority) VALUES
  ('11111111-1111-1111-1111-111111111111', 'AWS',         'Infrastructure',        'expense', 100),
  ('11111111-1111-1111-1111-111111111111', 'Vercel',      'Infrastructure',        'expense', 100),
  ('11111111-1111-1111-1111-111111111111', 'Stripe',      'SaaS Revenue',          'income',  100),
  ('11111111-1111-1111-1111-111111111111', 'payroll',     'Payroll',               'expense', 100),
  ('11111111-1111-1111-1111-111111111111', 'Consulting',  'Consulting Revenue',    'income',   90)
ON CONFLICT DO NOTHING;
