# Jobs Import/Export Guide

## Overview

The Analytics Dashboard and Jobs page now include full import/export functionality to help you manage your job data efficiently.

## Export Functionality

### How to Export

1. Navigate to either the **Analytics Dashboard** or **Jobs** page
2. Click the **Export** button in the header
3. A CSV file will automatically download with all your job data

### Export Format

The exported CSV includes 29 columns matching your Google Sheets format:

- Client Name
- Client Phone
- Client Email
- Client Address
- Work Address (blank when the work happened at the client's address)
- Job Type
- Job Description
- Status
- Date Quoted
- Date Scheduled
- Date Completed
- Lost Reason Category
- Lost Reason Notes
- Status Changed At
- Hours Worked
- Quoted Price
- Final Price
- Materials/Extra Cost
- Def (placeholder column)
- Location (City)
- State
- Location (City) State
- Payment Method
- Payment Date
- Reviews Received
- Google Review Link Sent
- Repeat Client
- Referral Source
- Notes

### Notes on Export

- Dates are formatted as M/D/YYYY (e.g., 1/15/2025)
- Boolean fields export as "Yes" or "No"
- Client Address is shared with the client profile; editing it on either side updates the other
- Work Address is only filled in when the work happened somewhere other than the client's address
- Numbers export without currency symbols or commas
- Analytics Dashboard export respects time period filter (Current Year vs All Time)
- Jobs page exports all jobs

## Import Functionality

### How to Import

1. Navigate to either the **Analytics Dashboard** or **Jobs** page
2. Click the **Import** button in the header
3. Download the CSV template (optional but recommended)
4. Upload your CSV file by dragging and dropping or clicking "Browse Files"
5. Review validation results
6. If errors are found, download the error report and fix your CSV
7. If validation passes, preview the data and click "Confirm Import"

### Preparing Your Google Sheets Data

To import from Google Sheets:

1. Open your Google Sheet with job data
2. Make sure your columns match the format shown in the template
3. Go to **File > Download > Comma Separated Values (.csv)**
4. Use the import feature to upload this CSV file

### Column Requirements

**Required Columns:**
- Client Name (must have a value)

**Optional Columns:**
All other columns are optional and can be left empty.

### Data Format Requirements

**Dates:**
- Accepts multiple formats: M/D/YYYY, MM/DD/YYYY, YYYY-MM-DD
- Examples: 1/15/2025, 01/15/2025, 2025-01-15

**Numbers:**
- Can include or exclude currency symbols
- Can include or exclude commas
- Examples: 150, $150, $150.00, 150.00

**Booleans (Yes/No fields):**
- Accepts: Yes, No, True, False, TRUE, FALSE, 1, 0, Y, N, T, F
- Case insensitive
- Empty = No/False

**Text Fields:**
- Can contain any text including commas and quotes
- Will be properly escaped in CSV format

### Validation

The import system validates your data before any database changes:

**Strict Validation:**
- Client Name must be present
- Date formats must be valid
- Numeric fields must contain valid numbers

**Flexible Validation:**
- Cities not in your service areas list will still be accepted
- Payment methods not in your list will still be accepted
- Referral sources not in your predefined list will still be accepted

If validation fails:
1. A detailed error report will be displayed
2. You can download the error report as CSV
3. Fix the errors in your source file
4. Try importing again

No data is saved until validation passes completely.

### Import Preview

Before confirming import:
- You'll see a preview of the first 10 jobs
- Total count of jobs to be imported is displayed
- You can cancel at any time before confirming

### After Import

- Success message shows count of imported jobs
- Job list automatically refreshes
- New jobs appear immediately with real-time updates
- Analytics dashboard metrics update automatically

## Tips for Success

1. **Use the Template**: Download the CSV template to see the exact format expected
2. **Test with Small Data**: Import a few jobs first to verify everything works
3. **Check Your Data**: Review dates, numbers, and required fields before importing
4. **Keep Backups**: Export your data regularly as a backup
5. **Fix Validation Errors**: Use the error report to quickly identify and fix issues

## Troubleshooting

**Problem**: Import shows validation errors
- **Solution**: Download the error report to see specific issues with row numbers and fields

**Problem**: Dates are showing as errors
- **Solution**: Make sure dates are in M/D/YYYY, MM/DD/YYYY, or YYYY-MM-DD format

**Problem**: Numbers are showing as errors
- **Solution**: Remove any text from number fields (keep only digits, decimal points, and optional $ symbol)

**Problem**: Import button is disabled
- **Solution**: Make sure you're logged in as an admin user

**Problem**: CSV has extra columns
- **Solution**: Extra columns are ignored - only the specified columns are imported

## Getting Your Google Sheets Data

To export from Google Sheets:

1. Open your Google Sheet
2. Select the sheet/tab with your job data
3. Go to **File > Download > Comma Separated Values (.csv)**
4. Save the file to your computer
5. Use the Import button and upload this file

The system will automatically match the column headers from your Google Sheet to the database fields.
