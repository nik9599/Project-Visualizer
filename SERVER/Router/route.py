from flask import Blueprint, jsonify, request
from Services.handleFile import uploadFile

main = Blueprint("main", __name__)


@main.route("/")
def home():
    """
    Home endpoint
    ---
    responses:
      200:
        description: Welcome message
    """
    return "Hello from ProjectVisulizar API"


@main.route("/upload", methods=["POST"])
def upload():
    """
    Upload a JS/TS file or a zip project for call graph analysis
    ---
    tags:
      - Upload
    consumes:
      - multipart/form-data
    parameters:
      - in: formData
        name: file
        type: file
        required: true
        description: One source file (.js, .jsx, .ts, .tsx, …) or a .zip archive
      - in: formData
        name: project_type
        type: string
        required: false
        enum: [single, react, vanilla]
        description: >
          For a single file the server uses single-file parsing (this field is
          mainly informational). For .zip uploads use "react" or "vanilla".
    responses:
      200:
        description: JSON with filename, project_type, and graph (nodes, edges)
        schema:
          type: object
      400:
        description: No file or invalid request
    """
    file = request.files.get("file")
    if not file:
        return jsonify({"error": "No file provided"}), 400

    project_type = request.form.get("project_type", "single")
    return uploadFile(file, project_type)
