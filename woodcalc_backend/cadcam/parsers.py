"""
Per-platform CSV column-mapping parsers.

Each function takes the uploaded CSV file (a Django UploadedFile) and must
return (parts, offcuts) where parts/offcuts are lists of plain dicts shaped
like ImportedPart/RemnantOffcut fields (minus job/tenant, which the caller
fills in).

None of these are implemented yet — every platform export uses different
column names and units, and building a correct mapping requires a real
sample export to verify against. Wire up one platform at a time as samples
arrive; nothing here should guess at a column layout that hasn't been seen.
"""


def parse_bsolid_csv(file):
    raise NotImplementedError(
        "CSV parsing for bSolid isn't implemented yet — needs a real export "
        "sample to map its columns correctly."
    )


def parse_cabinetvision_csv(file):
    raise NotImplementedError(
        "CSV parsing for Cabinet Vision isn't implemented yet — needs a real "
        "export sample to map its columns correctly."
    )


def parse_alphacam_csv(file):
    raise NotImplementedError(
        "CSV parsing for Alphacam isn't implemented yet — needs a real export "
        "sample to map its columns correctly."
    )


def parse_microvellum_csv(file):
    raise NotImplementedError(
        "CSV parsing for Microvellum isn't implemented yet — needs a real "
        "export sample to map its columns correctly."
    )


def parse_woodwop_csv(file):
    raise NotImplementedError(
        "CSV parsing for WoodWOP isn't implemented yet — needs a real export "
        "sample to map its columns correctly."
    )


PARSERS = {
    'bsolid': parse_bsolid_csv,
    'cabinetvision': parse_cabinetvision_csv,
    'alphacam': parse_alphacam_csv,
    'microvellum': parse_microvellum_csv,
    'woodwop': parse_woodwop_csv,
}
