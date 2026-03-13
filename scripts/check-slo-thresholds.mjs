#!/usr/bin/env node

import fs from 'node:fs/promises';

const filePath = process.argv[2] || 'synthetic-results.json';
const authFailureRate = Number(process.env.SLO_AUTH_FAILURE_RATE || 0.01);
const apiP95LatencyMs = Number(process.env.SLO_API_P95_LATENCY_MS || 800);

const text = await fs.readFile(filePath, 'utf8');
const report = JSON.parse(text);
const checks = Array.isArray(report.checks) ? report.checks : [];

const authChecks = checks.filter((c) => String(c.name).includes('login'));
const authFailures = authChecks.filter((c) => !c.ok).length;
const authRate = authChecks.length > 0 ? authFailures / authChecks.length : 0;

const latencies = checks
  .map((c) => Number(c.durationMs || 0))
  .filter((v) => Number.isFinite(v))
  .sort((a, b) => a - b);

const p95Index = Math.max(0, Math.ceil(latencies.length * 0.95) - 1);
const p95 = latencies[p95Index] || 0;

const violations = [];
if (authRate > authFailureRate) {
  violations.push(`Auth failure rate ${authRate.toFixed(3)} is above SLO ${authFailureRate.toFixed(3)}`);
}
if (p95 > apiP95LatencyMs) {
  violations.push(`Synthetic latency p95 ${p95}ms is above SLO ${apiP95LatencyMs}ms`);
}

console.log(JSON.stringify({ authRate, p95, violations }, null, 2));

if (violations.length > 0) {
  process.exitCode = 1;
}
