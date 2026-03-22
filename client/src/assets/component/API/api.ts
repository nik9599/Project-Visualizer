export type UploadProjectType = "single" | "react" | "vanilla";

/**
 * Upload one .js/.ts/.tsx file, or a .zip of a project (use projectType react | vanilla).
 */
export const uploadFile = async (
    file: File,
    projectType: UploadProjectType = "single",
    options?: { persist?: boolean }
) => {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("project_type", projectType);
    formData.append("persist", options?.persist ? "true" : "false");
    const response = await fetch("http://localhost:8000/upload", {
        method: "POST",
        body: formData,
    });
    let data: unknown;
    try {
        data = await response.json();
    } catch {
        throw new Error(`Server error (${response.status})`);
    }
    if (!response.ok) {
        const err = data as { error?: string };
        throw new Error(
            typeof err.error === "string" ? err.error : `Request failed (${response.status})`
        );
    }
    return data;
};

/** Re-run parser on a project saved by Setup IDE (under server/projects/). */
export const fetchProjectGraph = async (
    projectId: string,
    projectType: UploadProjectType
) => {
    const mode = projectType === "single" ? "react" : projectType;
    const response = await fetch(`http://localhost:8000/project-graph/${projectId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ project_type: mode }),
    });
    let data: unknown;
    try {
        data = await response.json();
    } catch {
        throw new Error(`Server error (${response.status})`);
    }
    if (!response.ok) {
        const err = data as { error?: string };
        throw new Error(
            typeof err.error === "string" ? err.error : `Request failed (${response.status})`
        );
    }
    return data;
};

/**
 * Update a file in an extracted project.
 */
export const updateFile = async (
    projectId: string,
    filePath: string,
    content: string
) => {
    const response = await fetch(`http://localhost:8000/update/${projectId}`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            file_path: filePath,
            content: content,
        }),
    });
    let data: unknown;
    try {
        data = await response.json();
    } catch {
        throw new Error(`Server error (${response.status})`);
    }
    if (!response.ok) {
        const err = data as { error?: string };
        throw new Error(
            typeof err.error === "string" ? err.error : `Request failed (${response.status})`
        );
    }
    return data;
};

/**
 * Download the updated project as a zip file.
 */
export const downloadProject = async (projectId: string) => {
    const response = await fetch(`http://localhost:8000/download/${projectId}`);
    if (!response.ok) {
        throw new Error(`Download failed (${response.status})`);
    }
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `updated_project_${projectId}.zip`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
};


export const setupIde = async (file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    const response = await fetch("http://localhost:8000/setup-ide", {
        method: "POST",
        body: formData,
    });
    let data: unknown;
    try {
        data = await response.json();
    } catch {
        throw new Error(`Server error (${response.status})`);
    }
    if (!response.ok) {
        const err = data as { error?: string };
        throw new Error(
            typeof err.error === "string" ? err.error : `Request failed (${response.status})`
        );
    }
    return data;
};