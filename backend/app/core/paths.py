"""
backend/app/core/paths.py

Centralized per-user application data directory management for Quantum Council.
Ensures every user installation stores its database, uploaded files, vector indexes,
and encryption keys in an isolated, OS-standard user profile directory, preventing
shared access, cross-user data leakage, or accidental Git exposure.

Hierarchy:
  <UserDataDir>/
    ├── data/
    │   └── quantum_council.db
    ├── uploads/
    │   └── [sanitized user documents]
    ├── chroma_db/
    │   └── [vector store]
    └── keys/
        └── master.key (0600 permissions, fallback if DPAPI unavailable)
"""

import os
import sys
from pathlib import Path
from typing import Optional


def get_user_data_dir() -> Path:
    """
    Get or create the per-user isolated application data directory.
    Priority:
      1. QUANTUM_COUNCIL_DATA_DIR environment variable (if explicitly set)
      2. Windows: %LOCALAPPDATA%\\QuantumCouncil
      3. macOS: ~/Library/Application Support/QuantumCouncil
      4. Linux/Unix: $XDG_DATA_HOME/quantum_council or ~/.local/share/quantum_council
    """
    custom_dir = os.environ.get("QUANTUM_COUNCIL_DATA_DIR")
    if custom_dir:
        base_dir = Path(custom_dir).resolve()
    elif sys.platform == "win32":
        local_app_data = os.environ.get("LOCALAPPDATA")
        if local_app_data:
            base_dir = Path(local_app_data) / "QuantumCouncil"
        else:
            base_dir = Path.home() / "AppData" / "Local" / "QuantumCouncil"
    elif sys.platform == "darwin":
        base_dir = Path.home() / "Library" / "Application Support" / "QuantumCouncil"
    else:
        xdg_data = os.environ.get("XDG_DATA_HOME")
        if xdg_data:
            base_dir = Path(xdg_data) / "quantum_council"
        else:
            base_dir = Path.home() / ".local" / "share" / "quantum_council"

    return base_dir


def ensure_directory_structure(base_dir: Optional[Path] = None) -> Path:
    """
    Create all required subdirectories with secure permissions.
    Returns the resolved base directory.
    """
    if base_dir is None:
        base_dir = get_user_data_dir()

    data_dir = base_dir / "data"
    uploads_dir = base_dir / "uploads"
    chroma_dir = base_dir / "chroma_db"
    keys_dir = base_dir / "keys"

    for directory in [base_dir, data_dir, uploads_dir, chroma_dir, keys_dir]:
        directory.mkdir(parents=True, exist_ok=True)
        # Apply restrictive permissions on POSIX systems (rwx------)
        if sys.platform != "win32":
            try:
                os.chmod(directory, 0o700)
            except OSError:
                pass

    return base_dir


def get_database_path() -> Path:
    """Get the absolute path to the user's isolated SQLite database."""
    base = get_user_data_dir()
    return base / "data" / "quantum_council.db"


def get_uploads_dir() -> Path:
    """Get the absolute path to the user's isolated uploaded documents directory."""
    base = get_user_data_dir()
    uploads = base / "uploads"
    uploads.mkdir(parents=True, exist_ok=True)
    return uploads


def get_keys_dir() -> Path:
    """Get the absolute path to the user's isolated encryption keys directory."""
    base = get_user_data_dir()
    keys = base / "keys"
    keys.mkdir(parents=True, exist_ok=True)
    return keys

