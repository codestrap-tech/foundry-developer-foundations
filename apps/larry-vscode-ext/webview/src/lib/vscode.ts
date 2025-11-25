// VSCode webview bridge
 
declare const acquireVsCodeApi: any;

const vscode =
  typeof acquireVsCodeApi === 'function'
    ? acquireVsCodeApi()
    : {
        postMessage: (_: unknown) => void 0,
      };

export function postMessage(msg: unknown) {
  vscode.postMessage(msg);
}

export function onMessage(cb: (msg: any) => void) {
  const handler = (e: MessageEvent) => {
    cb(e.data);
  };

  window.addEventListener('message', handler);

  // Return cleanup function
  return () => {
    window.removeEventListener('message', handler);
  };
}
