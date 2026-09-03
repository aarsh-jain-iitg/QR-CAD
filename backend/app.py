"""
QRCAD backend/app.py
Flask REST API backend.
Serves the Electron frontend and handles:
  /cache-status  POST
  /build-cache   POST
  /delete-cache  POST
  /search        POST (multipart/form-data with .stl file)
"""

import os
import sys
import io
import traceback
import logging
from logging.handlers import RotatingFileHandler

if getattr(sys, "frozen", False):
    PROJECT_ROOT = sys._MEIPASS
else:
    PROJECT_ROOT = os.path.abspath(
        os.path.join(os.path.dirname(__file__), "..")
    )

if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

from flask import Flask, jsonify, request, send_file
from flask_cors import CORS
from werkzeug.utils import secure_filename

from src.main import (
    build_database,
    delete_cache_file,
    get_cache_status,
    search_query,
    get_build_progress,
)
from backend.export import (
    generate_csv,
    generate_pdf,
    validate_export_request,
)

app = Flask(__name__)
CORS(app)

# Queries directory: use env var in production, local in dev
if getattr(sys, "frozen", False):
    QUERIES_DIR = os.environ.get('QRCAD_QUERIES_DIR')
    if not QUERIES_DIR:
        # Fallback if env var not set
        appdata = os.environ.get('APPDATA', os.path.expanduser('~'))
        QUERIES_DIR = os.path.join(appdata, 'QRCAD', 'Queries')
else:
    QUERIES_DIR = os.path.join(os.path.dirname(__file__), "queries")

# Reports directory for future use
if getattr(sys, "frozen", False):
    REPORTS_DIR = os.environ.get('QRCAD_REPORTS_DIR')
    if not REPORTS_DIR:
        appdata = os.environ.get('APPDATA', os.path.expanduser('~'))
        REPORTS_DIR = os.path.join(appdata, 'QRCAD', 'Reports')
else:
    REPORTS_DIR = os.path.join(os.path.dirname(__file__), "..", "outputs", "results")

# Logs directory
if getattr(sys, "frozen", False):
    LOGS_DIR = os.environ.get('QRCAD_LOGS_DIR')
    if not LOGS_DIR:
        appdata = os.environ.get('APPDATA', os.path.expanduser('~'))
        LOGS_DIR = os.path.join(appdata, 'QRCAD', 'Logs')
else:
    LOGS_DIR = os.path.join(os.path.dirname(__file__), "..", "logs")

# Ensure all directories exist
os.makedirs(QUERIES_DIR, exist_ok=True)
os.makedirs(REPORTS_DIR, exist_ok=True)
os.makedirs(LOGS_DIR, exist_ok=True)

# Configure logging
log_file = os.path.join(LOGS_DIR, 'backend.log')
handler = RotatingFileHandler(
    log_file,
    maxBytes=10*1024*1024,  # 10 MB
    backupCount=7  # Keep 7 days
)
handler.setFormatter(logging.Formatter(
    '%(asctime)s - %(levelname)s - %(message)s'
))
app.logger.addHandler(handler)
app.logger.setLevel(logging.INFO)

app.logger.info('=== QRCAD Backend Starting ===')
app.logger.info(f'Project root: {PROJECT_ROOT}')
app.logger.info(f'Queries dir: {QUERIES_DIR}')
app.logger.info(f'Logs dir: {LOGS_DIR}')

ALLOWED_EXTENSIONS = {".stl"}


def _is_allowed_file(filename: str) -> bool:
    return os.path.splitext(filename.lower())[1] in ALLOWED_EXTENSIONS


@app.route("/")
def home():
    return jsonify({"status": "QRCAD Backend Running"})


@app.route("/health")
def health():
    """Health check endpoint for Electron startup validation."""
    return jsonify({"status": "ok"})


