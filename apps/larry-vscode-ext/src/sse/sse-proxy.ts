import * as http from 'http';
import * as https from 'https';
import type { SSEEvent } from '../types';

// ============================================================================
// SSE Proxy Class
// ============================================================================

/**
 * SSE (Server-Sent Events) Proxy with retry logic
 * Handles connection management, event parsing, and automatic reconnection
 */
export class SSEProxy {
  private req?: http.ClientRequest;
  private res?: http.IncomingMessage;
  private buffer = '';
  private retryCount = 0;
  private maxRetries = 10;
  private retryDelay = 2000; // 2 seconds
  private retryTimeout?: NodeJS.Timeout;
  private stopped = false;

  /**
   * Starts an SSE connection to the given URL
   *
   * @param url - The SSE endpoint URL
   * @param onEvent - Callback for received events
   * @param onError - Callback for errors (called after all retries exhausted)
   */
  start(
    url: string,
    onEvent: (evt: SSEEvent) => void,
    onError: (e: Error) => void,
  ): void {
    this.stopped = false;
    this.connect(url, onEvent, onError);
  }

  /**
   * Internal connection method with retry logic
   */
  private connect(
    url: string,
    onEvent: (evt: SSEEvent) => void,
    onError: (e: Error) => void,
  ): void {
    if (this.stopped) return;

    const lib = url.startsWith('https:') ? https : http;

    this.req = lib.request(
      url,
      { headers: { Accept: 'text/event-stream', 'Cache-Control': 'no-cache' } },
      (res) => {
        this.res = res;
        res.setEncoding('utf8');

        console.log('SSE connection established', url);
        // Reset retry count on successful connection
        this.retryCount = 0;

        res.on('data', (chunk: string) => {
          this.buffer += chunk;
          let idx: number;
          while ((idx = this.buffer.indexOf('\n\n')) >= 0) {
            const frame = this.buffer.slice(0, idx);
            this.buffer = this.buffer.slice(idx + 2);

            let eventName: string | undefined;
            const dataLines: string[] = [];
            for (const line of frame.split(/\r?\n/)) {
              if (!line || line.startsWith(':')) continue;
              if (line.startsWith('event:')) eventName = line.slice(6).trim();
              else if (line.startsWith('data:'))
                dataLines.push(line.slice(5).trim());
            }

            if (eventName) {
              // handle only named events
              console.log('Bypassing SSE event:', eventName);
              onEvent({ event: eventName, data: dataLines.join('\n') });
            }
          }
        });

        res.on('end', () =>
          this.handleError(new Error('SSE ended'), url, onEvent, onError),
        );
      },
    );

    this.req.on('error', (err) => this.handleError(err, url, onEvent, onError));
    this.req.end();
  }

  /**
   * Handles connection errors with retry logic
   */
  private handleError(
    error: Error,
    url: string,
    onEvent: (evt: SSEEvent) => void,
    onError: (e: Error) => void,
  ): void {
    if (this.stopped) return;

    console.log(
      `❌ SSE connection error (attempt ${this.retryCount + 1}/${
        this.maxRetries + 1
      }):`,
      error,
    );

    if (this.retryCount < this.maxRetries) {
      this.retryCount++;
      console.log(
        `🔄 Retrying SSE connection in ${this.retryDelay}ms... (${this.retryCount}/${this.maxRetries})`,
      );

      this.retryTimeout = setTimeout(() => {
        this.connect(url, onEvent, onError);
      }, this.retryDelay);
    } else {
      console.log(`❌ SSE connection failed after ${this.maxRetries} retries`);
      onError(error);
    }
  }

  /**
   * Stops the SSE connection and cleans up resources
   */
  stop(): void {
    this.stopped = true;
    this.retryCount = 0;

    if (this.retryTimeout) {
      clearTimeout(this.retryTimeout);
      this.retryTimeout = undefined;
    }

    try {
      this.req?.destroy();
    } catch {}
    try {
      this.res?.destroy();
    } catch {}
  }
}
