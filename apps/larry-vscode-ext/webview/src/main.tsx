/* jsx preact */
/* @jsxImportSource preact */
import { render } from 'preact';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AppRoot } from './views/AppRoot';
import { BootChannel } from './views/BootChannel';
import { LarryStateSync } from './views/LarryStateSync';
import { queryClient } from './lib/query';
import { ExtensionStoreProvider } from './store/store';

// eslint-disable-next-line react-refresh/only-export-components
function Root() {
  const content = (
    <ExtensionStoreProvider>
      <BootChannel />
      <LarryStateSync />
      <AppRoot />
    </ExtensionStoreProvider>
  ) as any;
  return (
    <QueryClientProvider client={queryClient}>{content}</QueryClientProvider>
  );
}

render(<Root />, document.getElementById('root')!);
