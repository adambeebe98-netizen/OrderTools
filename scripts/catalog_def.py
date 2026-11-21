"""Single source of truth for the team's real catalog and its variant grouping.

Used by:
  - scripts/gen-catalog-sql.py  -> supabase/catalog-reorganize.sql (run once in production)
  - scripts/gen-seed.py          -> local dev seed (mirrors production, then runs the same reorganize)
"""

# The flat catalog exactly as it was first imported (catalog.csv, 4 categories).
FLAT_CATALOG = [
    # name, category, unit, description
    ('Long Wood Bit 1/8"', "Drill Bits", "each", "Long installer bit for wood"),
    ('Long Wood Bit 1/4"', "Drill Bits", "each", "Long installer bit for wood"),
    ('Long Wood Bit 3/8"', "Drill Bits", "each", "Long installer bit for wood"),
    ('Long Wood Bit 1/2"', "Drill Bits", "each", "Long installer bit for wood"),
    ('Short Wood Bit 1/4"', "Drill Bits", "each", "Standard-length wood bit"),
    ('Short Wood Bit 3/8"', "Drill Bits", "each", "Standard-length wood bit"),
    ('Long Masonry Bit 1/4"', "Drill Bits", "each", "Carbide tip for brick and concrete"),
    ('Long Masonry Bit 3/8"', "Drill Bits", "each", "Carbide tip for brick and concrete"),
    ('Long Masonry Bit 1/2"', "Drill Bits", "each", "Carbide tip for brick and concrete"),
    ('Extra-Long Masonry Bit 3/8"', "Drill Bits", "each", "Extra-long carbide bit for thick walls"),
    ('Extra-Long Masonry Bit 1/2"', "Drill Bits", "each", "Extra-long carbide bit for thick walls"),
    ('Hole Saw Bit 3/4"', "Drill Bits", "each", None),
    ('Speedbor Spade Bit 3/4"', "Drill Bits", "each", None),
    ("RJ45 Connectors", "Wiring & Connectors", "bag", None),
    ("Dolphin Beans", "Wiring & Connectors", "bag", "White gel-filled crimp connectors for alarm wiring"),
    ("Wire Nuts", "Wiring & Connectors", "bag", "Twist-on wire connectors"),
    ("Electrical Tape", "Wiring & Connectors", "roll", None),
    ("Zip Ties", "Wiring & Connectors", "bag", None),
    ("Staples", "Wiring & Connectors", "box", "Cable staples"),
    ("Screws", "Mounting & Sealing", "box", "Our standard install screws"),
    ("Sign Hardware", "Mounting & Sealing", "set", None),
    ("Raceway", "Mounting & Sealing", "each", "Surface wire raceway"),
    ("Double-Sided Mounting Tape", "Mounting & Sealing", "roll", None),
    ("Silicone Sealant", "Mounting & Sealing", "tube", None),
    ("Putty", "Mounting & Sealing", "each", None),
    ("3-Way Plug Splitter", "Power", "each", "One outlet into three"),
    ("Power Strip", "Power", "each", None),
]

CATEGORIES = ["Drill Bits", "Wiring & Connectors", "Mounting & Sealing", "Power"]

