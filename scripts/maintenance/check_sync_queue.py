#!/usr/bin/env python3
"""
Check Sync Queue Status

This script checks the Firestore sync_queue collection for pending or failed items.
It helps verify if the bidirectional sync is working correctly.

Usage:
    export GOOGLE_APPLICATION_CREDENTIALS="path/to/service-account.json"
    python3 scripts/maintenance/check_sync_queue.py
"""

import os
import sys
import firebase_admin
from firebase_admin import credentials, firestore
from datetime import datetime

def init_firebase():
    """Initialize Firebase Admin SDK"""
    try:
        # Check if already initialized
        if not firebase_admin._apps:
            cred = credentials.ApplicationDefault()
            firebase_admin.initialize_app(cred, {
                'projectId': 'ekklesia-prod-10-2025',
            })
        return firestore.client()
    except Exception as e:
        print(f"❌ Error initializing Firebase: {e}")
        print("   Make sure GOOGLE_APPLICATION_CREDENTIALS is set.")
        sys.exit(1)

def check_queue():
    db = init_firebase()
    
    print("🔍 Checking sync_queue status...")
    print("================================")
    
    # Check pending items
    pending_query = db.collection('sync_queue').where('sync_status', '==', 'pending').stream()
    pending_count = 0
    print("\n⏳ Pending Items:")
    for doc in pending_query:
        data = doc.to_dict()
        print(f"   - ID: {doc.id}")
        print(f"     Action: {data.get('action')} {data.get('collection')}")
        print(f"     Kennitala: {data.get('kennitala')}")
        print(f"     Created: {data.get('created_at')}")
        pending_count += 1
        
    if pending_count == 0:
        print("   (None)")
        
    # Check failed items
    failed_query = db.collection('sync_queue').where('sync_status', '==', 'failed').stream()
    failed_count = 0
    print("\n❌ Failed Items:")
    for doc in failed_query:
        data = doc.to_dict()
        print(f"   - ID: {doc.id}")
        print(f"     Action: {data.get('action')} {data.get('collection')}")
        print(f"     Kennitala: {data.get('kennitala')}")
        print(f"     Error: {data.get('error_message')}")
        failed_count += 1
        
    if failed_count == 0:
        print("   (None)")
        
    print("\n📊 Summary:")
    print(f"   Pending: {pending_count}")
    print(f"   Failed:  {failed_count}")
    
    if pending_count > 0 or failed_count > 0:
        print("\n⚠️  Sync issues detected!")
        print("   Run the bidirectional-sync function to process pending items.")
    else:
        print("\n✅ Sync queue is healthy.")

if __name__ == "__main__":
    check_queue()
