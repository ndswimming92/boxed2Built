# Burn Rate & Runway Page — Build Guide

A guide to replicating the **Burn Rate & Runway** admin page. It answers one question:

> Given the cash I have right now and every recurring subscription I pay, **when does my money run out?**

You enter a cash balance and a list of subscriptions (name, amount, billing cycle, next due date). The page then shows:

- Monthly and annual burn, and the average daily cost
- **Daily to Cover**: how much to set aside per day so each bill is covered by its due date
- **Runway**: days and months left, and the projected date the balance hits $0
- A **burndown chart** of the balance over time, with a step down at each real due date
- An **upcoming payments** bar chart for the next 12 months. Click a month to see its charges.
- A **cost breakdown** donut chart
- A **what-if toggle** per subscription. Switch a subscription off to see how much you'd save and how runway changes. Nothing is saved.

---

## 1. Tech stack

| Piece | What we use | Notes |
|---|---|---|
| UI | React + TypeScript | Swap in your own framework if needed. The math in section 4 is framework-free. |
| Styling | Tailwind CSS | |
| Charts | `recharts` | `AreaChart`, `BarChart`, `PieChart` |
| Icons | `lucide-react` | |
| Database / auth | Supabase (Postgres) | Any SQL database works. Only 2 tables are needed. |

```bash
npm install recharts lucide-react @supabase/supabase-js
```

---

## 2. File layout

```
supabase/migrations/<timestamp>_create_subscription_burn_rate_system.sql   # 2 tables + RLS
src/services/burnRateService.ts          # ALL the math + database calls (the brain)
src/pages/admin/BurnRatePage.tsx         # the page (state, charts, table)
src/components/admin/SubscriptionFormModal.tsx   # add/edit a subscription
src/components/admin/BalanceUpdateModal.tsx      # record cash balance
```

Wire-up (2 lines):

```tsx
// routes
const BurnRatePage = React.lazy(() => import('./pages/admin/BurnRatePage'));
{ path: 'burn-rate', Component: BurnRatePage },

// sidebar nav
{ name: 'Burn Rate', href: '/admin/burn-rate', icon: Flame },
```

---

## 3. Database (2 tables)

Our tables reference a `business_info(id)` table. If you only have one business, you can drop `business_id` entirely or point it at your own tenant/user table.

```sql
CREATE TABLE IF NOT EXISTS business_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES business_info(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  amount numeric(12, 2) NOT NULL CHECK (amount >= 0),
  billing_cycle text NOT NULL DEFAULT 'monthly'
    CHECK (billing_cycle IN ('weekly','biweekly','monthly','quarterly','semiannually','yearly')),
  next_due_date date,
  category text,
  is_active boolean DEFAULT true,          -- soft delete
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS business_balance_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES business_info(id) ON DELETE CASCADE,
  balance numeric(14, 2) NOT NULL,         -- total cash on hand
  note text,
  recorded_at date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE business_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE business_balance_snapshots ENABLE ROW LEVEL SECURITY;

-- Admin-only access. These tables hold financial data, so NEVER use USING (true):
-- that lets every signed-in account (including customers) read and change them.
-- Helper: reads an admin flag from the signed-in user's JWT (app_metadata, which
-- users cannot edit themselves). Set it for your admin accounts, e.g. in the
-- Supabase dashboard or with the service-role admin API:
--   app_metadata = { "is_platform_admin": true }
CREATE OR REPLACE FUNCTION public.is_platform_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT COALESCE((auth.jwt() -> 'app_metadata' ->> 'is_platform_admin')::boolean, false);
$$;

-- business_subscriptions: admins only, for all four operations
CREATE POLICY "Admins can view business subscriptions"
  ON public.business_subscriptions FOR SELECT TO authenticated
  USING (public.is_platform_admin());
CREATE POLICY "Admins can insert business subscriptions"
  ON public.business_subscriptions FOR INSERT TO authenticated
  WITH CHECK (public.is_platform_admin());
CREATE POLICY "Admins can update business subscriptions"
  ON public.business_subscriptions FOR UPDATE TO authenticated
  USING (public.is_platform_admin()) WITH CHECK (public.is_platform_admin());
CREATE POLICY "Admins can delete business subscriptions"
  ON public.business_subscriptions FOR DELETE TO authenticated
  USING (public.is_platform_admin());

-- business_balance_snapshots: the same four policies, admins only
CREATE POLICY "Admins can view balance snapshots"
  ON public.business_balance_snapshots FOR SELECT TO authenticated
  USING (public.is_platform_admin());
CREATE POLICY "Admins can insert balance snapshots"
  ON public.business_balance_snapshots FOR INSERT TO authenticated
  WITH CHECK (public.is_platform_admin());
CREATE POLICY "Admins can update balance snapshots"
  ON public.business_balance_snapshots FOR UPDATE TO authenticated
  USING (public.is_platform_admin()) WITH CHECK (public.is_platform_admin());
CREATE POLICY "Admins can delete balance snapshots"
  ON public.business_balance_snapshots FOR DELETE TO authenticated
  USING (public.is_platform_admin());

CREATE INDEX IF NOT EXISTS idx_business_subscriptions_business_id ON business_subscriptions(business_id);
CREATE INDEX IF NOT EXISTS idx_business_subscriptions_is_active ON business_subscriptions(is_active);
CREATE INDEX IF NOT EXISTS idx_business_subscriptions_next_due_date ON business_subscriptions(next_due_date);
CREATE INDEX IF NOT EXISTS idx_business_balance_snapshots_business_id ON business_balance_snapshots(business_id);
CREATE INDEX IF NOT EXISTS idx_business_balance_snapshots_recorded_at ON business_balance_snapshots(recorded_at);

-- Keep updated_at fresh
CREATE OR REPLACE FUNCTION set_subscription_updated_at() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at := now(); RETURN NEW; END; $$;

DROP TRIGGER IF EXISTS trigger_set_subscription_updated_at ON business_subscriptions;
CREATE TRIGGER trigger_set_subscription_updated_at
  BEFORE UPDATE ON business_subscriptions
  FOR EACH ROW EXECUTE FUNCTION set_subscription_updated_at();
```