# Product groups: name, category, icon, description, attribute names, variants.
# Each variant: (attributes, legacy names it replaces, unit, description for new rows)
GROUPS = [
    {
        "name": "Short Bit", "category": "Drill Bits", "icon": "drill-bit",
        "description": "Standard-length bits", "attributes": ["Type", "Size"],
        "variants": [
            ({"Type": "Wood", "Size": '3/8"'}, ['Short Wood Bit 3/8"'], "each", "Standard-length wood bit"),
            ({"Type": "Masonry", "Size": '1/4"'}, ['Short Masonry Bit 1/4"'], "each", "Standard-length carbide masonry bit"),
        ],
    },
    {
        "name": "Long Bit", "category": "Drill Bits", "icon": "drill-bit",
        "description": "Long installer bits", "attributes": ["Type", "Size"],
        "variants": [
            ({"Type": "Wood", "Size": '1/8"'}, ['Long Wood Bit 1/8"'], "each", "Long installer bit for wood"),
            ({"Type": "Wood", "Size": '1/4"'}, ['Long Wood Bit 1/4"'], "each", "Long installer bit for wood"),
            ({"Type": "Wood", "Size": '3/8"'}, ['Long Wood Bit 3/8"'], "each", "Long installer bit for wood"),
            ({"Type": "Wood", "Size": '1/2"'}, ['Long Wood Bit 1/2"'], "each", "Long installer bit for wood"),
            ({"Type": "Masonry", "Size": '1/4"'}, ['Long Masonry Bit 1/4"'], "each", "Carbide tip for brick and concrete"),
            ({"Type": "Masonry", "Size": '3/8"'}, ['Long Masonry Bit 3/8"'], "each", "Carbide tip for brick and concrete"),
            ({"Type": "Masonry", "Size": '1/2"'}, ['Long Masonry Bit 1/2"'], "each", "Carbide tip for brick and concrete"),
        ],
    },
    {
        "name": "Extra-Long Bit", "category": "Drill Bits", "icon": "drill-bit",
        "description": "For thick walls", "attributes": ["Type", "Size"],
        "variants": [
            ({"Type": "Masonry", "Size": '3/8"'}, ['Extra-Long Masonry Bit 3/8"'], "each", "Extra-long carbide bit for thick walls"),
            ({"Type": "Masonry", "Size": '1/2"'}, ['Extra-Long Masonry Bit 1/2"'], "each", "Extra-long carbide bit for thick walls"),
        ],
    },
    {
        "name": "Hole Saw", "category": "Drill Bits", "icon": "hole-saw",
        "description": None, "attributes": ["Size"],
        "variants": [({"Size": '3/4"'}, ['Hole Saw Bit 3/4"'], "each", None)],
    },
    {
        "name": "Speedbor", "category": "Drill Bits", "icon": "spade-bit",
        "description": "Spade bit", "attributes": ["Size"],
        "variants": [({"Size": '3/4"'}, ['Speedbor Spade Bit 3/4"'], "each", None)],
    },
]

# Replaced by the corrected short-bit options. Archived (never deleted) so past requests stay intact.
OBSOLETE = ['Short Wood Bit 1/4"']

# Standalone (no variants) items: name -> icon. Order = display order within the category.
STANDALONE = [
    ("3 ft Flex Bit", "Drill Bits", "drill-bit"),
    ("RJ45 Connectors", "Wiring & Connectors", "rj45"),
    ("Dolphin Beans", "Wiring & Connectors", "gel-connector"),
    ("Wire Nuts", "Wiring & Connectors", "wire-nut"),
    ("Electrical Tape", "Wiring & Connectors", "tape"),
    ("Zip Ties", "Wiring & Connectors", "zip-tie"),
    ("Staples", "Wiring & Connectors", "staple"),
    ("Screws", "Mounting & Sealing", "screw"),
    ("Sign Hardware", "Mounting & Sealing", "sign"),
    ("Raceway", "Mounting & Sealing", "raceway"),
    ("Double-Sided Mounting Tape", "Mounting & Sealing", "tape"),
    ("Silicone Sealant", "Mounting & Sealing", "caulk-tube"),
    ("Putty", "Mounting & Sealing", "putty"),
    ("3-Way Plug Splitter", "Power", "splitter"),
    ("Power Strip", "Power", "power-strip"),
]


# Standalone items that weren't in the original import: name -> (unit, description)
NEW_ITEMS = {"3 ft Flex Bit": ("each", "3-foot flexible installer bit")}


def variant_name(group_name, attribute_names, attrs):
    """Mirrors variantName() in src/lib/variants.ts."""
    values = [attrs[a] for a in attribute_names if attrs.get(a)]
    return " — ".join([group_name, *values])
