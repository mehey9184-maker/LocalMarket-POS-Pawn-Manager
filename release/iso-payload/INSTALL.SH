#!/usr/bin/env bash
set -e
echo "==================================================="
echo "  LOCALMARKET POS & PAWN MANAGER INSTALLER (v1.0.0)"
echo "==================================================="
echo ""
if command -v dpkg >/dev/null 2>&1; then
  echo "Installing Debian package..."
  sudo dpkg -i LOCALMARKET.DEB || sudo apt-get install -f -y
  echo "Installation complete! Launch via 'localmarket-pos' or Application Menu."
else
  echo "dpkg not found. Please extract the Linux archive or run with Node/Electron."
fi
