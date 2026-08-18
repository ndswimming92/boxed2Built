/*
# Enable realtime for admin_notifications

Adds the admin_notifications table to the supabase_realtime publication
so the admin portal can receive live updates when new notifications arrive.
*/

ALTER PUBLICATION supabase_realtime ADD TABLE admin_notifications;
