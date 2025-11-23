#!/usr/bin/env python3
"""
Script to restore previously archived i18n strings.
Useful when a string was mistakenly identified as unused or is needed again.
"""
import os
import xml.etree.ElementTree as ET
import sys

def restore_strings(project_root, keys_to_restore):
    # Paths
    main_xml_path = os.path.join(project_root, 'apps/members-portal/i18n/values-is/portal-strings.xml')
    archive_xml_path = os.path.join(project_root, 'archive/unused-strings/unused-portal-strings-2025-11-21.xml')

    if not os.path.exists(main_xml_path) or not os.path.exists(archive_xml_path):
        print("Error: Could not find XML files")
        sys.exit(1)

    # Parse XMLs
    try:
        main_tree = ET.parse(main_xml_path)
        main_root = main_tree.getroot()
        
        archive_tree = ET.parse(archive_xml_path)
        archive_root = archive_tree.getroot()
    except Exception as e:
        print(f"Error parsing XML: {e}")
        sys.exit(1)

    # Find and move elements
    restored_count = 0
    for key in keys_to_restore:
        # Find in archive
        found = False
        for child in archive_root.findall('string'):
            if child.attrib['name'] == key:
                # Add to main
                main_root.append(child)
                # Remove from archive
                archive_root.remove(child)
                print(f"Restoring: {key}")
                found = True
                restored_count += 1
                break
        
        if not found:
            print(f"Warning: Could not find {key} in archive")

    if restored_count == 0:
        print("No strings restored.")
        return

    # Indent for pretty printing
    def indent(elem, level=0):
        i = "\n" + level*"  "
        if len(elem):
            if not elem.text or not elem.text.strip():
                elem.text = i + "  "
            if not elem.tail or not elem.tail.strip():
                elem.tail = i
            for child in elem:
                indent(child, level+1)
            if not child.tail or not child.tail.strip():
                child.tail = i
        else:
            if level and (not elem.tail or not elem.tail.strip()):
                elem.tail = i

    indent(main_root)
    indent(archive_root)

    # Save files
    main_tree.write(main_xml_path, encoding='utf-8', xml_declaration=True)
    archive_tree.write(archive_xml_path, encoding='utf-8', xml_declaration=True)
    
    print(f"Successfully restored {restored_count} strings.")

if __name__ == "__main__":
    current_dir = os.getcwd()
    if current_dir.endswith('scripts'):
        project_root = os.path.dirname(current_dir)
    else:
        project_root = current_dir
        
    # Keys identified from user report + related role keys
    keys = [
        'role_badge_member',
        'role_badge_superuser',
        'role_badge_admin',
        'role_badge_election_manager',
        'role_election_manager',
        'role_superadmin'
    ]
    
    restore_strings(project_root, keys)
