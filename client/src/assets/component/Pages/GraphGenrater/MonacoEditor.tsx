import React, { useRef } from 'react';
import Editor from '@monaco-editor/react';

interface MonacoEditorProps {
  value?: string;
  defaultValue?: string;
  onChange?: (value: string | undefined) => void;
  language?: string;
  theme?: string;
  readOnly?: boolean;
}

export function MonacoEditor({
  value,
  defaultValue,
  onChange,
  language = 'typescript',
  theme = 'vs-dark',
  readOnly = false
}: MonacoEditorProps): React.JSX.Element {
  const editorRef = useRef<any>(null);

  const handleEditorDidMount = (editor: any) => {
    editorRef.current = editor;
  };

  return (
    <div style={{
      height: '400px',
      width: '100%',
      border: '1px solid #e2e8f0',
      borderRadius: '4px',
      overflow: 'hidden'
    }}>
      <Editor
        height="100%"
        language={language}
        value={value}
        defaultValue={defaultValue}
        onChange={onChange}
        onMount={handleEditorDidMount}
        theme={theme}
        options={{
          readOnly,
          minimap: { enabled: false },
          fontSize: 14,
          lineNumbers: 'on',
          roundedSelection: false,
          scrollBeyondLastLine: false,
          automaticLayout: true,
          wordWrap: 'on',
          tabSize: 2,
          insertSpaces: true,
          detectIndentation: false,
          // Disable some IntelliSense features to reduce false errors
          quickSuggestions: false,
          parameterHints: { enabled: false },
          hover: { enabled: false },
          contextmenu: false,
          codeLens: false,
        }}
      />
    </div>
  );
}