**Design decisions to copy:**

- **The balance is a history of snapshots, not one editable number.** Each "Update Balance" inserts a new row. The *current balance* is the newest row, ordered by `recorded_at` and then `created_at`. Older rows are your balance history.
- **Deleting a subscription is a soft delete.** It sets `is_active = false`. Queries filter on `is_active = true`.
- **The "current balance" is manual.** The page does not read your bank. You type in your cash on hand.

---

## 4. The math (`burnRateService.ts`)

This file holds all of the logic, and the page only renders what it returns. These are the concepts, with the key formulas.

### 4.1 Normalizing every cost to a common unit

```ts
chargesPerYear: weekly=52, biweekly=26, monthly=12, quarterly=4, semiannually=2, yearly=1
monthlyAmount = amount * chargesPerYear / 12
annualAmount  = amount * chargesPerYear
DAYS_PER_YEAR = 365.25
DAYS_PER_MONTH = 365.25 / 12
```

### 4.2 Burn metrics (`computeBurnMetrics`)

For all **active** subscriptions:

| Metric | Formula |
|---|---|
| `monthlyBurn` | sum of `monthlyAmount` for each subscription |
| `annualBurn` | `monthlyBurn * 12` |
| `weeklyBurn` | `annualBurn / 52` |
| `dailyBurn` | `annualBurn / 365.25` (steady average) |
| `dailyToCoverTotal` | sum of `amount / daysUntilDue` per subscription |
| `runwayDays` | days from today to `zeroDate` |
| `runwayMonths` | `runwayDays / 30.44` |
| `zeroDate` | from the burndown projection (see 4.5) |

### 4.3 Two kinds of "daily" cost

- **Average daily** (`steadyDaily`) is `annualAmount / 365.25`. It is the long-run cost per day.
- **Daily to cover** (`dailyToCover`) is `amount / daysUntilDue`, with a minimum of 1 day. It is what you need to set aside each day so this particular bill is paid by its due date. It rises as the due date gets closer.

### 4.4 Due-date logic (the part that is easy to get wrong)

- **Everything is date-only in UTC.** This avoids timezone drift.
- A subscription stores one `next_due_date`. If that date has passed, the code **rolls it forward** by the billing cycle until it is today or later (a 10/20 monthly bill becomes 11/20).
- Occurrences are always computed **from the original anchor date**: `occurrence(anchor, cycle, k)`. They are never chained. If you chain, a bill due on the 31st drifts to the 28th after February and stays there. Computing from the anchor makes it return to the 31st.
- `addMonths` clamps to the last day of the target month (Jan 31 + 1 month = Feb 28).
- A subscription with no due date is assumed to first charge one full interval from today.

