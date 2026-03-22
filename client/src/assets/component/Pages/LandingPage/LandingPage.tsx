import { useState, useCallback } from "react";
import DragAndDropComponent from "../DragDropComponent/DragAndDropComponent";
import GraphGenerator from "../GraphGenrater/GraphGenerator";
import { fetchProjectGraph, type UploadProjectType } from "../../API/api";

export default function LandingPage(): React.JSX.Element {
  const [uploadData, setUploadData] = useState<unknown>(null);
  const [projectId, setProjectId] = useState<string | null>(null);
  const [projectType, setProjectType] = useState<UploadProjectType>("single");
  /** True after Setup IDE until user explicitly builds graph from saved files (no auto /project-graph on setup click). */
  const [setupAwaitingGraph, setSetupAwaitingGraph] = useState(false);
  const [loadingGraphFromProject, setLoadingGraphFromProject] = useState(false);

  const handleUploadSuccess = useCallback((data: unknown) => {
    setSetupAwaitingGraph(false);
    setUploadData(data);
    if (
      data &&
      typeof data === "object" &&
      "project_id" in data &&
      typeof (data as { project_id?: string }).project_id === "string"
    ) {
      setProjectId((data as { project_id: string }).project_id);
    } else {
      setProjectId(null);
    }
  }, []);

  /** Only runs after /setup-ide — does not call /upload or /project-graph. */
  const handleSetupIdeSuccess = useCallback((data: unknown) => {
    const id =
      data &&
      typeof data === "object" &&
      "projectId" in data &&
      typeof (data as { projectId?: string }).projectId === "string"
        ? (data as { projectId: string }).projectId
        : null;
    if (!id) {
      console.error("Setup IDE response missing projectId", data);
      return;
    }
    setProjectId(id);
    setUploadData(null);
    setSetupAwaitingGraph(true);
  }, []);

  const loadGraphFromSavedProject = useCallback(async () => {
    if (!projectId) return;
    setLoadingGraphFromProject(true);
    try {
      const graphPayload = await fetchProjectGraph(projectId, projectType);
      setUploadData(graphPayload);
      setSetupAwaitingGraph(false);
    } catch (e) {
      console.error(e);
      window.alert(
        e instanceof Error ? e.message : "Could not build graph from saved project"
      );
    } finally {
      setLoadingGraphFromProject(false);
    }
  }, [projectId, projectType]);

  const handleRefreshFromSavedProject = useCallback(async () => {
    if (!projectId) return;
    try {
      const graphPayload = await fetchProjectGraph(projectId, projectType);
      setUploadData(graphPayload);
    } catch (e) {
      console.error(e);
      window.alert(
        e instanceof Error ? e.message : "Could not refresh graph from saved project"
      );
    }
  }, [projectId, projectType]);

  if (setupAwaitingGraph && projectId) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: 24,
          fontFamily: "ui-sans-serif, system-ui, sans-serif",
          background: "linear-gradient(180deg, #f8fafc 0%, #f1f5f9 100%)",
          color: "#0f172a",
        }}
      >
        <h1 style={{ fontSize: "1.5rem", marginBottom: 8 }}>Project saved on server</h1>
        <p style={{ color: "#64748b", marginBottom: 24, textAlign: "center", maxWidth: 420 }}>
          Setup IDE finished (<code style={{ fontSize: "0.85em" }}>{projectId.slice(0, 8)}…</code>
          ). Build the call graph from these saved files — this uses{" "}
          <strong>POST /project-graph</strong>, not <strong>/upload</strong>.
        </p>
        <button
          type="button"
          disabled={loadingGraphFromProject}
          onClick={() => void loadGraphFromSavedProject()}
          style={{
            padding: "12px 24px",
            fontSize: "1rem",
            fontWeight: 600,
            borderRadius: 12,
            border: "none",
            background: "linear-gradient(180deg, #0ea5e9 0%, #0284c7 100%)",
            color: "#fff",
            cursor: loadingGraphFromProject ? "wait" : "pointer",
          }}
        >
          {loadingGraphFromProject ? "Building graph…" : "Build graph from saved project"}
        </button>
      </div>
    );
  }

  return (
    <div>
      {uploadData === null ? (
        <DragAndDropComponent
          projectType={projectType}
          onProjectTypeChange={setProjectType}
          onUploadSuccess={handleUploadSuccess}
          onSetupIdeSuccess={handleSetupIdeSuccess}
        />
      ) : (
        <GraphGenerator
          data={uploadData}
          projectId={projectId}
          onRefreshFromSavedProject={
            projectId ? handleRefreshFromSavedProject : undefined
          }
        />
      )}
    </div>
  );
}