@app.route("/count-models", methods=["POST"])
def count_models():
    """
    Lightweight recursive count of .stl files in a folder.
    No processing, just file counting.
    Also returns metadata: file list + modification times for cache validation.
    """
    try:
        data = request.get_json(force=True)
        dataset_path = data.get("dataset_path", "").strip()
        if not dataset_path:
            return jsonify({"error": "dataset_path is required"}), 400
        
        if not os.path.isdir(dataset_path):
            return jsonify({"error": "Path does not exist"}), 400
        
        # Collect all STL files with their metadata
        files_list = []
        count = 0
        for root, _dirs, files in os.walk(dataset_path):
            for fname in files:
                if fname.lower().endswith(".stl"):
                    full_path = os.path.join(root, fname)
                    try:
                        mtime = os.path.getmtime(full_path)
                        files_list.append({
                            "name": fname,
                            "path": os.path.relpath(full_path, dataset_path),
                            "mtime": mtime
                        })
                        count += 1
                    except (OSError, ValueError):
                        pass  # Skip files we can't stat
        
        return jsonify({
            "count": count,
            "files": files_list
        })
    except Exception as e:
        app.logger.error(f"Count models error: {str(e)}")
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@app.route("/cache-status", methods=["POST"])
def cache_status():
    try:
        data = request.get_json(force=True)
        dataset_path = data.get("dataset_path", "").strip()
        if not dataset_path:
            return jsonify({"error": "dataset_path is required"}), 400
        
        status = get_cache_status(dataset_path)
        
        # Add file size and last modified timestamp
        if status.get("exists"):
            from src.cache import get_cache_path
            cache_path = get_cache_path(dataset_path)
            if os.path.exists(cache_path):
                stat = os.stat(cache_path)
                status["cache_size_bytes"] = stat.st_size
                status["last_modified"] = stat.st_mtime
        
        return jsonify(status)
    except Exception as e:
        app.logger.error(f"Cache status error: {str(e)}")
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@app.route("/validate-cache", methods=["POST"])
def validate_cache():
    """
    Validate cache integrity by comparing current file list with saved metadata.
    Returns: {
        "valid": bool,
        "reason": str (if invalid),
        "model_count": int,
        "last_indexed": timestamp,
        "cache_file_path": str (path to cache directory)
    }
    """
    try:
        data = request.get_json(force=True)
        dataset_path = data.get("dataset_path", "").strip()
        if not dataset_path:
            return jsonify({"error": "dataset_path is required"}), 400
        
        from src.cache import get_cache_path, METADATA_FILENAME
        
        cache_dir = get_cache_path(dataset_path)
        metadata_file = os.path.join(cache_dir, METADATA_FILENAME)
        
        # Check if cache exists
        if not os.path.isdir(cache_dir):
            return jsonify({
                "valid": False,
                "reason": "Cache directory does not exist"
            })
        
        # Check if metadata exists
        if not os.path.exists(metadata_file):
            return jsonify({
                "valid": False,
                "reason": "Cache metadata missing"
            })
        
        # Load saved metadata
        try:
            with open(metadata_file, 'r') as f:
                import json
                saved_metadata = json.load(f)
        except Exception as e:
            return jsonify({
                "valid": False,
                "reason": f"Could not read metadata: {str(e)}"
            })
        
        # Get current file list by directly scanning the dataset
        try:
            # **8B FIX: Directly scan dataset instead of calling count_models() endpoint**
            current_files = []
            current_count = 0
            
            for root, _dirs, files in os.walk(dataset_path):
                for fname in files:
                    if fname.lower().endswith(".stl"):
                        full_path = os.path.join(root, fname)
                        try:
                            mtime = os.path.getmtime(full_path)
                            rel_path = os.path.relpath(full_path, dataset_path)
                            current_files.append({
                                "name": fname,
                                "path": rel_path,
                                "mtime": mtime
                            })
                            current_count += 1
                        except (OSError, ValueError):
                            pass  # Skip files we can't stat
        except Exception as e:
            return jsonify({
                "valid": False,
                "reason": f"Error scanning dataset: {str(e)}"
            })
        
        # Compare: count and file list
        saved_count = saved_metadata.get("model_count", 0)
        saved_files = {f["path"]: f["mtime"] for f in saved_metadata.get("files", [])}
        current_files_dict = {f["path"]: f["mtime"] for f in current_files}
        
        # **BUG 2 DEBUG: Log counts first**
        print(f"\n[DEBUG VALIDATE] Current count: {current_count}, Saved count: {saved_count}")
        
        # Check if counts match
        if current_count != saved_count:
            print(f"[DEBUG VALIDATE] COUNT MISMATCH DETECTED!")
            return jsonify({
                "valid": False,
                "reason": f"Model count changed: {saved_count} → {current_count}",
                "model_count": current_count,
                "last_indexed": saved_metadata.get("timestamp"),
                "cache_file_path": cache_dir
            })
        
        # Check if file set matches (allowing mtimes to change slightly)
        # For now, just check filenames exist
        current_paths = set(current_files_dict.keys())
        saved_paths = set(saved_files.keys())
        
        # **BUG 2 DEBUG: Log the path sets before comparison**
        print(f"\n[DEBUG VALIDATE] Path comparison:")
        print(f"  Saved paths ({len(saved_paths)}): {list(saved_paths)[:5]}")
        if len(saved_paths) > 5:
            print(f"    ... and {len(saved_paths) - 5} more")
        print(f"  Current paths ({len(current_paths)}): {list(current_paths)[:5]}")
        if len(current_paths) > 5:
            print(f"    ... and {len(current_paths) - 5} more")
        
        if current_paths != saved_paths:
            print(f"[DEBUG VALIDATE] PATH SET MISMATCH DETECTED!")
            missing = saved_paths - current_paths
            new_files = current_paths - saved_paths
            reason_parts = []
            if missing:
                reason_parts.append(f"{len(missing)} files removed")
                print(f"  Missing: {list(missing)[:3]}")
            if new_files:
                reason_parts.append(f"{len(new_files)} files added")
                print(f"  New: {list(new_files)[:3]}")
            
            return jsonify({
                "valid": False,
                "reason": ", ".join(reason_parts),
                "model_count": current_count,
                "last_indexed": saved_metadata.get("timestamp"),
                "cache_file_path": cache_dir
            })
        
        print(f"[DEBUG VALIDATE] Cache validation PASSED - all paths match!")
        # Cache is valid - return with cache_file_path
        return jsonify({
            "valid": True,
            "model_count": current_count,
            "last_indexed": saved_metadata.get("timestamp"),
            "cache_file_path": cache_dir
        })
    
    except Exception as e:
        app.logger.error(f"Cache validation error: {str(e)}")
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@app.route("/delete-cache", methods=["POST"])
def delete_cache():
    try:
        data = request.get_json(force=True)
        dataset_path = data.get("dataset_path", "").strip()
        if not dataset_path:
            return jsonify({"error": "dataset_path is required"}), 400
        return jsonify({"success": delete_cache_file(dataset_path)})
    except Exception as e:
        app.logger.error(f"Delete cache error: {str(e)}")
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@app.route("/build-cache", methods=["POST"])
def build_cache():
    try:
        data = request.get_json(force=True)
        dataset_path = data.get("dataset_path", "").strip()
        if not dataset_path:
            return jsonify({"error": "dataset_path is required"}), 400
        app.logger.info(f"Building cache for: {dataset_path}")
        result = build_database(dataset_path)
        
        if result.get("error"):
            return jsonify(result), 400
        
        # Add cache_file_path to response
        from src.cache import get_cache_path
        cache_file_path = get_cache_path(dataset_path)
        result["cache_file_path"] = cache_file_path
        
        app.logger.info(f"Cache build complete: {result.get('valid_files', 0)} files")
        return jsonify(result)
    except Exception as e:
        app.logger.error(f"Build cache error: {str(e)}")
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@app.route("/build-progress", methods=["GET"])
def build_progress():
    """
    Get current cache build progress with ETA estimate.
    """
    try:
        return jsonify(get_build_progress())
    except Exception as e:
        app.logger.error(f"Build progress error: {str(e)}")
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@app.route("/search", methods=["POST"])
def search():
    import time
    temp_path = None
    start_time = time.time()
    
    try:
        if "file" not in request.files:
            return jsonify({"error": "No STL file uploaded"}), 400

        uploaded_file = request.files["file"]
        if not _is_allowed_file(uploaded_file.filename):
            return jsonify({"error": "Only .stl files are accepted"}), 400

        dataset_path = request.form.get("dataset_path", "").strip()
        if not dataset_path:
            return jsonify({"error": "dataset_path is required"}), 400

        top_k = int(request.form.get("top_k", 5))
        os.makedirs(QUERIES_DIR, exist_ok=True)

        safe_name = secure_filename(uploaded_file.filename)
        temp_path = os.path.join(QUERIES_DIR, safe_name)
        uploaded_file.save(temp_path)

        print(f"[SEARCH] Processing query: {safe_name} against dataset: {dataset_path}")
        
        search_result = search_query(
            query_path=temp_path,
            dataset_path=dataset_path,
            top_k=top_k,
        )
        
        print(f"[SEARCH] Search completed. Keys in result: {list(search_result.keys())}")
        
        total_time = time.time() - start_time

        # Return new format with metadata and timing
        # CRITICAL: Return the temp_path so frontend can load it for current session only
        response = {
            "results": search_result["results"],
            "query_file": safe_name,
            "query_file_path": temp_path,  # Full path for 3D viewer (session only)
            "query_metadata": search_result["query_metadata"],
            "stats": {
                "total_time": round(total_time, 3),
                "feature_extraction_time": search_result.get("feature_extraction_time", None),
                "retrieval_time": search_result.get("retrieval_time", None),
                "models_compared": search_result.get("models_compared", len(search_result["results"])),
                "feature_dimension": search_result.get("feature_dimension", None)
            }
        }
        
        print(f"[SEARCH] Response structure: {list(response.keys())}, stats: {list(response['stats'].keys())}")
        
        return jsonify(response)

    except Exception as e:
        print(f"[SEARCH ERROR] {type(e).__name__}: {str(e)}")
        app.logger.error(f"Search error: {str(e)}")
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@app.route("/export-report", methods=["POST"])
def export_report():
    """
    Export search results to CSV or PDF format.
    Accepts JSON body with query results and format specification.
    Supports both single-query and batch modes.
    """
    try:
        data = request.get_json(force=True)
        
        # Validate request
        is_valid, error_msg = validate_export_request(data)
        if not is_valid:
            return jsonify({"error": error_msg}), 400
        
        export_format = data.get('format', '').lower()
        batch = data.get('batch', False)
        timestamp = data.get('timestamp', '')
        
        # Generate filename
        if batch:
            base_filename = f"qrcad_batch_report_{timestamp.replace(':', '-').replace(' ', '_')}"
        else:
            query_filename = data.get('query_filename', 'query')
            # Sanitize filename
            safe_query_name = secure_filename(query_filename.replace('.stl', '').replace('.STL', ''))
            base_filename = f"qrcad_report_{safe_query_name}_{timestamp.replace(':', '-').replace(' ', '_')}"
        
        if export_format == 'csv':
            # Generate CSV
            if batch:
                csv_content = generate_csv(
                    query_filename='',
                    results=[],
                    timestamp=timestamp,
                    batch=True,
                    batch_data=data.get('batch_data', [])
                )
            else:
                csv_content = generate_csv(
                    query_filename=data.get('query_filename', ''),
                    results=data.get('results', []),
                    timestamp=timestamp,
                    batch=False
                )
            
            # Return as downloadable file
            return send_file(
                io.BytesIO(csv_content.encode('utf-8')),
                mimetype='text/csv',
                as_attachment=True,
                download_name=f"{base_filename}.csv"
            )
        
        elif export_format == 'pdf':
            # Generate PDF
            try:
                if batch:
                    pdf_content = generate_pdf(
                        query_filename='',
                        results=[],
                        timestamp=timestamp,
                        batch=True,
                        batch_data=data.get('batch_data', [])
                    )
                else:
                    pdf_content = generate_pdf(
                        query_filename=data.get('query_filename', ''),
                        results=data.get('results', []),
                        timestamp=timestamp,
                        batch=False
                    )
                
                # Return as downloadable file
                return send_file(
                    io.BytesIO(pdf_content),
                    mimetype='application/pdf',
                    as_attachment=True,
                    download_name=f"{base_filename}.pdf"
                )
            except RuntimeError as e:
                return jsonify({"error": str(e)}), 500
        
        return jsonify({"error": "Invalid format"}), 400
    
    except Exception as e:
        app.logger.error(f"Export error: {str(e)}")
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


if __name__ == "__main__":
    print("[QRCAD] Starting backend...")
    print(f"[QRCAD] Project root: {PROJECT_ROOT}")
    print(f"[QRCAD] Queries dir:  {QUERIES_DIR}")
    app.run(
        host="127.0.0.1",
        port=5000,
        debug=False,
        use_reloader=False,
    )

