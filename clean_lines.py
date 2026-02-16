
import os

file_path = r'd:\Sistemas David\Imala-OS\imala-os\src\assets\js\apps-tareas.js'

with open(file_path, 'r', encoding='utf-8') as f:
    lines = f.readlines()

# Target range: 320 to 331 (1-based) -> 319 to 330 (0-based)
# Check content to be safe
line_320 = lines[319].strip()
expected = "btn.classList.remove('btn-outline-light', 'text-white');"

if expected in line_320:
    print("Found garbage at line 320. cleaning...")
    # remove lines 319 to 332 (0-based) = 14 lines? 332-319 = 13 lines.
    # range 320-331 is 12 lines.
    # Let's verify end.
    # Line 331 (0-based 330) should be "    });"
    # Line 326 (0-based 325) should be start of second garbage block.
    
    # We want to keep line 317 (    }); )
    # We want to remove 320..331.
    # We can just slice.
    
    del lines[319:332] # 319 up to but not including 332. (320-332 in 1-based, inclusive)
    # Wait, 332 1-based is line after garbage?
    # In Step 2539:
    # 331:     });
    # 332: 
    # 333: 
    # 334:     // ==========================================
    
    # So we delete 319 up to 331 (index).
    # 331 index is line 332 (empty).
    # So lines[319:331] removes 320..331.
    
    with open(file_path, 'w', encoding='utf-8') as f:
        f.writelines(lines)
    print("Cleaned.")
else:
    print(f"Safety check failed. Line 320 content: {line_320}")

