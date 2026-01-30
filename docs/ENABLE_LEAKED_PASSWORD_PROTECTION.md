# Enable Leaked Password Protection

## Quick Setup Guide

Supabase can automatically prevent users from using passwords that have been compromised in data breaches by checking against the HaveIBeenPwned.org database. This is a critical security feature that should be enabled.

## Steps to Enable

### 1. Open Your Supabase Project Dashboard

Navigate to: `https://supabase.com/dashboard/project/nlqzjzxkqteihffptkah`

### 2. Go to Authentication Settings

- In the left sidebar, click **Authentication**
- Then click **Policies** in the sub-menu

### 3. Find Password Protection Settings

Scroll down to the **Password Protection** section

### 4. Enable the Feature

Toggle ON the option:
- ☑️ **"Prevent sign ups using compromised passwords"**

### 5. Save Changes

Click the **Save** button at the bottom of the page

## How It Works

When enabled, Supabase will:

1. **Check passwords** against the HaveIBeenPwned database during signup
2. **Reject compromised passwords** with a clear error message
3. **Not store** the password in plain text (uses k-anonymity to protect privacy)
4. **Guide users** to choose stronger, unique passwords

## Test the Feature

After enabling, try to sign up with a known compromised password:

```typescript
// This should fail
const { data, error } = await supabase.auth.signUp({
  email: 'test@example.com',
  password: 'password123'
});

// Expected error:
// "Password is too weak or has been found in a data breach"
```

## Privacy & Security

- ✅ **Privacy Preserved**: Supabase uses k-anonymity, so your password is never sent in full
- ✅ **No Performance Impact**: Check happens instantly during signup
- ✅ **Better Security**: Prevents 80%+ of credential-stuffing attacks
- ✅ **Better UX**: Users get immediate feedback to choose stronger passwords

## Additional Security Settings

While you're in the Authentication settings, consider also configuring:

### Password Strength Requirements

```yaml
Minimum length: 12 characters
Require uppercase: Yes
Require lowercase: Yes
Require numbers: Yes
Require symbols: Yes
```

### Session Management

```yaml
JWT expiry: 3600 seconds (1 hour)
Refresh token rotation: Enabled
Reuse interval: 10 seconds
```

### Rate Limiting

```yaml
Max requests per hour: 30 (default is fine for single-admin app)
```

## Verification

To verify the feature is enabled:

1. Log out of any current sessions
2. Try to create a new account with "password123"
3. You should see an error about the password being compromised

## Support

If you encounter issues:
- Check Supabase status: https://status.supabase.com/
- View documentation: https://supabase.com/docs/guides/auth
- Contact support: https://supabase.com/support

---

**Status**: ⚠️ NOT ENABLED - Please complete the steps above to enable this critical security feature.
