#!/bin/bash
# Quick ping test to main European GCP regions

echo "======================================"
echo "🌍 Quick GCP Region Test from Iceland"
echo "======================================"
echo ""
echo "Testing closest regions..."
echo ""

# Test main regions
echo "1. Finland (europe-north1) - Closest geographically:"
ping -c 4 europe-north1-docker.pkg.dev | grep -E "avg|loss"
echo ""

echo "2. Belgium (europe-west1):"
ping -c 4 europe-west1-docker.pkg.dev | grep -E "avg|loss"
echo ""

echo "3. Netherlands (europe-west4):"
ping -c 4 europe-west4-docker.pkg.dev | grep -E "avg|loss"
echo ""

echo "4. UK London (europe-west2):"
ping -c 4 europe-west2-docker.pkg.dev | grep -E "avg|loss"
echo ""

echo "5. Germany Frankfurt (europe-west3):"
ping -c 4 europe-west3-docker.pkg.dev | grep -E "avg|loss"
echo ""

echo "======================================"
echo "Choose the region with lowest ms!"
echo "======================================"