/* jsx preact */
/* @jsxImportSource preact */
import { render } from 'preact';
import { QueryClientProvider } from '@tanstack/react-query';
import { EditorModule } from './views/spec-editor/EditorModule';
import { queryClient } from './lib/query';

// eslint-disable-next-line react-refresh/only-export-components
function EditorRoot() {
  const content = (<EditorModule />) as any;
  return (
    <QueryClientProvider client={queryClient}>{content}</QueryClientProvider>
  );
}

render(<EditorRoot />, document.getElementById('root')!);
