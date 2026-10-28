# Admin Operations Setup

## Required trusted claims

Admin page access requires `app_metadata.role = "admin"`. Operational pages and APIs also require a specific `app_metadata.admin_permissions` value. Set these claims only through a trusted server-side Supabase Admin API process; never accept them from user-editable metadata or a browser request.

Supported permissions:

- `kyc:review`: review submissions and access short-lived signed identity-document URLs.
- `users:manage`: search users and suspend/reactivate accounts.
- `matches:manage`: inspect, create, and unmatch buyer-cook pairs.
- `disputes:manage`: inspect and resolve disputes.
- `bookings:manage`: inspect bookings and payment status.
- `finance:refund`: request Paystack refunds.
- `listings:manage`: remove or restore meal specials.
- `messages:manage`: inspect active match conversations and send clearly labeled staff messages.
- Support inbox also requires `messages:manage`; it stores user support threads separately from marketplace matches.
- `reports:manage`: inspect and resolve user-submitted reports.
- `audit:view`: inspect administrative action and KYC-access records.

Assign only the permissions each staff member needs. An admin with the base role but no operational permission can open the general admin shell but cannot use the protected operations APIs/pages.

## First administrator bootstrap

There is now an `/admin/access` page guarded by `admin:manage`. For the first administrator only, use Supabase SQL Editor (an elevated trusted operation) to set the auth user's app metadata. Replace the email and permissions with the intended values:

```sql
update auth.users
set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || jsonb_build_object(
	'role', 'admin',
	'admin_permissions', jsonb_build_array(
		'admin:manage',
		'users:manage',
		'matches:manage',
		'kyc:review',
		'disputes:manage',
		'bookings:manage',
		'finance:refund',
		'listings:manage',
		'messages:manage',
		'reports:manage',
		'audit:view'
	)
)
where lower(email) = lower('replace-with-your-login-email')
returning id, email, raw_app_meta_data;
```

For this project owner account, after applying `supabase-migration-admin-audit-log.sql` in staging, run this guarded statement in that Supabase project's SQL Editor:

```sql
do $$
declare
	target_user_id uuid;
begin
	select id into target_user_id
	from auth.users
	where lower(email) = lower('new4mails@exdonuts.com');

	if target_user_id is null then
		raise exception 'No Supabase Auth user found for new4mails@exdonuts.com';
	end if;

	update auth.users
	set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || jsonb_build_object(
		'role', 'admin',
		'admin_permissions', jsonb_build_array(
			'admin:manage', 'users:manage', 'matches:manage', 'kyc:review',
			'disputes:manage', 'bookings:manage', 'finance:refund',
			'listings:manage', 'messages:manage', 'reports:manage', 'audit:view'
		)
	)
	where id = target_user_id;
end $$;

select id, email, raw_app_meta_data ->> 'role' as admin_role,
			 raw_app_meta_data -> 'admin_permissions' as admin_permissions
from auth.users
where lower(email) = lower('new4mails@exdonuts.com');
```

Run this only in the intended Supabase project and confirm the result is that single account. Do not edit `profiles.role` to `admin`; that field is only `buyer` or `cook`. Sign out and sign back in after the claim change so the access token contains the new trusted metadata. After bootstrap, grant or revoke staff access in `/admin/access`; changes to a user's claims take effect on their next token refresh/sign-in.

## Staging migrations

Review the deployed schema and apply these additive SQL files to staging before enabling the related pages:

1. `supabase-migration-admin-audit-log.sql`
2. `supabase-migration-admin-refunds.sql`
3. `supabase-migration-admin-listing-moderation.sql`
4. `supabase-migration-match-chat-access.sql`
5. `supabase-migration-reports.sql`
6. `supabase-migration-admin-support-chat.sql`

Do not apply these directly to production without validating the live schema, backup/rollback plan, and staging behavior.

## Refund operations limitation

The refund endpoint sends a bounded refund request to Paystack and records the provider response as `pending`. Staff can record settlement only after verifying the exact provider refund ID in Paystack; the action and verification note are audited. A database function atomically marks the request processed and marks the booking refunded only when processed refunds cover the paid amount. The current reconciliation is a staff attestation, not an automated webhook; add and test a signed Paystack webhook before relying on automation. Dispute resolution itself does not move money.

## Current coverage boundaries

Meal-listing moderation currently covers `daily_specials`; it soft-removes records so evidence and audit history remain. Reports can be submitted from public chef profiles and posts, then reviewed in the scoped staff queue. Report resolution records an outcome but does not automatically remove the reported target; use the listing moderation workflow for meal specials. The admin support inbox can start an independently audited support thread with any buyer or cook; customer replies are available at `/support`. This is separate from match chat and must never impersonate a buyer or cook.
