import { useState, useRef, useCallback } from "react";
import "./DragAndDropComponent.css";
import { type DroppedFile, type DropZoneStatus, formatBytes, fileIcon } from "./types";
import { uploadFile, type UploadProjectType } from "../../API/api";

interface DragAndDropComponentProps {
  onUploadSuccess: (data: unknown) => void;
}

export const DragAndDropComponent = ({ onUploadSuccess }: DragAndDropComponentProps): React.JSX.Element => {
  const [files, setFiles] = useState<DroppedFile[]>([]);
  const [status, setStatus] = useState<DropZoneStatus>("idle");
  const [uploading, setUploading] = useState(false);
  const [projectType, setProjectType] = useState<UploadProjectType>("single");
  const [uploadError, setUploadError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);


  const addFiles = useCallback((incoming: FileList | File[]) => {
    const list = Array.from(incoming);
    list.forEach((file) => {
      const id = `${file.name}-${file.lastModified}-${Math.random()}`;
      const isImage = file.type.startsWith("image/");

      // Upload to the server (zips need react | vanilla; non-zip always single-file parse)
      const isZip = file.name.toLowerCase().endsWith(".zip");
      const uploadType: UploadProjectType = isZip
        ? projectType === "single"
          ? "react"
          : projectType
        : "single";

      setUploading(true);
      setUploadError(null);
      uploadFile(file, uploadType)
        .then((data: unknown) => {
          onUploadSuccess(data);
        })
        .catch((err: unknown) => {
          const msg = err instanceof Error ? err.message : String(err);
          setUploadError(msg);
          console.error("Upload failed for", file.name, err);
        })
        .finally(() => {
          setUploading(false);
        });

      if (isImage) {
        const reader = new FileReader();
        reader.onload = (e) => {
          setFiles((prev) => [
            ...prev,
            { id, file, preview: e.target?.result as string },
          ]);
        };
        reader.readAsDataURL(file);
      } else {
        setFiles((prev) => [...prev, { id, file, preview: null }]);
      }
    });
  }, [onUploadSuccess, projectType]);

  /* ── Drag events ── */
  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
    setStatus("over");
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    // Only reset if we left the box entirely (not a child)
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setStatus("idle");
    }
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setStatus("idle");
      const dropped = e.dataTransfer.files;
      if (dropped.length === 0) {
        setStatus("rejected");
        setTimeout(() => setStatus("idle"), 1500);
        return;
      }
      addFiles(dropped);
    },
    [addFiles]
  );

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files.length > 0) {
        addFiles(e.target.files);
        e.target.value = ""; 
      }
    },
    [addFiles]
  );

  const handleRemove = useCallback((id: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== id));
  }, []);

  return (
    <div className="dropzone-wrapper">
      {/* Upload overlay */}
      {uploading && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(248, 250, 252, 0.92)",
            backdropFilter: "blur(4px)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
            color: "#0f172a",
            fontSize: "1.25rem",
            gap: "1rem",
            border: "1px solid #e2e8f0",
          }}
        >
          <span style={{ fontSize: "2.5rem" }}>⏳</span>
          Uploading, please wait…
        </div>
      )}

      {/* Header */}
      <div className="dropzone-header">
        <h1 className="dropzone-title">File Drop Zone</h1>
        <p className="dropzone-subtitle">
          Single file: .js / .jsx / .ts / .tsx · Or zip a whole project (React
          or plain HTML/JS)
        </p>
        <label className="dropzone-project-type">
          <span className="dropzone-project-type-label">Parse as</span>
          <select
            className="dropzone-project-type-select"
            value={projectType}
            onChange={(e) =>
              setProjectType(e.target.value as UploadProjectType)
            }
            onClick={(e) => e.stopPropagation()}
          >
            <option value="single">One source file</option>
            <option value="react">React project (zip — uses src/ if present)</option>
            <option value="vanilla">Plain HTML / JS project (zip — all JS under folder)</option>
          </select>
        </label>
        {uploadError && (
          <p
            className="dropzone-upload-error"
            role="alert"
            style={{
              marginTop: "0.75rem",
              maxWidth: "36rem",
              textAlign: "center",
              color: "#b91c1c",
              fontSize: "0.9rem",
              lineHeight: 1.45,
            }}
          >
            {uploadError}
          </p>
        )}
      </div>

      {/* Drop Box */}
      <div
        className="dropzone-box"
        data-status={status}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
      >
        <input
          ref={inputRef}
          type="file"
          multiple
          accept=".js,.jsx,.ts,.tsx,.mjs,.cjs,.mts,.cts,.zip"
          className="dropzone-input"
          onChange={handleInputChange}
          onClick={(e) => e.stopPropagation()} // prevent double-trigger
        />

        <span className="dropzone-icon">
          {status === "over" ? "📂" : status === "rejected" ? "🚫" : "☁️"}
        </span>

        <span className="dropzone-label">
          {status === "over"
            ? "Release to upload"
            : status === "rejected"
            ? "Nothing to drop"
            : "Drop files here"}
        </span>

        <span className="dropzone-hint">
          Call graph from function declarations · Zip must match “Parse as”
        </span>
        <span className="dropzone-browse">Browse files</span>
      </div>

      {status === "rejected" && (
        <p className="dropzone-rejected">No files detected — try again.</p>
      )}

      {/* File List */}
      {files.length > 0 && (
        <div className="file-list">
          <div className="file-list-header">
            <span className="file-list-title">{files.length} file{files.length !== 1 ? "s" : ""} added</span>
            <button className="file-list-clear" onClick={() => setFiles([])}>
              Clear all
            </button>
          </div>

          {files.map((dropped: DroppedFile) => (
            <div key={dropped.id} className="file-card">
              {dropped.preview ? (
                <img
                  src={dropped.preview}
                  alt={dropped.file.name}
                  className="file-preview-thumb"
                />
              ) : (
                <div className="file-icon">
                  {fileIcon(dropped.file.type)}
                </div>
              )}

              <div className="file-info">
                <div className="file-name">{dropped.file.name}</div>
                <div className="file-meta">
                  {formatBytes(dropped.file.size)}
                  {dropped.file.type && ` · ${dropped.file.type}`}
                </div>
              </div>

              <button
                className="file-remove"
                onClick={() => handleRemove(dropped.id)}
                title="Remove"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default DragAndDropComponent;
