import json
import re
import os

def parse_gyllencreutz_tree(ascii_text):
    lines = ascii_text.strip().split('\n')
    if not lines:
        return {}

    root_name = lines.pop(0).strip()
    root = {"name": root_name, "children": []}
    path = [root]
    level_stack = [0]

    for line in lines:
        if not line.strip():
            continue

        # Determine level from indentation
        match = re.match(r'([|\s`\-]+)(.*)', line)
        if not match:
            continue

        indent_str, name = match.groups()
        name = name.strip()
        name = re.sub(r'^\*by \d+\*\s*', '', name)

        # Heuristic to determine level
        level = indent_str.count('|') + indent_str.count('`')

        node = {"name": name, "children": []}

        while level <= level_stack[-1]:
            path.pop()
            level_stack.pop()
        
        path[-1]['children'].append(node)
        path.append(node)
        level_stack.append(level)

    def clean_empty_children(node):
        if "children" in node and not node["children"]:
            del node["children"]
        elif "children" in node:
            for child in node["children"]:
                clean_empty_children(child)

    clean_empty_children(root)
    return root

def main():
    script_dir = os.path.dirname(os.path.abspath(__file__))
    input_path = os.path.join(script_dir, 'data', 'gyllencreutz_tree_ascii.txt')
    output_path = os.path.join(script_dir, 'data', 'family.json')

    try:
        with open(input_path, 'r', encoding='utf-8') as f:
            ascii_tree = f.read()
    except FileNotFoundError:
        print(f"Error: Input file not found at {input_path}")
        return

    json_data = parse_gyllencreutz_tree(ascii_tree)

    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(json_data, f, indent=4, ensure_ascii=False)

    print(f"Successfully created '{output_path}'.")

if __name__ == '__main__':
    main()
