from inventory.models import Material

FINISH_FIELDS = ('name', 'fallback_hex', 'finish', 'texture_physical_width_mm', 'texture_physical_height_mm')
PRIVATE_DESIGN_KEYS = ('pricing', 'materials')
PRIVATE_STANDARD_KEYS = ('labourPct', 'marginPct', 'spacerBoardSku')


def material_skus(design):
    materials = design.get('materials') if isinstance(design, dict) else None
    if not isinstance(materials, dict):
        return {}
    carcass = materials.get('carcass') or None
    front = carcass if materials.get('frontMatchesCarcass') else materials.get('front') or None
    return {role: sku for role, sku in (('carcass', carcass), ('front', front)) if isinstance(sku, str) and sku}


def finish_of(material, request):
    out = {field: getattr(material, field) for field in FINISH_FIELDS}
    out['texture_image'] = request.build_absolute_uri(material.texture_image.url) if material.texture_image else None
    return out


def share_finishes(design, tenant, request):
    skus = material_skus(design)
    if not skus:
        return {}
    by_sku = {m.sku: m for m in Material.objects.filter(tenant=tenant, sku__in=set(skus.values()))}
    return {role: finish_of(by_sku[sku], request) for role, sku in skus.items() if sku in by_sku}


def public_design(design):
    if not isinstance(design, dict):
        return design
    return {key: value for key, value in design.items() if key not in PRIVATE_DESIGN_KEYS}


def public_standard(standard):
    if not isinstance(standard, dict):
        return standard
    return {key: value for key, value in standard.items() if not key.startswith('price') and key not in PRIVATE_STANDARD_KEYS}
