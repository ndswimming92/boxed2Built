# Portal Stabilization: SLOs, Synthetic Monitoring, and Alerts

## Synthetic Monitors

Run synthetic probes with:

```bash
node scripts/synthetic-monitor.mjs > synthetic-results.json
node scripts/check-slo-thresholds.mjs synthetic-results.json
```

### Covered probes
- **Login availability**: `GET /portal/login`
- **Dashboard availability/load**: `GET /portal/dashboard`
- **Invoice open path**: `GET /pay/:invoiceId` (uses `SYNTHETIC_INVOICE_ID`)

## SLO Targets

- **Auth availability SLO**: login failure rate < **1%** over rolling 30 days.
- **Portal API latency SLO**: p95 synthetic latency < **800ms** over rolling 30 days.

Environment overrides supported:
- `SLO_AUTH_FAILURE_RATE` (default `0.01`)
- `SLO_API_P95_LATENCY_MS` (default `800`)

## Alerting policy

Set dashboard alerts with these thresholds:

1. **Auth failure burn alert (page)**
   - Trigger: auth failure rate > 3% for 15m
   - Escalation: page on-call
2. **Auth failure warning (ticket)**
   - Trigger: auth failure rate > 1% for 60m
3. **API latency burn alert (page)**
   - Trigger: p95 latency > 1200ms for 15m
4. **API latency warning (ticket)**
   - Trigger: p95 latency > 800ms for 60m

## Dashboard panels (minimum)

- Login success/failure rate (5m and 1h windows)
- Portal endpoint p50/p95 latency
- Synthetic probe pass/fail timeline
- Invoice open endpoint health

These settings are intended for your metrics platform (Grafana, Datadog, New Relic, etc.) and can be mapped directly to the synthetic JSON output and existing API telemetry.
