# QRCAD  hook_meipass.py
# PyInstaller runtime hook.
# This file is executed by PyInstaller BEFORE any other code in the exe.
# It adds sys._MEIPASS to sys.path so that "from src.xxx import yyy" works
# inside the bundled exe without any changes to app.py.

import sys
import os

if getattr(sys, "frozen", False) and hasattr(sys, "_MEIPASS"):
    meipass = sys._MEIPASS
    if meipass not in sys.path:
        sys.path.insert(0, meipass)
