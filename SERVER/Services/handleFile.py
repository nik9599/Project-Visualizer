import json
import os
import shutil
import subprocess
import tempfile
import zipfile
from flask import jsonify

# Absolute paths (parsers are in the Parser/ directory)
_SERVICES_DIR = os.path.dirname(os.path.abspath(__file__))
PARSER_PATH = os.path.join(_SERVICES_DIR, "..", "Parser", "parser.js")
PARSE_PROJECT_PATH = os.path.join(_SERVICES_DIR, "..", "Parser", "parseProject.js")

# project_type from multipart form: "single" | "react" | "vanilla"


def uploadFile(file, project_type: str = "single"):
    """
    Receive a file from Flask, run the Babel parser, return the call graph JSON.

    - Single .js/.ts/.tsx file: project_type should be "single" (default).
    - Zip archive of a frontend project: set project_type to "react" or "vanilla".
    """
    if file is None:
        return jsonify({"error": "No file provided"}), 400

    if file.filename == "":
        return jsonify({"error": "Empty filename"}), 400

    filename = file.filename
    ext = os.path.splitext(filename)[1].lower()
    pt = (project_type or "single").strip().lower()

    if ext == ".zip":
        # Swagger / curl often omit project_type; default zip → React-style scan
        if pt not in ("react", "vanilla"):
            pt = "react"
        return _handle_zip_project(file, filename, pt)

    # Single source file
    if pt not in ("single", "react", "vanilla"):
        pt = "single"

    suffix = ext or ".js"
    with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
        tmp_path = tmp.name
        file.save(tmp_path)

    try:
        result = analyze_js(tmp_path)
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        os.unlink(tmp_path)
    graph = format_for_graph(result)

    payload: dict = {
        "filename": filename,
        "project_type": pt,
        "graph": graph,
    }
    if not graph.get("nodes"):
        payload["hint"] = (
            "No functions were found. This tool picks up function declarations, "
            "const/arrow functions, and class/object methods in JS/TS/TSX."
        )
    return jsonify(payload)


def _handle_zip_project(file, filename: str, mode: str):
    """Extract zip to a temp directory and run parseProject.js."""
    with tempfile.NamedTemporaryFile(suffix=".zip", delete=False) as ztmp:
        zip_path = ztmp.name
        file.save(zip_path)

    extract_dir = tempfile.mkdtemp(prefix="pv_project_")
    try:
        _safe_extract_zip(zip_path, extract_dir)
    except (zipfile.BadZipFile, ValueError) as e:
        os.unlink(zip_path)
        shutil.rmtree(extract_dir, ignore_errors=True)
        return jsonify({"error": f"Invalid zip: {e}"}), 400
    finally:
        os.unlink(zip_path)

    root = _find_project_root(extract_dir)

    try:
        result, debug_logs = analyze_project(root, mode)
    except Exception as e:
        shutil.rmtree(extract_dir, ignore_errors=True)
        return jsonify({"error": str(e)}), 500

    shutil.rmtree(extract_dir, ignore_errors=True)
    print("result: ", result)
    print("debug_logs: ", debug_logs)
    graph = format_for_graph(result)

    payload: dict = {
        "filename": filename,
        "project_type": mode,
        "graph": graph,
        "debug_logs": debug_logs,
    }
    if not graph.get("nodes"):
        payload["hint"] = (
            "No callable units were extracted. Include .js/.ts/.tsx files with "
            "function declarations, const/arrow functions, or class methods. "
            "React zips are scanned under src/ when that folder exists."
        )
    return jsonify(payload)


def _find_project_root(extract_dir: str) -> str:
    """
    If the zip contains a single top-level folder, use that as the project root.
    Otherwise use the extract directory.
    """
    entries = [
        name
        for name in os.listdir(extract_dir)
        if not name.startswith(".")
    ]
    if len(entries) == 1:
        only = os.path.join(extract_dir, entries[0])
        if os.path.isdir(only):
            return only
    return extract_dir


def _safe_extract_zip(zip_path: str, dest_dir: str) -> None:
    dest_dir = os.path.abspath(dest_dir)
    with zipfile.ZipFile(zip_path, "r") as zf:
        for member in zf.infolist():
            name = member.filename.replace("\\", "/")
            if name.startswith("/") or ".." in name.split("/"):
                raise ValueError("Unsafe path in zip archive")
            target = os.path.abspath(os.path.join(dest_dir, name))
            if not target.startswith(dest_dir + os.sep) and target != dest_dir:
                raise ValueError("Zip path escapes extract directory")
        zf.extractall(dest_dir)


