/*
  # Enable pgcrypto extension for client tokens

  ## Overview
  Enables the pgcrypto extension which provides the gen_random_bytes function
  needed for generating secure client preference tokens.

  ## Changes
  - Enables pgcrypto extension if not already enabled
*/

-- Enable pgcrypto extension for gen_random_bytes
CREATE EXTENSION IF NOT EXISTS pgcrypto;