```ts
function occurrence(anchor, cycle, k) {
  weekly: addDays(anchor, 7k);   biweekly: addDays(anchor, 14k);
  monthly: addMonths(anchor, k); quarterly: addMonths(anchor, 3k);
  semiannually: addMonths(anchor, 6k); yearly: addMonths(anchor, 12k);
}
```

### 4.5 Burndown projection (`projectBurndown`)

This produces the headline chart and the runway.

1. Call `enumerateCharges(sub, today, today + 60 months)` for each active subscription. This produces every real charge event `{date, amount, name}`.
2. Sort all events by date.
3. Walk the sorted events, subtracting each amount from the balance. **The first date the running balance is `<= 0` is the `zeroDate`.**
4. Build monthly sample points. For each month boundary, `balance = startBalance - (sum of charges on or before that boundary)`, floored at 0. The first point is labelled "Now".
5. The chart spans until the balance hits zero (up to 60 months), or 12 months if it never does.

The chart is **schedule-accurate**. An annual renewal appears as a single step down on its real date, not a smoothed monthly average. The average-based metrics (monthly and daily burn) are shown separately.

### 4.6 Other helpers

- `upcomingPayments(subs, 12)` buckets real charges into the next 12 calendar months, for the bar chart.
- `chargesInMonth(subs, "YYYY-MM")` lists the individual charges in one month, for the click-a-bar detail list. For the current month it only counts charges from today onward, so it always matches the bar.
- `subscriptionCostBreakdown(subs)` gives each subscription's monthly-normalized cost, sorted largest first, for the donut chart.

### 4.7 Database calls

```ts
getSubscriptions(businessId)      // select * where is_active, order by name
createSubscription(sub)           // insert
updateSubscription(id, updates)   // update
deleteSubscription(id)            // update { is_active: false }  (soft delete)
getLatestBalance(businessId)      // newest snapshot: order recorded_at desc, created_at desc, limit 1
getBalanceHistory(businessId, 24) // for future trend charts (not used on the page yet)
recordBalance(snapshot)           // insert a new snapshot
```

### 4.8 Types

```ts
type BillingCycle = 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'semiannually' | 'yearly';

interface Subscription {
  id: string; business_id: string; name: string; description: string | null;
  amount: number; billing_cycle: BillingCycle; next_due_date: string | null; // 'YYYY-MM-DD'
  category: string | null; is_active: boolean; created_at: string; updated_at: string;
}

interface BalanceSnapshot {
  id: string; business_id: string; balance: number; note: string | null;
  recorded_at: string; created_at: string;
}
```

> **The full source of `burnRateService.ts` is in your repo at `src/services/burnRateService.ts`.** It is about 590 lines and has no UI dependencies, so you can copy it as-is. Only the Supabase table names and client import would change.

---

## 5. The page (`BurnRatePage.tsx`)

### 5.1 State

```ts
subscriptions        // all active subs from the DB
latestBalance        // newest snapshot (or null)
excludedIds          // Set<string> of what-if toggles (never saved)
selectedMonth        // "YYYY-MM" clicked on the bar chart, or null
showSubModal / editingSub / showBalanceModal
```

On mount it loads the business id, then fetches subscriptions and the latest balance in parallel.

### 5.2 The what-if feature

This is the best part of the page.

```ts
const scenarioSubs = subscriptions.filter(s => !excludedIds.has(s.id));

const baseline = computeBurnMetrics(subscriptions, currentBalance);   // real setup
const metrics  = computeBurnMetrics(scenarioSubs, currentBalance);    // with toggles applied
const burndown = projectBurndown(scenarioSubs, currentBalance);
const upcoming = upcomingPayments(scenarioSubs, 12);
const costBreakdown = subscriptionCostBreakdown(scenarioSubs);
```

**Every tile, chart and list is computed from `scenarioSubs`.** Toggling a switch off updates everything instantly. When anything is toggled off, an amber banner shows the savings: `baseline.monthlyBurn - metrics.monthlyBurn` per month, per year and per day, plus runway going from X days to Y days. It has a Reset button and the note "Simulation only — nothing is saved."

### 5.3 Layout, top to bottom

1. **Header** with the title "Burn Rate & Runway", an **Update Balance** button and an **Add Subscription** button.
2. **Warning banner** shown only if no balance has been recorded ("Set your starting balance").
3. **Sticky summary strip** (`sm:sticky sm:top-[73px]`) containing the what-if banner and 5 stat tiles:
   - **Current Balance**, with an "as of" date
   - **Monthly Burn**, with the annual figure underneath
   - **Daily to Cover**, with the average daily figure underneath
   - **Runway**, shown as months, or years once it is 24 months or more. It also shows days left.
   - **Projected Empty**, the date, with the count of active subscriptions
