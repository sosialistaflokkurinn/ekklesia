#!/usr/bin/env python3
import os
import xml.etree.ElementTree as ET
import re
import sys

def find_unused_strings(project_root):
    # Path to strings.xml
    strings_xml_path = os.path.join(project_root, 'apps/members-portal/i18n/values-is/portal-strings.xml')
    
    if not os.path.exists(strings_xml_path):
        print(f"Error: Could not find {strings_xml_path}")
        sys.exit(1)

    # Parse XML
    try:
        tree = ET.parse(strings_xml_path)
        root = tree.getroot()
        defined_strings = {child.attrib['name'] for child in root.findall('string')}
    except Exception as e:
        print(f"Error parsing XML: {e}")
        sys.exit(1)

    print(f"Found {len(defined_strings)} defined strings.")

    # Files to search
    search_extensions = {'.js', '.html'}
    search_root = os.path.join(project_root, 'apps/members-portal')
    
    used_strings = set()
    
    # Walk through files
    for root_dir, _, files in os.walk(search_root):
        # Skip i18n directory to avoid self-reference
        if 'i18n' in root_dir:
            continue
            
        for file in files:
            if os.path.splitext(file)[1] in search_extensions:
                file_path = os.path.join(root_dir, file)
                try:
                    with open(file_path, 'r', encoding='utf-8') as f:
                        content = f.read()
                        for key in defined_strings:
                            if key in used_strings:
                                continue
                            # Search for the key
                            # We search for the key string itself. 
                            # This might have false positives if the key is a common word,
                            # but it's safer than missing dynamic usages like R.string[key]
                            if key in content:
                                used_strings.add(key)
                except Exception as e:
                    print(f"Error reading {file_path}: {e}")

    # Calculate unused
    unused_strings = defined_strings - used_strings
    
    print(f"Found {len(used_strings)} used strings.")
    print(f"Found {len(unused_strings)} potentially unused strings:")
    print("-" * 40)
    
    for key in sorted(unused_strings):
        print(key)

if __name__ == "__main__":
    # Assuming script is run from project root or scripts/ dir
    current_dir = os.getcwd()
    if current_dir.endswith('scripts'):
        project_root = os.path.dirname(current_dir)
    else:
        project_root = current_dir
        
    find_unused_strings(project_root)
