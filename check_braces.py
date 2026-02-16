
file_path = r'd:\Sistemas David\Imala-OS\imala-os\src\assets\js\apps-tareas.js'

with open(file_path, 'r', encoding='utf-8') as f:
    lines = f.readlines()

stack = []
last_closed_block_start = -1
last_closing_brace_line = -1

for i, line in enumerate(lines):
    for char in line:
        if char == '{':
            stack.append(i + 1)
        elif char == '}':
            if not stack:
                print(f"Error: Extra closing brace at line {i+1}")
                exit(1)
            last_closed_block_start = stack.pop()
            last_closing_brace_line = i + 1

if stack:
    print(f"Error: Unclosed braces starting at lines: {stack}")
    print(f"The LAST closing brace at line {last_closing_brace_line} closed the block starting at line {last_closed_block_start}")
    print(f"This implies that the block starting at line {last_closed_block_start} was NOT supposed to extend to line {last_closing_brace_line}.")
    # Read the content of the start line
    print(f"Content of start line {last_closed_block_start}: {lines[last_closed_block_start-1].strip()}")
else:
    print("Braces are balanced.")
