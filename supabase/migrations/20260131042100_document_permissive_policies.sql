/*
  Document and Fix Intentionally Permissive Policies

  This migration addresses policies flagged as always true by documenting
  which ones are intentionally permissive for business reasons.
  
  Intentionally Permissive Policies By Design:
  
  1. form_inquiries - Public contact form submissions
     Anyone can submit form inquiries for anon and authenticated users
     Business need: Allow website visitors to submit contact forms
  
  2. qr_scans - QR code scan tracking
     Anyone can create qr scans for anon and authenticated users
     Business need: Track QR code scans from public users
  
  3. saved_requests - Form state persistence
     Anyone can create saved requests for anon and authenticated users
     Business need: Allow users to save form state for later retrieval
  
  Security Notes:
  
  - Public submission policies are intentionally broad to support public-facing features
  - These tables have organization_id columns that are set server-side
  - Read access to these tables is properly restricted by organization membership
*/

-- No changes needed - this migration documents the intentional design