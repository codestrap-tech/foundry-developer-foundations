import { existsSync } from "fs";
import { resolve } from "path";

export function findWorkspaceRoot(startPath: string): string {
    let currentPath = startPath;
    while (currentPath !== '/') {
        if (existsSync(resolve(currentPath, 'larry.config.json'))) {
            return currentPath;
        }
        currentPath = resolve(currentPath, '..');
    }
    throw new Error('Could not find workspace root');
}