"""Income-tax bracket tables.

Stored on PayrollSettings.tax_brackets as an ordered list of
{"up_to": <annual JOD amount or null>, "rate": <percent>}. Each bracket covers
taxable income from the previous bracket's up_to to its own up_to. The last
bracket has "up_to": null (no upper limit). Amounts are annual; the payroll
engine annualises monthly income before applying them.
"""
from decimal import Decimal, InvalidOperation


class BracketError(ValueError):
    pass


def _parse(value, what, index):
    if isinstance(value, bool) or isinstance(value, float):
        raise BracketError(f"Bracket {index + 1}: {what} must be a number written as text or an integer.")
    try:
        return Decimal(str(value))
    except (InvalidOperation, TypeError):
        raise BracketError(f"Bracket {index + 1}: {what} is not a number.")


def normalize_brackets(brackets):
    """Validate a bracket table and return it with every number as a string,
    e.g. [{"up_to": "5000.000", "rate": "5.000"}, ..., {"up_to": None, "rate": "30.000"}].
    Raises BracketError with a readable message."""
    if not isinstance(brackets, list) or not brackets:
        raise BracketError("Tax brackets must be a non-empty list.")
    out = []
    previous = Decimal("0")
    for i, bracket in enumerate(brackets):
        if not isinstance(bracket, dict) or set(bracket) - {"up_to", "rate"} or "rate" not in bracket:
            raise BracketError(f"Bracket {i + 1}: expected {{\"up_to\", \"rate\"}}.")
        rate = _parse(bracket["rate"], "rate", i)
        if not Decimal("0") <= rate <= Decimal("100"):
            raise BracketError(f"Bracket {i + 1}: rate must be between 0 and 100.")
        is_last = i == len(brackets) - 1
        up_to = bracket.get("up_to")
        if up_to is None:
            if not is_last:
                raise BracketError(f"Bracket {i + 1}: only the last bracket can have no upper limit.")
            out.append({"up_to": None, "rate": str(rate.quantize(Decimal("0.001")))})
            continue
        if is_last:
            raise BracketError("The last bracket must have no upper limit (up_to: null).")
        up_to = _parse(up_to, "up_to", i)
        if up_to <= previous:
            raise BracketError(f"Bracket {i + 1}: up_to must be greater than the previous bracket's.")
        previous = up_to
        out.append({"up_to": str(up_to.quantize(Decimal("0.001"))), "rate": str(rate.quantize(Decimal("0.001")))})
    return out
