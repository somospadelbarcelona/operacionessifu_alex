import re

with open("sap_metadata.xml", "r", encoding="utf-8") as f:
    text = f.read()

entity_sets = re.findall(r'<EntitySet\s+Name="([^"]+)"\s+EntityType="([^"]+)"', text)
print("=== SAP S/4HANA ZPS_HOPER_SRV EntitySets ===")
for name, etype in entity_sets:
    print(f"- {name} ({etype})")

# Also find properties of Empleado, Proyecto, HAGrid, etc.
types = re.findall(r'<EntityType\s+Name="([^"]+)"(.*?)<\/EntityType>', text, re.DOTALL)
print("\n=== EntityType Properties ===")
for tname, tbody in types:
    props = re.findall(r'<Property\s+Name="([^"]+)"\s+Type="([^"]+)"', tbody)
    prop_names = [p[0] for p in props]
    print(f"[{tname}] ({len(prop_names)} props): {', '.join(prop_names[:15])}...")
