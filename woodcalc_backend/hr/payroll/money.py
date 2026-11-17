"""JOD money handling. Payroll is JOD only, with 3 decimal places (fils)."""
from decimal import ROUND_HALF_UP, Decimal

JOD_PLACES = Decimal("0.001")

# Model field sizes shared by every JOD amount in hr, so they stay consistent.
MONEY_DIGITS = 14
MONEY_PLACES = 3


def to_decimal(value):
    """Convert ints, strings and Decimals to Decimal. Floats are refused
    because they can't represent fils exactly."""
    if isinstance(value, Decimal):
        return value
    if isinstance(value, float):
        raise TypeError("Use Decimal or str for money, not float.")
    return Decimal(str(value))


def quantize_jod(value):
    """Round an amount to whole fils, half up (0.0005 -> 0.001)."""
    return to_decimal(value).quantize(JOD_PLACES, rounding=ROUND_HALF_UP)
