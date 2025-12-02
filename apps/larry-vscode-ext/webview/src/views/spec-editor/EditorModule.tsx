/* JSX */
/* @jsxImportSource preact */
import { useState, useEffect, useRef } from 'preact/hooks';
import { 
  MDXEditor, 
  headingsPlugin, 
  listsPlugin, 
  quotePlugin, 
  thematicBreakPlugin, 
  markdownShortcutPlugin, 
  codeBlockPlugin,
  codeMirrorPlugin
} from '@mdxeditor/editor';
import { postMessage, onMessage } from '../../lib/vscode';
import { BookText, MessageSquareCode } from 'lucide-preact';
import { hydrateQueryCache } from '../../store/query-sync';
import type { LarryState } from '../../store/larry-state';
import type { MachineResponse } from '../../lib/backend-types';

interface EditorState {
  currentContent: string;
  fileName: string;
  contentLoaded: boolean;
  stateKey: string | undefined;
  larryState: LarryState | undefined;
}

/**
 * EditorModule - Main artifact editor component
 * 
 * Receives state from sidebar via extension relay:
 * - LarryState (threadId, apiUrl, machineData)
 * - Query cache (hydrated on load)
 * 
 * Footer only shows when machine status is 'awaiting_human'.
 * WorkingIndicator and error handling is done in sidebar's StateVisualization2.
 * 
 * See store/docs.md for architecture details.
 */
