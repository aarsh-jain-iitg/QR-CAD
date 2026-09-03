"""
QRCAD  rebuild_cache.py
CLI utility to rebuild the feature cache for a dataset.

Usage:
    python rebuild_cache.py [path/to/dataset]

If no path is supplied, defaults to ./dataset
"""

import sys
import os

#  PATH FIX MUST COME BEFORE src.* IMPORTS 
PROJECT_ROOT = os.path.abspath(os.path.dirname(__file__))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

from src.main import build_database  # noqa: E402  (import after path fix)


def main():
    dataset_path = sys.argv[1] if len(sys.argv) > 1 else "dataset"
    dataset_path = os.path.abspath(dataset_path)

    print(f"[REBUILD] Building cache for: {dataset_path}")

    if not os.path.isdir(dataset_path):
        print(f"[ERROR] Path does not exist: {dataset_path}", file=sys.stderr)
        sys.exit(1)

    try:
        result = build_database(dataset_path)
        if "error" in result:
            print(f"[ERROR] {result['error']}", file=sys.stderr)
            sys.exit(1)
        print(f"[REBUILD] Done. {result['valid_files']} models indexed.")
    except Exception as e:
        print(f"[ERROR] Failed to build database  {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
