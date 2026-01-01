# Leaked Password Protection Setup

## Overview

This document provides instructions for enabling Leaked Password Protection in Supabase, which prevents users from setting passwords that have been compromised in known data breaches.

## What is Leaked Password Protection?

Supabase Auth can check passwords against the HaveIBeenPwned.org database of compromised passwords. When enabled, this feature prevents users from:
- Signing up with a compromised password
- Changing their password to a compromised one
- Resetting their password to a compromised one

This significantly enhances account security by ensuring users don't use passwords that are already known to attackers.

## How to Enable

### Step 1: Access Supabase Dashboard

1. Log in to your [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project

### Step 2: Navigate to Authentication Settings

1. Click on **Authentication** in the left sidebar
2. Click on **Policies** tab

### Step 3: Enable the Feature

1. Scroll down to find **Leaked Password Protection**
2. Toggle the switch to **Enable**
3. The setting is saved automatically

## What Happens When Enabled

### For New Sign-ups

When a user attempts to sign up with a compromised password:
```javascript
const { data, error } = await supabase.auth.signUp({
  email: 'user@example.com',
  password: 'password123' // This is a known compromised password
});

// error will contain:
// {
//   message: "Password is too weak",
//   status: 422
// }
```

### For Password Changes

When a user attempts to change to a compromised password:
```javascript
const { data, error } = await supabase.auth.updateUser({
  password: 'password123' // This is a known compromised password
});

// error will contain:
// {
//   message: "Password is too weak",
//   status: 422
// }
```

## Best Practices

1. **Enable Immediately**: This feature should be enabled as soon as possible to protect your users
2. **User Communication**: Inform users that password requirements include checking against known breaches
3. **Error Handling**: Update your frontend to handle password strength errors gracefully
4. **Password Requirements**: Combine with other password requirements like:
   - Minimum 8 characters (Supabase default)
   - Mix of uppercase, lowercase, numbers, and special characters
   - Not similar to email address

## Implementation in Your Application

The feature works automatically once enabled. No code changes are required, but you should:

1. **Update error messages** to be user-friendly:
```typescript
if (error?.message === "Password is too weak") {
  // Show user-friendly message
  showError("This password has been found in data breaches. Please choose a different password.");
}
```

2. **Provide password strength indicators** to help users choose strong passwords
3. **Suggest using a password manager** for generating secure passwords

## Checking Current Status

You can verify if the feature is enabled by:

1. Going to your Supabase Dashboard
2. Authentication → Policies
3. Looking for the **Leaked Password Protection** toggle

## Additional Resources

- [Supabase Auth Documentation](https://supabase.com/docs/guides/auth)
- [HaveIBeenPwned Password API](https://haveibeenpwned.com/API/v3#PwnedPasswords)
- [OWASP Password Guidelines](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html)

## Support

If you encounter issues enabling this feature, contact Supabase support or check their documentation for the latest updates.
