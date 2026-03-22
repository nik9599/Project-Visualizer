from flask import Blueprint, jsonify, request
from Services.handleFile import (
    downloadProject,
    graph_from_saved_project,
    updateFile,
    uploadFile,
)
from Services.setup_ide import setup_ide as setup_ide_service

main = Blueprint("main", __name__)


@main.route("/")
def home():
    """Home endpoint"""
    return jsonify({"message": "Welcome to ProjectVisualizer API"})


@main.route("/upload", methods=["POST"])
def upload():
    """
    Upload a JS/TS file or a zip project for call graph analysis.
    
    Request:
    - file: One source file (.js, .jsx, .ts, .tsx) or a .zip archive
    - project_type: "single", "react", or "vanilla" (optional, defaults to "single")
    
    Response:
    - filename: The uploaded file name
    - project_type: The project type used for analysis
    - graph: The dependency graph with nodes and edges
    - debug_logs: Debug output from the parser
    """
    file = request.files.get("file")
    if not file:
        return jsonify({"error": "No file provided"}), 400

    project_type = request.form.get("project_type", "single")
    persist_raw = (request.form.get("persist") or "false").strip().lower()
    persist = persist_raw in ("1", "true", "yes")
    return uploadFile(file, project_type, persist=persist)


@main.route("/project-graph/<project_id>", methods=["POST"])
def project_graph(project_id):
    """Re-build call graph from a project folder created by Setup IDE."""
    body = request.get_json(silent=True) or {}
    project_type = body.get("project_type", "react")
    return graph_from_saved_project(project_id, project_type)


@main.route("/setup-ide", methods=["POST"])
def setup_ide_route():
    """Upload a .zip, extract for IDE browsing."""
    file = request.files.get("file")
    if not file or file.filename == "":
        return jsonify({"error": "No file provided"}), 400
    return setup_ide_service(file)


@main.route("/update/<project_id>", methods=["POST"])
def update_file(project_id):
    """
    Update a file in an extracted project.
    
    Request:
    - file_path: Relative path to the file within the project
    - content: New content for the file
    
    Response:
    - success: True if update was successful
    """
    data = request.get_json()
    if not data or 'file_path' not in data or 'content' not in data:
        return jsonify({"error": "Missing file_path or content"}), 400

    return updateFile(project_id, data['file_path'], data['content'])


@main.route("/download/<project_id>", methods=["GET"])
def download_file(project_id):
    """
    Download the updated project as a zip file.
    
    Response:
    - Zip file containing the updated project
    """
    return downloadProject(project_id)
