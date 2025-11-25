import type { RequestContext } from "@codestrap/developer-foundations-types";
import { AsyncLocalStorage } from "node:async_hooks";

const als = new AsyncLocalStorage<RequestContext>();

// sandboxes requests so we can access tokens and user profiles sent form the client
export function withRequestContext<T>(ctx: RequestContext, fn: () => Promise<T> | T) {
    return als.run(ctx, fn);
}

export function getRequestContext(): RequestContext | undefined {
    return als.getStore();
}
