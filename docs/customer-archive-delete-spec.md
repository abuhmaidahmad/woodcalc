# Customers: Archive + Delete

## Why both

- **Archive** is for real customers who are finished or inactive. Their projects, rooms, contracts and payments stay. They disappear from the active list and pickers, but finance reports and history still work. It can be undone.
- **Delete** is only for junk or test records. It is permanent and cascades to projects, rooms and payments, so it is blocked whenever real business data exists.

## Backend (crm app)

### Model: `Client`

Add these fields and a migration:

- `is_archived` BooleanField, default False, db_index
- `archived_at` DateTimeField, null
- `archived_by` FK to User, null, on_delete SET_NULL

### `ClientViewSet` (keep `TenantScopedMixin` + `HasActiveCompany`)

- List filter `?status=active|archived|all`, default `active`. Detail (retrieve) still returns archived clients, so links keep working.
- `POST /clients/{id}/archive/` sets the three fields.
- `POST /clients/{id}/unarchive/` clears them.
- `GET /clients/{id}/delete-check/` returns the counts of projects, rooms, quotations, `Payment`, `PaymentTransaction`, signed contracts and linked manufacturing `WorkOrder`s, plus `can_delete` (bool) and `reason`.
- `DELETE /clients/{id}/`:
  - Owner/admin only.
  - Returns 409 with the same payload as delete-check if there are any payments/transactions, any signed contract, or any work order.
  - Otherwise deletes the client and everything that cascades from it.
- `POST /clients/bulk/` with body `{ "action": "archive" | "unarchive" | "delete", "ids": [...] }`:
  - Runs per id.
  - Returns `{ ok: [...], blocked: [{id, name, reason}] }`.
  - Delete skips blocked clients and never fails the whole batch.
- Auditor and read-only roles get 403 on archive, unarchive, delete and bulk.

### Other places

- Exclude archived clients from customer pickers and autocomplete (new project, leads conversion, any client dropdown) and from Dashboard "active customers" counts.
- Do not exclude them from finance/collections, payment history or reports.

## Frontend

### Customers page

- Add tabs: Active | Archived (plus count badges).
- Add a per-row "⋯" menu:
  - Active tab: Archive, Delete
  - Archived tab: Restore, Delete
- Add a select mode: checkboxes plus a bulk bar with Archive / Restore / Delete selected.
- Archive needs no confirmation and shows a toast with Undo.
- Delete opens a modal that calls `delete-check` first:
  - If blocked: explain why (for example "3 payments recorded") and offer Archive instead.
  - If allowed: list what will be removed (X projects, Y rooms) and require typing the customer name (bulk: type `DELETE`) before the red button enables.
  - After a bulk delete, show which clients were skipped and why.

### CustomerDetail

- When archived, show a grey banner "Archived on {date} by {user}" with a Restore button.
- Put Archive and Delete in the page's actions menu, using the same modal.

## Arabic

Add EN/AR strings for every new label, toast and modal.

## Tests

- Archived clients are hidden from the default list and shown with `status=archived`.
- Delete is blocked (409) when a client has a payment, a signed contract or a work order.
- Delete succeeds and cascades for a client that only has an empty project or room.
- Bulk delete returns a mix of ok and blocked.
- Tenant isolation: no archive or delete across companies.
- Auditor role gets 403.

## Implementation notes

- There is no Contract model; a **signed contract** is a `Quotation` with status `ACCEPTED`.
- Work orders link to rooms by `WorkOrder.room_id_ref` (not a foreign key), so they would be orphaned by a cascade; any linked work order (any status) blocks delete.
