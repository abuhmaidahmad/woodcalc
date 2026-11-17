"""Daily, hourly and overtime rates for an employee.

Rates are returned at full precision. Round only the final amount (hours x
rate) with quantize_jod, so rounding a rate doesn't drift across many hours.
"""
from .money import to_decimal

MONTHLY = "monthly"


def daily_rate(pay_type, base_salary, daily_rate_field, working_days_per_month):
    """Monthly-paid: base salary / working days per month (default 30
    calendar days). Daily- and piece-rate-paid: the employee's own daily rate."""
    if pay_type == MONTHLY:
        days = to_decimal(working_days_per_month)
        if days <= 0:
            raise ValueError("working_days_per_month must be positive.")
        return to_decimal(base_salary) / days
    return to_decimal(daily_rate_field)


def hourly_rate(daily, hours_per_day):
    hours = to_decimal(hours_per_day)
    if hours <= 0:
        raise ValueError("hours_per_day must be positive.")
    return to_decimal(daily) / hours


def overtime_hourly_rate(hourly, multiplier):
    """multiplier is e.g. 1.25 for normal overtime, 1.5 on holidays."""
    return to_decimal(hourly) * to_decimal(multiplier)
