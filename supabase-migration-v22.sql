-- Blessuth v22 migration — run this once in Supabase SQL Editor.
--
-- Adds notifications (both the in-app banner and real push) for the
-- Wishlist: when your partner adds something new, you get notified, the
-- same way you already do for messages, notes, and the rest.
--
-- Important: this trigger fires on INSERT only. Marking an item "got it"
-- is an UPDATE (see Wishlist.jsx's toggleGotIt), so it deliberately never
-- reaches this trigger and never notifies the item's owner — that's what
-- keeps "got it" a surprise. Don't change this to fire on UPDATE too, or
-- you'll spoil the exact thing the Wishlist page was designed to protect.

drop trigger if exists notify_on_wishlist_item on wishlist_items;
create trigger notify_on_wishlist_item
after insert on wishlist_items
for each row execute function notify_webhook();
