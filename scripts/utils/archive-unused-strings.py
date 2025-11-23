#!/usr/bin/env python3
"""
Script to archive unused i18n strings from XML files.
Moves unused strings to an archive file to keep the main strings file clean.
"""
import os
import xml.etree.ElementTree as ET
import datetime
import sys
import glob

def get_xml_files(project_root):
    # Find all *strings.xml files in values-is directories
    pattern = os.path.join(project_root, 'apps/members-portal/**/values-is/*strings.xml')
    return glob.glob(pattern, recursive=True)

def archive_unused_strings_in_file(project_root, xml_file_path):
    print(f"\nProcessing: {os.path.relpath(xml_file_path, project_root)}")
    
    archive_dir = os.path.join(project_root, 'archive/unused-strings')
    timestamp = datetime.datetime.now().strftime('%Y-%m-%d')
    
    # Determine archive filename based on source filename and language folder
    filename = os.path.basename(xml_file_path)
    parent_dir = os.path.basename(os.path.dirname(xml_file_path)) # e.g. values-is
    archive_filename = f"unused-{parent_dir}-{filename.replace('.xml', '')}-{timestamp}.xml"
    archive_file_path = os.path.join(archive_dir, archive_filename)

    if not os.path.exists(archive_dir):
        os.makedirs(archive_dir)

    # Parse XML
    try:
        tree = ET.parse(xml_file_path)
        root = tree.getroot()
        # Map name -> element
        all_elements = {child.attrib['name']: child for child in root.findall('string')}
    except Exception as e:
        print(f"Error parsing XML: {e}")
        return

    defined_strings = set(all_elements.keys())
    print(f"Total defined strings: {len(defined_strings)}")

    # Search for usage
    # We search in the whole members-portal to be safe, 
    # as strings might be used across modules or passed as props
    search_extensions = {'.js', '.html'}
    search_root = os.path.join(project_root, 'apps/members-portal')
    
    used_strings = set()
    
    # Walk through files
    for root_dir, _, files in os.walk(search_root):
        # Skip i18n directories to avoid self-reference
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
                            if key in content:
                                used_strings.add(key)
                except Exception as e:
                    print(f"Error reading {file_path}: {e}")

    unused_keys = defined_strings - used_strings
    print(f"Found {len(unused_keys)} unused strings to archive.")

    if not unused_keys:
        return

    # Create Archive XML
    archive_root = ET.Element("resources")
    archive_tree = ET.ElementTree(archive_root)

    # Modify Main XML (Remove unused) and Populate Archive
    for key in sorted(unused_keys):
        element = all_elements[key]
        # Add to archive
        archive_root.append(element)
        # Remove from main
        root.remove(element)
        # print(f"Archiving: {key}") # Commented out to reduce noise

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

    indent(root)
    indent(archive_root)

    # Save files
    tree.write(xml_file_path, encoding='utf-8', xml_declaration=True)
    archive_tree.write(archive_file_path, encoding='utf-8', xml_declaration=True)
    
    print(f"Archived to {os.path.relpath(archive_file_path, project_root)}")

def main():
    current_dir = os.getcwd()
    if current_dir.endswith('scripts'):
        project_root = os.path.dirname(current_dir)
    else:
        project_root = current_dir
        
    xml_files = get_xml_files(project_root)
    print(f"Found {len(xml_files)} XML string files.")
    
    for xml_file in xml_files:
        archive_unused_strings_in_file(project_root, xml_file)

if __name__ == "__main__":
    main()
