/* JSX */
/* @jsxImportSource preact */
import { useExtensionStore } from '../store/store';
import { MainRepoScreen } from './MainRepoScreen';
import { WorktreeScreen } from './WorktreeScreen';
import { Loader } from './components/Loader';
import { postMessage } from '../lib/vscode';
import { RefreshCcwIcon, RefreshCwIcon, RefreshCwOffIcon } from 'lucide-preact';
import { useState } from 'preact/hooks';

export function AppRoot() {
  const { isInWorktree, isLoadingApp } = useExtensionStore();
  const [isReloading, setIsReloading] = useState(false);
  const handleReloadExtension = () => {
    setIsReloading(true);
    postMessage({ type: 'reload_extension' });
  };

  if (isLoadingApp) {
    return (
      <div className="p-3">
        <Loader message="Initializing Larry" />
      </div>
    );
  }

  return (
    <div className="p-3">
      <div className="mb-2 d-flex flex-justify-end">
        {!isReloading && (
          <RefreshCcwIcon
            className="refresh-extension"
            onClick={handleReloadExtension}
          />
        )}
        {isReloading && <RefreshCwIcon className="refresh-extension" />}
      </div>
      {isInWorktree ? <WorktreeScreen /> : <MainRepoScreen />}
    </div>
  );
}
