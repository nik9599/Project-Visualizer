import { useState } from "react";
import DragAndDropComponent from "../DragDropComponent/DragAndDropComponent";
import GraphGenerator from "../GraphGenrater/GraphGenerator";

export default function LandingPage(): React.JSX.Element {
    const [uploadData, setUploadData] = useState<unknown>(null);

    return (
        <div>
            {uploadData === null ? (
                <DragAndDropComponent onUploadSuccess={setUploadData} />
            ) : (
                <GraphGenerator data={uploadData} />
            )}
        </div>
    );
}
