from .models import DrawerSystem, Material, Sink

STARTER_MATERIALS = [
    dict(sku="STD-WHT-MEL", name="White Melamine Board", category="Wood Panel",
         material_type="carcass", finish="matt", fallback_hex="#F5F5F0", unit_cost=8.50),
    dict(sku="STD-OAK-FRT", name="Natural Oak Front", category="Wood Panel",
         material_type="front", finish="wood", fallback_hex="#C8A876", has_grain=True, unit_cost=22.00),
    dict(sku="STD-GRY-FRT", name="Matte Grey Front", category="Wood Panel",
         material_type="front", finish="matt", fallback_hex="#8A8A8A", unit_cost=19.00),
    dict(sku="STD-QTZ-WHT", name="White Quartz Countertop", category="Countertop/Stone",
         material_type="worktop", finish="gloss", fallback_hex="#EAEAE5", unit_cost=85.00),
    dict(sku="STD-HNDL-01", name="Standard Aluminum Handle", category="Hardware",
         unit_cost=3.50),
    dict(sku="STD-HNG-01", name="Standard Soft-Close Hinge", category="Hardware",
         unit_cost=2.20),
]

STARTER_DRAWER_SYSTEMS = [
    dict(name="Standard Wood Box", brand="Generic", box_construction="wood_box", price_per_set=35.00, sort_order=0),
    dict(name="Metal-Sided Slim Box", brand="Generic", box_construction="metal_sided", price_per_set=65.00, sort_order=1),
]

STARTER_SINKS = [
    dict(brand="Generic", model_name="Single Bowl Stainless 500", material="stainless_steel",
         cavity_count=1, mount_type="undermount", shape="rectangular", width_mm=500, depth_mm=450, price=90.00),
    dict(brand="Generic", model_name="Double Bowl Stainless 800", material="stainless_steel",
         cavity_count=2, mount_type="undermount", shape="rectangular", width_mm=800, depth_mm=450, price=140.00),
]


def seed_starter_catalog(company):
    """Populates a brand-new company's catalog with a placeholder starter set so it
    isn't completely empty at signup. All pricing/specs are placeholders — meant to be
    edited or replaced by the manufacturer."""
    Material.objects.bulk_create([Material(tenant=company, **m) for m in STARTER_MATERIALS])
    DrawerSystem.objects.bulk_create([DrawerSystem(tenant=company, **d) for d in STARTER_DRAWER_SYSTEMS])
    Sink.objects.bulk_create([Sink(tenant=company, **s) for s in STARTER_SINKS])