def format_for_graph(raw: dict) -> dict:
    """
    Handle both old parser format and new D3.js format.
    Old format: { fnName: { "callees": [...], "code": "function fnName..." } } or { fnName: [callee, ...] }
    New D3.js format: { nodes: [...], links: [...], ... }
    Output: { nodes: [{id, label, external, code?, kind?}], edges: [{source, target}] }
    """
    # Check if this is the new D3.js format
    if "nodes" in raw and "links" in raw:
        # Transform D3.js format to expected format
        nodes = []
        for node in raw["nodes"]:
            formatted_node = {
                "id": node["id"],
                "label": node.get("label", node["id"]),
                "external": False,  # Assume internal unless we can determine otherwise
            }
            if "type" in node:
                formatted_node["kind"] = node["type"]
            if "code" in node and node["code"]:
                formatted_node["code"] = node["code"]
            elif "exports" in node and node["exports"]:
                formatted_node["code"] = f"exports: {', '.join(node['exports'])}"
            nodes.append(formatted_node)

        edges = []
        for link in raw["links"]:
            edges.append({
                "source": link["source"],
                "target": link["target"]
            })

        return {"nodes": nodes, "edges": edges}

    # Handle old format
    callee_map: dict[str, list] = {}
    sources: dict[str, str | None] = {}
    kinds: dict[str, str] = {}

    for fn_id, payload in raw.items():
        if isinstance(payload, list):
            callee_map[fn_id] = payload
            sources[fn_id] = None
        elif isinstance(payload, dict):
            callee_map[fn_id] = list(payload.get("callees", []))
            c = payload.get("code")
            sources[fn_id] = c if isinstance(c, str) else None
            k = payload.get("kind")
            if isinstance(k, str):
                kinds[fn_id] = k
        else:
            continue

    defined = set(callee_map.keys())
    all_ids: set[str] = set(defined)

    for callees in callee_map.values():
        for callee in callees:
            if isinstance(callee, str):
                all_ids.add(callee)

    nodes: list[dict] = []
    for fn_id in sorted(all_ids):
        external = fn_id not in defined
        label = fn_id
        if fn_id.startswith("route:"):
            path_part = fn_id[len("route:") :]
            label = f"Route {path_part}" if path_part else "Route /"
        node: dict = {
            "id": fn_id,
            "label": label,
            "external": external,
        }
        if fn_id in kinds:
            node["kind"] = kinds[fn_id]
        if not external and sources.get(fn_id):
            node["code"] = sources[fn_id]
        nodes.append(node)

    seen_edges: set[tuple] = set()
    edges: list[dict] = []
    for caller, callees in callee_map.items():
        for callee in callees:
            if isinstance(callee, str):
                key = (caller, callee)
                if key not in seen_edges and caller != callee:
                    seen_edges.add(key)
                    edges.append({"source": caller, "target": callee})

    return {"nodes": nodes, "edges": edges}


def analyze_js(file_path: str) -> dict:
    """Run parser.js (single file) via Node and return parsed JSON."""
    proc = subprocess.run(
        ["node", PARSER_PATH, file_path],
        capture_output=True,
        text=True,
        cwd=_SERVICES_DIR,
    )

    if proc.returncode != 0:
        raise RuntimeError(f"Parser error: {proc.stderr.strip()}")

    if not proc.stdout.strip():
        raise RuntimeError(f"Parser produced no output. stderr: {proc.stderr.strip()}")

    return json.loads(proc.stdout)


def analyze_project(root_dir: str, mode: str) -> tuple[dict, str]:
    """Run parseProject.js on a directory (react or vanilla). Returns (result_dict, stderr_logs)"""
    proc = subprocess.run(
        ["node", PARSE_PROJECT_PATH, root_dir, mode],
        capture_output=True,
        text=True,
        cwd=_SERVICES_DIR,
    )

    if proc.returncode != 0:
        raise RuntimeError(f"Project parser error: {proc.stderr.strip()}")

    if not proc.stdout.strip():
        raise RuntimeError(
            f"Project parser produced no output. stderr: {proc.stderr.strip()}"
        )

    return json.loads(proc.stdout), proc.stderr
