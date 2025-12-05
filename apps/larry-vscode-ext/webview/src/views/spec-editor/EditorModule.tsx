/* JSX */
/* @jsxImportSource preact */
import { useState, useEffect, useRef, useMemo } from 'preact/hooks';
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
import { useNextMachineState } from '../../hooks/useNextState';
import { useMachineQuery } from '../../hooks/useMachineQuery';
import { useReadFile } from '../../hooks/useReadFile';

interface EditorState {
  currentContent: string;
  fileName: string;
  filePath: string;
  contentLoaded: boolean;
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
    filePath: '',
    contentLoaded: false,
    larryState: undefined,
  });
  const [footerLocked, setFooterLocked] = useState(false);

  const originalContent = useRef<string>('');
  const debounceTimerRef = useRef<number | null>(null);
  const initPhase = useRef<'waiting' | 'normalizing' | 'ready'>('waiting');

  // Dirty = current content differs from normalized baseline (only after init complete)
  const isDirty = initPhase.current === 'ready' && originalContent.current !== editorState.currentContent;

  const {data: machineData, refetch: refetchMachineData} = useMachineQuery(editorState.larryState?.apiUrl || '', editorState.larryState?.currentThreadId || '');
  const {fetch: fetchNextState} = useNextMachineState(editorState.larryState?.apiUrl || '');
  const {fetch: getContentFile} = useReadFile();

  const machineStatus = machineData?.status;


  const fullStateKey = useMemo(() => {
    const larryStateMachineData = editorState.larryState?.machineData as MachineResponse | undefined;
    
    return larryStateMachineData?.currentState || machineData?.currentState;
  }, [editorState.larryState?.machineData, machineData?.currentState]);

  // Get state data from machine context
  const getStateData = () => {
    const larryStateMachineData = editorState.larryState?.machineData as MachineResponse | undefined;
    if (!fullStateKey || !larryStateMachineData?.context || machineData?.context) return undefined;
    return larryStateMachineData.context[fullStateKey] || machineData?.context?.[fullStateKey];
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
            filePath: msg.filePath,
            contentLoaded: true,
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
          if (msg.queryCache) {
            hydrateQueryCache(msg.queryCache);
            setTimeout(() => {
              refetchMachineData();
            }, 1000);
            // Reload file content from disk to ensure we have latest version
            if (editorState.filePath) {
              getContentFile(editorState.filePath).then(content => {
                setEditorState(prev => ({
                  ...prev,
                  currentContent: content,
                }));
                // Update baseline if we're in ready phase
                if (initPhase.current === 'ready') {
                  originalContent.current = content;
                }
              }).catch(error => {
                console.error('Failed to reload file content:', error);
              });
            }
          }
          break;
      }
    });

    // Request initial content from extension
    postMessage({ type: 'getEditorContent' });

    return cleanup;
  }, []);


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
    console.log('running handleProceed');
    // Clear any pending debounce and save immediately
    if (debounceTimerRef.current !== null) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
    
    // Force save current content immediately
    postMessage({ type: 'edit', content: editorState.currentContent });

    const stateData = getStateData();
    const threadId = editorState.larryState?.currentThreadId;
    const apiUrl = editorState.larryState?.apiUrl;
    
    if (!threadId || !fullStateKey || !apiUrl) {
      console.error('Missing required values for proceed action:', {
        threadId,
        fullStateKey,
        apiUrl,
        larryState: editorState.larryState,
      });
      return;
    }

    setFooterLocked(true);
    postMessage({ type: 'set_larry_working', isWorking: true });

    // 2s delay to ensure save is processed
    // and also synced with Docker container
    await new Promise(resolve => setTimeout(resolve, 2000));

    const userMessage = isDirty 
      ? 'I have reviewed and modified the specification. Please proceed.'
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


    try {
      setFooterLocked(true);
      await fetchNextState({ machineId: threadId, contextUpdate: { [fullStateKey]: { approved: true, messages } } });
    } catch (error) {
      console.error('Failed to call proceed:', error);
      setFooterLocked(false);
      postMessage({ type: 'set_larry_working', isWorking: false });
    }
  };

  // Determine review type
  const isSpecReview = machineData?.currentState?.includes('specReview');
  const isArchitectureReview = machineData?.currentState?.includes('architectureReview');

  // Unlock footer when machine status returns to awaiting human
  useEffect(() => {
    if (machineStatus === 'awaiting_human') {
      setFooterLocked(false);
    }
  }, [machineStatus]);

  // Only show footer when awaiting human review and not locked
  const showFooter = machineStatus === 'awaiting_human' && !footerLocked;

  const isProceedDisabled = !editorState.larryState?.currentThreadId || !editorState.larryState?.apiUrl || !fullStateKey;

  return (
    <div className="editor-module">
      <div className="editor-header">
        <h2 className="editor-title">
          {isSpecReview ? (
            <span><BookText className="editor-title--icon" /> Specification Review</span>
          ) : isArchitectureReview ? (
            <span><MessageSquareCode className="editor-title--icon" /> Architecture Review</span>
          ) : (
            <span>Larry AI Editor</span>
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
            className={`btn ${!isProceedDisabled ? 'btn-primary' : 'btn-disabled'}`}
            onClick={handleProceed}
            disabled={isProceedDisabled}
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

