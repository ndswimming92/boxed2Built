-- Coupon code validation test cases
-- Run in a non-production environment after migrations, inside a transaction
-- you roll back:  BEGIN;  \i coupon_test_cases.sql  ROLLBACK;
--
-- Covers the three things the application trusts the database to get right:
-- which codes the public lookup will admit to, that a submitted inquiry counts
-- against its coupon, and that a bad coupon cannot be stored at all.

\set business_id '(SELECT id FROM business_info WHERE is_active LIMIT 1)'

INSERT INTO coupons (business_id, code, discount_type, discount_value)
VALUES (:business_id, 'TESTLIVE25', 'fixed', 25);
INSERT INTO coupons (business_id, code, discount_type, discount_value, is_active)
VALUES (:business_id, 'TESTPAUSED', 'percentage', 10, false);
INSERT INTO coupons (business_id, code, discount_type, discount_value, starts_at)
VALUES (:business_id, 'TESTSOON', 'fixed', 5, now() + interval '7 days');
INSERT INTO coupons (business_id, code, discount_type, discount_value, starts_at, ends_at)
VALUES (:business_id, 'TESTPAST', 'fixed', 15, now() - interval '30 days', now() - interval '1 day');

-- Expected: one row, whatever casing or padding the customer typed.
SELECT code, discount_type, discount_value FROM lookup_coupon_by_code('testlive25');
SELECT code FROM lookup_coupon_by_code('  TESTLIVE25 ');

-- Expected: zero rows for each. A paused, unstarted or expired code has to be
-- indistinguishable from one that does not exist, or the form becomes a way to
-- enumerate upcoming promotions.
SELECT count(*) AS should_be_0 FROM lookup_coupon_by_code('TESTPAUSED');
SELECT count(*) AS should_be_0 FROM lookup_coupon_by_code('TESTSOON');
SELECT count(*) AS should_be_0 FROM lookup_coupon_by_code('TESTPAST');
SELECT count(*) AS should_be_0 FROM lookup_coupon_by_code('TESTNOSUCHCODE');

-- Expected: 1. A window that opens today is open today, which is what the
-- admin page's date fields promise.
UPDATE coupons
SET starts_at = date_trunc('day', now()), ends_at = date_trunc('day', now()) + interval '1 day'
WHERE code = 'TESTSOON';
SELECT count(*) AS should_be_1 FROM lookup_coupon_by_code('TESTSOON');

-- Expected: times_used = 2, last_used_at set. Inquiries are inserted by `anon`,
-- which has no rights on `coupons`, so this proves the definer-rights trigger.
INSERT INTO form_inquiries (business_id, client_name, client_email, furniture_type, pieces,
                            coupon_code, coupon_discount_type, coupon_discount_value, coupon_discount_amount)
VALUES (:business_id, 'Coupon Test A', 'test-a@example.com', 'IKEA', 1, 'TESTLIVE25', 'fixed', 25, 25),
       (:business_id, 'Coupon Test B', 'test-b@example.com', 'IKEA', 2, 'testlive25', 'fixed', 25, 25);
SELECT code, times_used AS should_be_2, last_used_at IS NOT NULL AS should_be_true
FROM coupons WHERE code = 'TESTLIVE25';

-- Expected: both rows keep their discount. The quote a customer was already
-- given must survive the coupon being withdrawn.
DELETE FROM coupons WHERE code = 'TESTLIVE25';
SELECT client_name, coupon_code, coupon_discount_amount
FROM form_inquiries WHERE client_email LIKE 'test-%@example.com' ORDER BY client_name;

-- Expected: every one of these raises. Run them one at a time; each aborts the
-- transaction, so re-issue BEGIN between them if you are inside one.
--   INSERT INTO coupons (business_id, code, discount_type, discount_value) VALUES (:business_id, 'lowercase', 'fixed', 5);        -- code must be uppercase
--   INSERT INTO coupons (business_id, code, discount_type, discount_value) VALUES (:business_id, 'AB', 'fixed', 5);               -- at least 3 characters
--   INSERT INTO coupons (business_id, code, discount_type, discount_value) VALUES (:business_id, 'TESTZERO', 'fixed', 0);         -- must be worth something
--   INSERT INTO coupons (business_id, code, discount_type, discount_value) VALUES (:business_id, 'TESTOVER', 'percentage', 150);  -- percentages cap at 100
--   INSERT INTO coupons (business_id, code, discount_type, discount_value) VALUES (:business_id, 'TESTBAD', 'half-off', 5);       -- unknown discount type
--   INSERT INTO coupons (business_id, code, discount_type, discount_value, starts_at, ends_at)
--     VALUES (:business_id, 'TESTBACK', 'fixed', 5, now(), now() - interval '1 day');                                             -- window runs backwards
--   INSERT INTO coupons (business_id, code, discount_type, discount_value) VALUES (:business_id, 'TESTSOON', 'fixed', 5);         -- code already taken

-- Expected: raises "Too many code lookups" partway through — the public lookup
-- is throttled at 20 attempts per IP per 15 minutes.
--   DO $$ DECLARE i integer; BEGIN
--     FOR i IN 1..25 LOOP PERFORM * FROM lookup_coupon_by_code('GUESS' || i); END LOOP;
--   END $$;
