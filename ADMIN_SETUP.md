# Admin System Setup Guide

## Overview

Your website now has a complete admin system that allows you to manage all your business content through a secure web interface.

## IMPORTANT: Authorization Setup

Your admin portal now has enhanced security with email-based authorization. Only specific email addresses listed in your configuration can access the admin portal.

### Configure Authorized Admin Emails

1. **Open the `.env` file** in your project root
2. **Find the line**: `VITE_AUTHORIZED_ADMIN_EMAILS=`
3. **Add your admin email(s)**:
   - Single email: `VITE_AUTHORIZED_ADMIN_EMAILS=your-email@gmail.com`
   - Multiple emails: `VITE_AUTHORIZED_ADMIN_EMAILS=email1@gmail.com,email2@gmail.com,email3@gmail.com`
4. **Save the file** and restart your development server or redeploy

**Important**:
- Email addresses are case-insensitive
- Use commas to separate multiple emails
- No spaces needed around commas
- Users with emails NOT in this list will be denied access and automatically signed out


## Customer Portal OAuth Setup

To enable dedicated customer sign-in flow, configure these environment variables in your deployment and local `.env`:

```
VITE_AUTHORIZED_CLIENT_EMAILS=client1@example.com,client2@example.com
VITE_ADMIN_OAUTH_REDIRECT_URI=https://yourdomain.com/admin/login
VITE_PORTAL_OAUTH_REDIRECT_URI=https://yourdomain.com/portal/login
```

Then add both redirect URLs in Supabase Auth provider settings (Google OAuth):
- `https://yourdomain.com/admin/login`
- `https://yourdomain.com/portal/login`

Notes:
- Admin emails from `VITE_AUTHORIZED_ADMIN_EMAILS` are always routed to `/admin/dashboard`.
- Non-admin users are routed to `/portal/dashboard` after successful portal login.
- If `VITE_AUTHORIZED_CLIENT_EMAILS` is omitted, any non-admin authenticated user can access portal routes.

## Creating Your Admin Account

To create your admin account, you'll need to use the Supabase Dashboard:

1. **Go to Supabase Dashboard**
   - Visit: https://supabase.com/dashboard
   - Sign in with your Supabase account

2. **Navigate to Your Project**
   - Select your project: `nlqzjzxkqteihffptkah`

3. **Create Admin User**
   - In the left sidebar, click on "Authentication"
   - Click "Add user" button
   - Select "Create new user"
   - Enter your email address
   - Enter a secure password
   - Click "Create user"

4. **Confirm Email (Optional)**
   - If email confirmation is enabled, check your email
   - Click the confirmation link
   - If disabled, you can log in immediately

## Accessing the Admin Panel

Once your account is created:

1. Go to: `https://yourdomain.com/admin/login`
2. Enter your email and password
3. Click "Sign In"

You'll be redirected to the admin dashboard where you can manage:
- Business Information (name, contact info, description)
- Services (add, edit, delete services)
- Service Areas (locations where you provide services)
- Customer Reviews (manage testimonials)
- Business Hours (set operating hours)
- Payment Methods (accepted payment types)
- Social Media (social media profiles)
- Business Attributes (custom key-value pairs)

## Admin Panel Features

### Dashboard
- Overview of your business data
- Quick stats (services, reviews, service areas)
- Quick action links to common tasks

### Business Information
- Edit core business details
- Manage address and location
- Update contact information
- Set founder and establishment information

### Services Management
- Add new services with descriptions and pricing
- Edit existing services
- Mark services as featured
- Activate/deactivate services
- Set display order

### Service Areas
- Define coverage areas by city
- Set service radius
- Prioritize service areas
- Manage postal codes

### Customer Reviews
- Add customer testimonials
- Star ratings (1-5)
- Mark reviews as featured
- Verify reviews
- Set publication dates

### Business Hours
- Set hours for each day of the week
- Mark closed days
- Opening and closing times

### Payment Methods
- Add accepted payment methods
- Remove payment methods
- Display order management

### Social Media
- Add social media profile links
- Manage platform names and URLs
- Control active profiles

### Business Attributes
- Add custom business properties
- Key-value pairs for flexibility
- Useful for special certifications, awards, etc.

## Security Features

- **Email-Based Authorization**: Only whitelisted email addresses can access admin portal
- **Secure Authentication**: Supabase Auth with email/password and Google OAuth
- **Protected Routes**: Unauthorized users are automatically signed out and redirected
- **Session Management**: Automatic logout for unauthorized access attempts
- **Row Level Security (RLS)**: Database-level security policies
  - Public users: Read-only access to active content
  - Authenticated users: Full CRUD access
- **Audit Logging**: All login attempts are logged (successful and failed)
- **Multi-Layer Security**: Authorization checked at authentication AND route level

## Tips

1. **Keep Information Current**: Regularly update services and pricing
2. **Feature Best Reviews**: Mark your best testimonials as featured
3. **Update Business Hours**: Keep hours accurate for holidays
4. **Use Good Descriptions**: Write clear, SEO-friendly descriptions
5. **Test Changes**: Check your public website after making changes

## Troubleshooting

### Access Denied / Unauthorized
If you see "Access denied" after logging in:
1. **Check the `.env` file** - Make sure your email is listed in `VITE_AUTHORIZED_ADMIN_EMAILS`
2. **Email must match exactly** - Use the same email address you're logging in with
3. **Case doesn't matter** - Email comparison is case-insensitive
4. **Restart after changes** - After updating `.env`, restart your dev server or redeploy
5. **Check for typos** - Make sure there are no extra spaces or typos in the email

Example:
```
VITE_AUTHORIZED_ADMIN_EMAILS=youremail@gmail.com
```

### Can't Log In
- Verify your email and password are correct
- Ensure your email is in the authorized list (see above)
- Check if email confirmation is required in Supabase settings
- Make sure your account exists in Supabase Authentication

### Changes Not Showing
- Make sure items are marked as "Active"
- Clear browser cache and reload
- Check database connection in Supabase dashboard

### Forgot Password
- Currently, password reset must be done through Supabase Dashboard
- Go to Authentication > Users in Supabase
- Find your user and click to reset password
- Alternatively, contact support

## Database Structure

All your content is stored in Supabase with these tables:
- `business_info` - Core business details
- `business_address` - Address information
- `services` - Service offerings
- `service_areas` - Coverage areas
- `customer_reviews` - Testimonials
- `business_hours` - Operating hours
- `payment_methods` - Accepted payments
- `social_media` - Social profiles
- `business_attributes` - Custom attributes

## Support

If you need help:
1. Check the Supabase documentation
2. Review RLS policies in database
3. Check browser console for errors
4. Verify environment variables are set

## Next Steps

1. Create your admin account in Supabase
2. Log in to the admin panel
3. Fill in your business information
4. Add your services
5. Add customer reviews
6. Set business hours
7. Add payment methods
8. Connect social media profiles

Your changes will be reflected immediately on the public website!