export function EditorModule() {
  const [editorState, setEditorState] = useState<EditorState>({
    currentContent: '',
    fileName: '',
    contentLoaded: false,
    stateKey: undefined,
    larryState: undefined,
  });
  const [footerLocked, setFooterLocked] = useState(false);

  const originalContent = useRef<string>('');
  const debounceTimerRef = useRef<number | null>(null);
  const initPhase = useRef<'waiting' | 'normalizing' | 'ready'>('waiting');

  // Dirty = current content differs from normalized baseline (only after init complete)
  const isDirty = initPhase.current === 'ready' && originalContent.current !== editorState.currentContent;

  // Get machine status from larryState
  const machineStatus = (editorState.larryState?.machineData as MachineResponse | undefined)?.status;

  // Get the full stateKey from machine data (e.g., "specReview|abc123")
  const getFullStateKey = (): string | undefined => {
    const machineData = editorState.larryState?.machineData as MachineResponse | undefined;
    if (!machineData?.context || !editorState.stateKey) return undefined;
    
    const contextKeys = Object.keys(machineData.context);
    const matchingKey = contextKeys.find(key => key.startsWith(editorState.stateKey + '|'));
    return matchingKey;
  };

  // Get state data from machine context
  const getStateData = () => {
    const fullStateKey = getFullStateKey();
    const machineData = editorState.larryState?.machineData as MachineResponse | undefined;
    if (!fullStateKey || !machineData?.context) return undefined;
    return machineData.context[fullStateKey];
  };

  // Listen for messages from extension
  useEffect(() => {
    const cleanup = onMessage((msg: any) => {
      switch (msg.type) {
        case 'initialContent':
          initPhase.current = 'normalizing';
          
          // Hydrate query cache if provided
          if (msg.queryCache) {
            hydrateQueryCache(msg.queryCache);
          }
          
          setEditorState({
            currentContent: msg.content,
            fileName: msg.fileName,
            contentLoaded: true,
            stateKey: msg.stateKey,
            larryState: msg.larryState,
          });
          setFooterLocked(false);
          break;

        case 'larry_state_update':
          // Update LarryState from sidebar sync
          setEditorState(prev => ({
            ...prev,
            larryState: msg.larryState,
          }));
          // Unlock footer when machine returns to awaiting human
          const updatedStatus = (msg.larryState?.machineData as MachineResponse | undefined)?.status;
          if (updatedStatus === 'awaiting_human') {
            setFooterLocked(false);
          }
          break;

        case 'query_cache_hydrate':
          // Hydrate query cache from sidebar sync
          if (msg.queryCache) {
            hydrateQueryCache(msg.queryCache);
          }
          break;
      }
    });

    // Request initial content from extension
    postMessage({ type: 'getEditorContent' });

    return cleanup;
  }, []);

  // Handle MDXEditor content change
  const handleContentChange = (newContent: string) => {
    if (initPhase.current === 'normalizing') {
      // First change is MDXEditor normalization - save immediately
      postMessage({ type: 'edit', content: newContent });
      originalContent.current = newContent;
      initPhase.current = 'ready';
      
      setEditorState(prev => ({
        ...prev,
        currentContent: newContent,
      }));
      return;
    }

    // Normal editing - debounced save
    setEditorState(prev => ({
      ...prev,
      currentContent: newContent,
    }));

    if (debounceTimerRef.current !== null) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = window.setTimeout(() => {
      postMessage({ type: 'edit', content: newContent });
      debounceTimerRef.current = null;
    }, 500);
  };

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current !== null) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  // Handle proceed action
  const handleProceed = async () => {
    // Clear any pending debounce and save immediately
    if (debounceTimerRef.current !== null) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
    
    // Force save current content immediately
    postMessage({ type: 'edit', content: editorState.currentContent });
    
    // Small delay to ensure save is processed
    await new Promise(resolve => setTimeout(resolve, 100));

    const fullStateKey = getFullStateKey();
    const stateData = getStateData();
    const threadId = editorState.larryState?.currentThreadId;
    const apiUrl = editorState.larryState?.apiUrl;
    
    if (!threadId || !fullStateKey || !apiUrl) {
      console.error('Missing required values for proceed action:', {
        threadId,
        fullStateKey,
        apiUrl,
        larryState: editorState.larryState,
        stateKey: editorState.stateKey,
      });
      return;
    }

    setFooterLocked(true);
    // Tell sidebar to show working indicator BEFORE API call
    postMessage({ type: 'set_sidebar_working', isWorking: true });

    // Build user message
    const userMessage = isDirty 
      ? 'I have reviewed and modified the specification. Approved.'
      : 'Looks good, approved.';

    // Update messages array
    const messages = stateData?.messages ? [...stateData.messages] : [];
    const lastMessage = messages
      .slice()
      .reverse()
      .find((item: any) => item.user === undefined);
    
    if (lastMessage) {
      lastMessage.user = userMessage;
    }

    // Call API directly
    try {
      await fetch(`${apiUrl}/machines/${threadId}/next`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': Math.random().toString(36).substring(2, 15),
        },
        body: JSON.stringify({
          contextUpdate: {
            [fullStateKey]: { approved: true, messages },
          },
        }),
      });

      // Notify extension to tell sidebar to refetch
      postMessage({ type: 'proceed_complete' });
    } catch (error) {
      console.error('Failed to call proceed:', error);
      setFooterLocked(false);
      postMessage({ type: 'set_sidebar_working', isWorking: false });
    }
  };

  // Determine review type
  const isSpecReview = editorState.fileName.startsWith('spec-');
  const isArchitectureReview = editorState.fileName.startsWith('architecture-');

  // Unlock footer when machine status returns to awaiting human
  useEffect(() => {
    if (machineStatus === 'awaiting_human') {
      setFooterLocked(false);
    }
  }, [machineStatus]);

  // Only show footer when awaiting human review and not locked
  const showFooter = machineStatus === 'awaiting_human' && !footerLocked;

  return (
    <div className="editor-module">
      <div className="editor-header">
        <h2 className="editor-title">
          {isSpecReview ? (
            <span><BookText /> Specification Review</span>
          ) : isArchitectureReview ? (
            <span><MessageSquareCode /> Architecture Review</span>
          ) : (
            <span>Review</span>
          )}
        </h2>
      </div>

      <div className="editor-container">
        {editorState.contentLoaded && (
          <MDXEditor
            markdown={editorState.currentContent}
            onChange={handleContentChange}
            className="dark-theme"
            plugins={[
              headingsPlugin(),
              listsPlugin(),
              quotePlugin(),
              thematicBreakPlugin(),
              markdownShortcutPlugin(),
              codeBlockPlugin({ defaultCodeBlockLanguage: 'typescript' }),
              codeMirrorPlugin({ 
                codeBlockLanguages: { 
                  js: 'JavaScript', 
                  jsx: 'JavaScript (React)',
                  ts: 'TypeScript', 
                  typescript: 'TypeScript',
                  tsx: 'TypeScript (React)',
                  css: 'CSS',
                  html: 'HTML',
                  json: 'JSON',
                  md: 'Markdown',
                  python: 'Python',
                  bash: 'Bash',
                  shell: 'Shell',
                  yaml: 'YAML',
                  sql: 'SQL',
                  graphql: 'GraphQL',
                  diff: 'diff',
                  gherkin: 'Gherkin',
                  '': 'Plain Text'
                } 
              }),
            ]}
          />
        )}
      </div>

      {showFooter && (
        <div className="editor-footer">
          <button
            className="btn btn-primary"
            onClick={handleProceed}
            disabled={!editorState.larryState?.currentThreadId || !editorState.larryState?.apiUrl || !getFullStateKey()}
          >
            Proceed
          </button>
          {isDirty && <span className="editor-dirty-indicator">● Modified</span>}
          {!editorState.larryState?.currentThreadId && (
            <span className="editor-warning">Open Larry sidebar to enable proceed</span>
          )}
        </div>
      )}
    </div>
  );
}
