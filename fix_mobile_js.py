
import os
import re

file_path = r'd:\Sistemas David\Imala-OS\imala-os\src\assets\js\apps-tareas.js'

with open(file_path, 'r', encoding='utf-8') as f:
    lines = f.readlines()

# 1. Remove duplicate mobFilterButtons logic
# We look for "mobFilterButtons.forEach(btn => {" and if we see it more than once, we suppress the later ones.
# The block is about 12 lines long.

new_lines = []
seen_mob_logic = False
skip_count = 0

for i, line in enumerate(lines):
    if skip_count > 0:
        skip_count -= 1
        continue

    if "mobFilterButtons.forEach(btn => {" in line:
        if seen_mob_logic:
            # Duplicate found! Skip this block.
            # Block ends with "    });" (indented)
            # Find the end of this block
            # Logic: It has an inner forEach, so we need to be careful.
            # It ends with }); on a line by itself.
            # Let's verify line count? It's typically 12 lines.
            print(f"Removing duplicate at line {i+1}")
            skip_count = 13 # rough estimate, or we can look ahead
            # Better look ahead
            temp_idx = i
            while temp_idx < len(lines):
                if lines[temp_idx].strip() == "});" and lines[temp_idx].startswith("    "):
                     skip_count = temp_idx - i + 1
                     break
                temp_idx += 1
            if skip_count == 0: skip_count = 13 # Fallback
            skip_count -= 1 # Current line is handled by continue
            continue
        else:
            seen_mob_logic = True
            new_lines.append(line)
    else:
        new_lines.append(line)

content = "".join(new_lines)

# 2. Update Pending Tasks Logic (Agenda View)
# We want to replace:
# const pendingTasks = tasks.filter(t => t.status !== 'COMPLETED').sort((a,b) => {
# ...
# });
# with:
# // 1. Group Tasks by Date - INCLUDE COMPLETED
# const allTasks = tasks.sort((a,b) => {
# ...
# });

# Robust regex
pattern_start = r"const pendingTasks = tasks\.filter\(t => t\.status !== 'COMPLETED'\)\.sort\(\(a,b\) => \{"
replacement_start = "const allTasks = tasks.sort((a,b) => {"

if re.search(pattern_start, content):
    content = re.sub(pattern_start, replacement_start, content)
    print("Updated pendingTasks definition.")
else:
    print("Could not find pendingTasks definition (Regex failed). Trying simple string replace.")
    simple_search = "const pendingTasks = tasks.filter(t => t.status !== 'COMPLETED').sort((a,b) => {"
    if simple_search in content:
        content = content.replace(simple_search, replacement_start)
        print("Updated pendingTasks definition (Simple).")
    else:
        print("Could not find pendingTasks definition (Simple failed).")

# 3. Update Loop
if "pendingTasks.forEach(t => {" in content:
    content = content.replace("pendingTasks.forEach(t => {", "allTasks.forEach(t => {")
    print("Updated loop variable.")
else:
    print("Could not find pendingTasks loop.")

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)

print("Done.")
