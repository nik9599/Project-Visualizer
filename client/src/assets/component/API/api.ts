export type UploadProjectType = "single" | "react" | "vanilla";

/**
 * Upload one .js/.ts/.tsx file, or a .zip of a project (use projectType react | vanilla).
 */
export const uploadFile = async (
    file: File,
    projectType: UploadProjectType = "single"
) => {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("project_type", projectType);
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