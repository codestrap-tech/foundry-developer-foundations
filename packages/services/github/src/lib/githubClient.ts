import { VersionControlService } from "@codestrap/developer-foundations-types";
import { checkinFile, getFile, getGithubAuth } from "./github";

export async function makeGithubClient(): Promise<VersionControlService> {
    // trigger auth for caching
    await getGithubAuth();

    return {
        getFile,
        checkinFile,
    };
}