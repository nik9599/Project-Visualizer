import { useState, useRef, useCallback } from "react";
import "./DragAndDropComponent.css";
import { type DroppedFile, type DropZoneStatus, formatBytes, fileIcon } from "./types";
import { setupIde, uploadFile, type UploadProjectType } from "../../API/api";

function uploadTypeForFile(file: File, projectType: UploadProjectType): UploadProjectType {
  const isZip = file.name.toLowerCase().endsWith(".zip");
  if (!isZip) return "single";
  if (projectType === "single") return "react";
  return projectType;
}

interface DragAndDropComponentProps {
  onUploadSuccess: (data: unknown) => void;
  onSetupIdeSuccess?: (data: unknown) => void;
  projectType: UploadProjectType;
  onProjectTypeChange: (t: UploadProjectType) => void;
}

export const DragAndDropComponent = ({
  onUploadSuccess,
  onSetupIdeSuccess,
  projectType,
  onProjectTypeChange,
}: DragAndDropComponentProps): React.JSX.Element => {
  const [files, setFiles] = useState<DroppedFile[]>([]);
  const [status, setStatus] = useState<DropZoneStatus>("idle");
  const [generating, setGenerating] = useState(false);
  const [setupBusy, setSetupBusy] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  /** Add files to the list only — no network until you use a button. */
  const stageFiles = useCallback((incoming: FileList | File[]) => {
    const list = Array.from(incoming);
    list.forEach((file) => {
      const id = `${file.name}-${file.lastModified}-${Math.random()}`;
      const isImage = file.type.startsWith("image/");
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
  }, []);

  const handleGenerateGraph = useCallback(async () => {
    if (files.length === 0) return;
    setGenerating(true);
    setUploadError(null);
    try {
      for (const dropped of files) {
        const ut = uploadTypeForFile(dropped.file, projectType);
        const data = await uploadFile(dropped.file, ut, { persist: false });
        onUploadSuccess(data);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setUploadError(msg);
      console.error("Generate graph failed", err);
    } finally {
      setGenerating(false);
    }
  }, [files, onUploadSuccess, projectType]);

  const handleSetupIde = useCallback(async () => {
    const zip = files.find((d) => d.file.name.toLowerCase().endsWith(".zip"));
    if (!zip) {
      setUploadError("Setup IDE needs a .zip file in the list.");
      return;
    }
    setSetupBusy(true);
    setUploadError(null);
    try {
      const data = await setupIde(zip.file);
      onSetupIdeSuccess?.(data);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setUploadError(msg);
      console.error("Setup IDE failed", err);
    } finally {
      setSetupBusy(false);
    }
  }, [files, onSetupIdeSuccess]);

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
    setStatus("over");
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
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
      stageFiles(dropped);
    },
    [stageFiles]
  );

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files.length > 0) {
        stageFiles(Array.from(e.target.files));
        e.target.value = "";
      }
    },
    [stageFiles]
  );

  const handleRemove = useCallback((id: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== id));
  }, []);

  const busy = generating || setupBusy;

  return (
    <div className="dropzone-wrapper">
      {busy && (
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
          {generating ? "Generating graph…" : "Setting up IDE…"}
        </div>
      )}

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
              onProjectTypeChange(e.target.value as UploadProjectType)
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
          onClick={(e) => e.stopPropagation()}
        />

        <span className="dropzone-icon">
          {status === "over" ? "📂" : status === "rejected" ? "🚫" : "☁️"}
        </span>

        <span className="dropzone-label">
          {status === "over"
            ? "Release to add"
            : status === "rejected"
            ? "Nothing to drop"
            : "Drop files here"}
        </span>

        <span className="dropzone-hint">
          Files stay in the list until you click Generate graph or Setup IDE
        </span>
        <span className="dropzone-browse">Browse files</span>
      </div>

      {status === "rejected" && (
        <p className="dropzone-rejected">No files detected — try again.</p>
      )}

      {files.length > 0 && (
        <div className="file-list">
          <div className="file-list-header">
            <span className="file-list-title">
              {files.length} file{files.length !== 1 ? "s" : ""} staged
            </span>
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
                <div className="file-icon">{fileIcon(dropped.file.type)}</div>
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

      <div className="dropzone-actions" aria-label="Project actions">
        <p className="dropzone-actions-hint">
          {files.length > 0
            ? "Generate graph runs parse in memory (no saved project). Setup IDE saves a .zip and enables editing + refresh from disk."
            : "Add files — then use Generate graph or Setup IDE"}
        </p>
        <div className="dropzone-actions-row">
          <button
            type="button"
            className="dropzone-btn dropzone-btn-primary"
            disabled={files.length === 0 || busy}
            title={
              files.length === 0
                ? "Stage at least one file"
                : "Call /upload (ephemeral — does not keep a project folder)"
            }
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              void handleGenerateGraph();
            }}
          >
            <span className="dropzone-btn-icon" aria-hidden>
              📊
            </span>
            Generate graph
          </button>
          <button
            type="button"
            className="dropzone-btn dropzone-btn-secondary"
            disabled={files.length === 0 || busy}
            title={
              files.length === 0
                ? "Add a .zip file"
                : "Upload .zip to /setup-ide and save project on the server"
            }
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              void handleSetupIde();
            }}
          >
            <span className="dropzone-btn-icon" aria-hidden>
              ⚙
            </span>
            Setup IDE
          </button>
        </div>
      </div>
    </div>
  );
};

export default DragAndDropComponent;
