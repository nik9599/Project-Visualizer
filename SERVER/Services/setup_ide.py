import os
import shutil
import tempfile
import uuid
import zipfile
from flask import jsonify, send_file

from Services.handleFile import PROJECTS_DIR


def _list_project_files(project_dir: str) -> list[str]:
    skip = {"node_modules", ".git", "dist", "__pycache__"}
    out: list[str] = []
    for root, dirs, files in os.walk(project_dir):
        dirs[:] = [d for d in dirs if d not in skip]
        for f in files:
            full = os.path.join(root, f)
            rel = os.path.relpath(full, project_dir)
            out.append(rel.replace("\\", "/"))
    return sorted(out)


# 🚀 1. Setup IDE (Upload + Extract ZIP)
def setup_ide(file):
    project_id = str(uuid.uuid4())
    project_dir = os.path.join(PROJECTS_DIR, project_id)

    os.makedirs(project_dir, exist_ok=True)

    try:
        # Save zip
        zip_path = os.path.join(project_dir, file.filename)
        file.save(zip_path)

        # Extract zip
        with zipfile.ZipFile(zip_path, 'r') as zip_ref:
            zip_ref.extractall(project_dir)

        # Optional: remove zip after extraction
        os.remove(zip_path)

        file_structure = _list_project_files(project_dir)

        return jsonify({
            "message": "IDE setup successful",
            "projectId": project_id,
            "file_structure": file_structure
        }), 200

    except Exception as e:
        shutil.rmtree(project_dir, ignore_errors=True)
        return jsonify({"error": str(e)}), 500


# ✍️ 2. Update File
def updateFile(project_id: str, file_path: str, content: str):
    project_dir = os.path.abspath(os.path.join(PROJECTS_DIR, project_id))

    if not os.path.exists(project_dir):
        return jsonify({"error": "Project not found"}), 404

    # Secure path
    full_path = os.path.abspath(os.path.join(project_dir, file_path))

    if not full_path.startswith(project_dir):
        return jsonify({"error": "Invalid file path"}), 400

    try:
        # Ensure directory exists
        os.makedirs(os.path.dirname(full_path), exist_ok=True)

        # Write updated content
        with open(full_path, 'w', encoding='utf-8') as f:
            f.write(content)

        return jsonify({
            "success": True,
            "path": file_path,
            "message": "File updated successfully"
        }), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500


# 📥 3. Get File Content (IMPORTANT for editor)
def getFileContent(project_id: str, file_path: str):
    project_dir = os.path.abspath(os.path.join(PROJECTS_DIR, project_id))

    if not os.path.exists(project_dir):
        return jsonify({"error": "Project not found"}), 404

    full_path = os.path.abspath(os.path.join(project_dir, file_path))

    if not full_path.startswith(project_dir):
        return jsonify({"error": "Invalid file path"}), 400

    try:
        with open(full_path, 'r', encoding='utf-8', errors='ignore') as f:
            content = f.read()

        return jsonify({
            "content": content
        }), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500


# 📦 4. Download Updated Project
def downloadProject(project_id: str):
    project_dir = os.path.abspath(os.path.join(PROJECTS_DIR, project_id))

    if not os.path.exists(project_dir):
        return jsonify({"error": "Project not found"}), 404

    try:
        # Create temp zip
        with tempfile.NamedTemporaryFile(suffix=".zip", delete=False) as tmp_zip:
            zip_path = tmp_zip.name

        with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as zf:
            for root, dirs, files in os.walk(project_dir):
                # Optional: skip heavy folders
                dirs[:] = [d for d in dirs if d not in ["node_modules", ".git", "dist"]]

                for file in files:
                    file_path = os.path.join(root, file)
                    arcname = os.path.relpath(file_path, project_dir)
                    zf.write(file_path, arcname)

        # Return file
        return send_file(
            zip_path,
            as_attachment=True,
            download_name=f"updated_project_{project_id}.zip",
            mimetype="application/zip"
        )

    except Exception as e:
        if os.path.exists(zip_path):
            os.unlink(zip_path)
        return jsonify({"error": str(e)}), 500


# 🧹 5. (Optional but important) Cleanup project
def deleteProject(project_id: str):
    project_dir = os.path.join(PROJECTS_DIR, project_id)

    if os.path.exists(project_dir):
        shutil.rmtree(project_dir)
        return jsonify({"message": "Project deleted"}), 200

    return jsonify({"error": "Project not found"}), 404