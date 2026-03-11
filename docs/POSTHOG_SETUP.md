# Analytics Setup Guide

This project no longer uses the previous product analytics provider.

## Current analytics

- Google Analytics 4 is loaded lazily at runtime.
- Configuration happens in `src/utils/analyticsLoader.ts`.
- Event helpers live in `src/utils/analytics.ts`.

## Environment variables

No additional analytics SDK keys are required beyond GA configuration already in code.
