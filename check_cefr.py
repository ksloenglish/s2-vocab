import csv

# Load CEFR data
cefr_data = {}
with open('/home/ubuntu/skills/cefr-level-checker/references/A1-C2.csv', 'r', encoding='utf-8') as f:
    reader = csv.reader(f)
    for row in reader:
        if len(row) >= 3:
            level, word, pos = row[0].strip(), row[1].strip(), row[2].strip()
            cefr_data[(word, pos)] = level

# All words extracted from data.js (already in base form)
words = [
    {"unitKey": "2nd-5", "item": "fascinated",    "pos": "adj"},
    {"unitKey": "2nd-5", "item": "obsession",      "pos": "n"},
    {"unitKey": "2nd-5", "item": "ingenious",      "pos": "adj"},
    {"unitKey": "2nd-5", "item": "surroundings",   "pos": "n"},
    {"unitKey": "2nd-5", "item": "illicit",        "pos": "adj"},
    {"unitKey": "2nd-5", "item": "culprit",        "pos": "n"},
    {"unitKey": "2nd-5", "item": "cruel",          "pos": "adj"},
    {"unitKey": "2nd-5", "item": "tempting",       "pos": "adj"},
    {"unitKey": "2nd-5", "item": "approach",       "pos": "v"},
    {"unitKey": "2nd-5", "item": "aggressive",     "pos": "adj"},
    {"unitKey": "2nd-5", "item": "wander",         "pos": "v"},
    {"unitKey": "2nd-5", "item": "improperly",     "pos": "adv"},
    {"unitKey": "2nd-5", "item": "upset",          "pos": "v"},
    {"unitKey": "2nd-5", "item": "short-sighted",  "pos": "adj"},
    {"unitKey": "2nd-6", "item": "possess",        "pos": "v"},
    {"unitKey": "2nd-6", "item": "reflect",        "pos": "v"},
    {"unitKey": "2nd-6", "item": "obstacle",       "pos": "n"},
    {"unitKey": "2nd-6", "item": "invariably",     "pos": "adv"},
    {"unitKey": "2nd-6", "item": "emerge",         "pos": "v"},
    {"unitKey": "2nd-6", "item": "mature",         "pos": "adj"},
    {"unitKey": "2nd-6", "item": "elderly",        "pos": "adj"},
    {"unitKey": "2nd-6", "item": "adolescence",    "pos": "n"},
    {"unitKey": "2nd-6", "item": "nourish",        "pos": "v"},
    {"unitKey": "2nd-6", "item": "reputable",      "pos": "adj"},
    {"unitKey": "2nd-6", "item": "hygiene",        "pos": "n"},
    {"unitKey": "2nd-6", "item": "essential",      "pos": "adj"},
    {"unitKey": "2nd-6", "item": "risky",          "pos": "adj"},
    {"unitKey": "2nd-6", "item": "apply",          "pos": "v"},
    {"unitKey": "2nd-8", "item": "suppress",       "pos": "v"},
    {"unitKey": "2nd-8", "item": "incident",       "pos": "n"},
    {"unitKey": "2nd-8", "item": "assume",         "pos": "v"},
    {"unitKey": "2nd-8", "item": "unsatisfactory", "pos": "adj"},
    {"unitKey": "2nd-8", "item": "deny",           "pos": "v"},
    {"unitKey": "2nd-8", "item": "complicated",    "pos": "adj"},
    {"unitKey": "2nd-8", "item": "conflict",       "pos": "n"},
    {"unitKey": "2nd-8", "item": "inspiring",      "pos": "adj"},
    {"unitKey": "2nd-8", "item": "encounter",      "pos": "v"},
    {"unitKey": "2nd-8", "item": "eventually",     "pos": "adv"},
    {"unitKey": "2nd-8", "item": "circumstance",   "pos": "n"},
    {"unitKey": "2nd-8", "item": "resilience",     "pos": "n"},
    {"unitKey": "2nd-8", "item": "foster",         "pos": "v"},
    {"unitKey": "2nd-8", "item": "vibe",           "pos": "n"},
]

results = []
for w in words:
    item = w['item']
    pos = w['pos']
    level = cefr_data.get((item, pos), None)
    results.append({
        'unitKey': w['unitKey'],
        'item': item,
        'pos': pos,
        'cefr': level if level else 'NOT_FOUND'
    })

# Print results table
print(f"{'Item':<20} {'POS':<5} {'CEFR':<10} Unit")
print("-" * 55)
for r in results:
    print(f"{r['item']:<20} {r['pos']:<5} {r['cefr']:<10} {r['unitKey']}")

# Print JS-ready mapping
print("\n\n// JS CEFR_LEVELS mapping (words with confirmed CEFR level only):")
print("const CEFR_LEVELS = {")
for r in results:
    if r['cefr'] != 'NOT_FOUND':
        print(f'  "{r["item"]}": "{r["cefr"]}",')
print("};")