4. **Cash Burndown Projection**, an `AreaChart` with an emerald gradient fill, a red dashed `ReferenceLine` at y=0, and a sentence under it: "At your current burn, your balance reaches $0 around {date}."
5. **Two-column row:**
   - **Upcoming Payments (12 mo)**, a `BarChart`. Clicking a bar selects that month. The selected bar stays dark blue and the others fade to light blue. A panel below lists that month's charges, sorted by date, with a total.
   - **Monthly Cost Breakdown**, a donut `PieChart` (inner radius 55, outer 95) with a legend.
6. **Subscriptions table** with columns: On (toggle), Subscription (name and notes), Category, Billing, Amount, Monthly (with /yr underneath), Next Due, Daily (daily-to-cover with the average underneath), and Edit/Delete actions.
7. The two modals.

### 5.4 Runway severity colouring

```ts
runwayMonths < 3  → 'critical'  (red tile, red text)
runwayMonths < 6  → 'warning'   (amber tile, amber text)
otherwise         → 'ok'        (white tile)
// no burn → label "No burn";  burn but never hits zero → "∞"
```

### 5.5 Chart colours

```ts
const COLORS = ['#10b981','#3b82f6','#f59e0b','#8b5cf6','#14b8a6','#ef4444','#06b6d4','#f97316'];
```

The burndown chart uses emerald `#10b981`. The bar chart uses blue `#3b82f6`, fading to `#bfdbfe` for unselected bars.

### 5.6 Currency and privacy mode (optional)

All money values go through `formatCurrency`, which uses `Intl.NumberFormat('en-US', {style:'currency', currency:'USD'})`. The result is then passed through `maskFinancialValue()` from a `PrivacyModeContext`. When privacy mode is on, values show as `$••••`, which is useful when you screen-share. **This is optional.** If you don't have one, make `maskFinancialValue = (v) => String(v)`.

### 5.7 Modals

**SubscriptionFormModal** fields: Name (required), Amount (required, `step 0.01`), Billing Cycle (dropdown of the 6 cycles), Next Due Date (date input, defaults to today), Category (free text), Notes. It shows a live "Normalized cost: $X/mo · $Y/yr" box as you type.

**BalanceUpdateModal** fields: Total Balance (required), As Of Date (defaults to today), Note (e.g. "After customer payment"). Saving **inserts a new snapshot**.

Both modals are bottom sheets on mobile (`items-end`, `rounded-t-xl`) and centred dialogs on desktop. They also respect `env(safe-area-inset-bottom)`.

---

## 6. Gotchas

1. **Use UTC date-only math everywhere**, or due dates will shift by a day depending on the user's timezone.
2. **Compute recurrences from the original anchor.** Never add one interval to the previous result.
3. **Use the real charge schedule for runway, not `balance / monthlyBurn`.** The simple division is wrong when you have annual or quarterly bills. The schedule-based approach gets it right.
4. **Floor chart balances at 0** so the line doesn't dive negative.
5. **Cap the loops.** The occurrence loops stop at 5,000 iterations as a safety guard.
6. **The soft delete means the DELETE RLS policy is never used.** Keep it anyway, or remove it for stricter security.
7. **Lock the data to admins.** The policies above use `is_platform_admin()`, so only accounts flagged as admin in their JWT `app_metadata` can read or change this data. If your site has customer logins, do not use `USING (true)`: it exposes your balance and bills to every signed-in customer. If you have multiple tenants, also scope by `business_id`. Also hide the admin page route from non-admins in the UI, but treat the database policies as the real protection.

---

## 7. Ideas for extending it

- Show `getBalanceHistory()` as a line chart (the service function already exists).
- Auto-advance `next_due_date` when a bill is paid.
- Pull the balance from a bank API (e.g. Plaid) instead of typing it.
- Add monthly **income** to get *net* burn.
- Email or Slack alerts when runway drops below 3 months.
- Group the donut chart by category instead of by subscription.

---

## 8. Quick-start order of operations

1. Run the SQL migration to create the 2 tables.
2. Copy `burnRateService.ts` and change the Supabase import path.
3. Copy the two modals, then `BurnRatePage.tsx`.
4. Install `recharts` and `lucide-react`.
5. Add the route and the nav link.
6. Open the page, click **Update Balance**, and add a few subscriptions.
