# WoodCalc HR & Payroll Module Spec

## Goal

Extend the existing `hr` app (Employee, Attendance, LeaveRequest, Payroll) into a full, multi-tenant HR
and payroll module tied to manufacturing, CRM and installer workflows. All models carry the tenant FK
and use `TenantScopedMixin` + `HasActiveCompany`.

## Models

### Employee (extend)

- `pay_type`: monthly | daily | piece_rate
- `base_salary`, `daily_rate`
- `ssc_enrolled` (bool), `ssc_number`
- `payment_method`: bank | cash, `iban`
- `department`, `station` (FK ProductionStation, nullable), `hire_date`, `contract_type`, `documents`

### PayrollSettings (one per tenant)

- `country`, `pay_day`
- `overtime_rate_normal`, `overtime_rate_holiday`
- `ssc_employee_pct`, `ssc_employer_pct`, `ssc_ceiling` (editable, never hardcoded)
- `tax_brackets` (JSON table), `personal_exemptions`

### AllowanceType / EmployeeAllowance

- `name`, `kind`: fixed | percent, `taxable`, `ssc_subject`
- per-employee amount override

### PieceRate

- `station` (FK), `unit`: part | m2 | linear_m | job, `rate`
- source: StationLog quantities per period

### Advance

- `employee`, `total_amount`, `monthly_installment`, `remaining_balance`, `status`, `approved_by`

### PayrollRun

- `period` (month), `status`: draft | approved | locked, `created_by`, `approved_by`, `approved_at`

### PayrollLine

- `run`, `employee`, `base`, `overtime`, `allowances`, `piece_rate_earnings`, `commission`, `gross`
- `ssc_employee`, `ssc_employer`, `income_tax`, `advance_deduction`, `other_deductions`, `net`
- `breakdown` (JSON, full traceability)

### PayrollAdjustment

- `employee`, `target_run`, `amount`, `reason`, `created_by` (corrections after lock)

### ManualEditLog

- `line`, `field`, `old_value`, `new_value`, `reason`, `user`, `timestamp`

## Payroll Run Flow

1. Settings configured once per tenant.
2. Start run for a month: system pulls attendance, overtime, approved leave, StationLog piece-rate
   output, CRM contract commissions, installer jobs, open advances; creates one PayrollLine per
   employee.
3. Review grid: base, additions, deductions, net. Flags: large change vs last month, missing
   attendance, negative net. Manual edits require a reason and are logged.
4. Approve and lock: no edits after lock; corrections only via PayrollAdjustment applied to next run.
5. Outputs: payslips (Arabic/English PDF, WhatsApp/email), bank transfer file, cash payout sheet,
   monthly SSC report, payroll register.
6. Approved labor cost is allocated back to WorkOrders (hours x rate per station) for real job
   costing.

## Web UI Screens

- HR dashboard: headcount, absent today, pending approvals, monthly payroll cost
- Employee list and profile tabs (info, pay, allowances, documents, attendance, leave, advances,
  payslips)
- Attendance month grid with overtime and late flags
- Leave calendar and approvals
- Payroll run wizard (draft, review, approve, lock)
- Advances and loans
- Reports
- Settings (rates, ceiling, brackets, allowance types, piece rates)

## Employee Mobile (React Native)

- Clock in/out with geolocation or workshop QR code
- Month hours and overtime so far
- Live piece-rate earnings for piece-rate workers
- Payslips (PDF history)
- Leave balance and request
- Advance request
- Manager approvals inbox: leave, advances, attendance corrections

## Build Order

1. Extend Employee + PayrollSettings
2. Attendance and overtime
3. Payroll engine with SSC and tax
4. Payslips and outputs
5. Advances
6. Piece-rate via StationLog, commissions, installer jobs
7. Labor cost allocation to WorkOrders
8. Mobile self-service

## Compliance Note

All rates (SSC percentages, ceiling, tax brackets) are tenant settings so Gulf tenants can configure local
rules (e.g. GOSI, WPS). Confirm current Jordan rates with a local accountant before go-live.
