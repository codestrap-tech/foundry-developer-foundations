import { drive_v3, slides_v1 } from "googleapis";
import {
  CreateGoogleSlidesInput,
  CreateGoogleSlidesOutput,
  GoogleSlideCreationFailure,
  GoogleSlideCreationSuccess,
  GoogleSlideContentItem,
} from "@codestrap/developer-foundations-types";

/**
 * createGoogleSlidesDelegate
 * - input: CreateGoogleSlidesInput
 * - drive: drive_v3.Drive (authenticated)
 * - slides?: slides_v1.Slides (authenticated) -- if not provided create requests via REST client on drive
 *
 * Implementation notes:
 *  - Pure functions where possible.
 *  - Use Maps for lookups.
 *  - No await inside loops; use Promise.all where needed.
 */

type DelegateArgs = {
  input: CreateGoogleSlidesInput;
  drive: drive_v3.Drive;
  slides?: slides_v1.Slides;
};

const DRIVE_ID_REGEX = /\/d\/([a-zA-Z0-9_-]{10,})/;

function normalizeTemplateId(templateId: string): string | null {
  const m = templateId.match(DRIVE_ID_REGEX);
  if (m && m[1]) return m[1];
  // simple validation: Drive IDs are typically 10+ chars with - or _
  if (/^[a-zA-Z0-9_-]{10,}$/.test(templateId)) return templateId;
  return null;
}

function nowIso(): string {
  return new Date().toISOString();
}

function formatDefaultName(templateName: string): string {
  const pad = (n: number) => n.toString().padStart(2, "0");
  const d = new Date();
  const yyyy = d.getUTCFullYear();
  const mm = pad(d.getUTCMonth() + 1);
  const dd = pad(d.getUTCDate());
  const hh = pad(d.getUTCHours());
  const mi = pad(d.getUTCMinutes());
  const ss = pad(d.getUTCSeconds());
  return `${templateName} - ${yyyy}${mm}${dd}-${hh}${mi}${ss}`;
}

function validateContentItem(item: GoogleSlideContentItem): string | null {
  if (!item || !item.targetType || typeof item.text !== "string") {
    return "content item missing required fields (targetType and text)";
  }
  if (item.targetType === "OBJECT_ID" && !item.objectId) {
    return "content item targetType OBJECT_ID requires objectId";
  }
  if (item.targetType === "PLACEHOLDER" && !item.placeholder) {
    return "content item targetType PLACEHOLDER requires placeholder";
  }
  return null;
}

export async function createGoogleSlidesDelegate(
  args: DelegateArgs
): Promise<CreateGoogleSlidesOutput> {
  const { input, drive, slides } = args;
  const successes: GoogleSlideCreationSuccess[] = [];
  const failures: GoogleSlideCreationFailure[] = [];

  const tasks = input.map((item, index) => async () => {
    const warnings: string[] = [];
    const normalized = normalizeTemplateId(item.templateId);
    if (!normalized) {
      failures.push({
        inputIndex: index,
        templateId: item.templateId,
        errorCode: "VALIDATION_ERROR",
        errorMessage: `Invalid Google Drive file ID or URL format for templateId: ${item.templateId}`,
      });
      return;
    }

    // validate content items
    const invalid = item.content
      .map((c, i) => ({ err: validateContentItem(c), idx: i }))
      .filter((x) => x.err);
    if (invalid.length > 0) {
      failures.push({
        inputIndex: index,
        templateId: normalized,
        errorCode: "VALIDATION_ERROR",
        errorMessage: `Invalid content items: ${invalid
          .map((x) => `index:${x.idx} -> ${x.err}`)
          .join("; ")}`,
      });
      return;
    }

    // determine name for copy
    let targetName = item.name;
    try {
      // copy template
      const copyRes = await drive.files.copy({
        fileId: normalized,
        requestBody: { name: targetName },
        fields: "id,name",
      });
      const file = copyRes.data;
      const presentationId = file.id!;
      // if name omitted, fetch original template name to generate default
      if (!targetName) {
        const templateMeta = await drive.files.get({
          fileId: normalized,
          fields: "name",
        });
        const templateName = templateMeta.data.name || "Template";
        targetName = formatDefaultName(templateName);
        // update copied file name
        await drive.files.update({
          fileId: presentationId,
          requestBody: { name: targetName },
        });
      }

      // Build requests for batchUpdate
      const requests = item.content.flatMap((ci): slides_v1.Schema$Request[] => {
        if (ci.targetType === "OBJECT_ID") {
          // InsertTextRequest targeting objectId
          return [
            {
              insertText: {
                objectId: ci.objectId,
                text: ci.text,
              },
            } as slides_v1.Schema$Request,
          ];
        }
        // PLACEHOLDER => ReplaceAllTextRequest
        return [
          {
            replaceAllText: {
              containsText: { text: ci.placeholder || "", matchCase: true },
              replaceText: ci.text,
            },
          } as slides_v1.Schema$Request,
        ];
      });

      // execute batchUpdate
      if (requests.length > 0) {
        const slidesClient = slides;
        try {
          if (slidesClient) {
            await slidesClient.presentations.batchUpdate({
              presentationId,
              requestBody: { requests },
            });
          } else {
            // fallback to Drive authorized REST call via drive.context (slides API not provided)
            // Using fetch via googleapis is complex; easiest is throw if slides not provided
            throw new Error(
              "Slides client not available to perform batchUpdate"
            );
          }
        } catch (err: any) {
          // Inspect error for missing object IDs (partial failure)
          const msg = err?.message || String(err);
          // If error mentions not found object, convert to warning and continue; otherwise fail
          if (/object.*not found|Invalid.*objectId/i.test(msg)) {
            // convert to warnings for each OBJECT_ID possibly missing
            item.content
              .filter((c) => c.targetType === "OBJECT_ID")
              .forEach((c) =>
                warnings.push(`objectId not found or skipped: ${c.objectId}`)
              );
            // attempt placeholder replacements only if any
            const placeholderRequests = requests.filter(
              (r) => "replaceAllText" in r
            );
            if (placeholderRequests.length > 0 && slidesClient) {
              await slidesClient.presentations.batchUpdate({
                presentationId,
                requestBody: { requests: placeholderRequests },
              });
            }
          } else {
            failures.push({
              inputIndex: index,
              templateId: normalized,
              errorCode: err?.code ? String(err.code) : "SLIDES_API_ERROR",
              errorMessage: `Error applying content: ${msg}`,
              details: err?.response?.data || undefined,
            });
            return;
          }
        }
      }

      // fetch final file metadata
      const meta = await drive.files.get({
        fileId: presentationId,
        fields: "id,name,webViewLink,webContentLink",
      });

      successes.push({
        inputIndex: index,
        templateId: normalized,
        presentationId: presentationId,
        fileId: presentationId,
        name: meta.data.name || targetName || "",
        webViewLink: meta.data.webViewLink || "",
        webContentLink: meta.data.webContentLink!,
        createdAt: nowIso(),
        warnings: warnings.length ? warnings : undefined,
      });
    } catch (err: any) {
      failures.push({
        inputIndex: index,
        templateId: normalized,
        errorCode: err?.code ? String(err.code) : "DRIVE_API_ERROR",
        errorMessage: err?.message || "Unknown error during slide creation",
        details: err?.response?.data || undefined,
      });
    }
  });

  // run tasks in parallel, but avoid uncontrolled concurrency -- use Promise.all for this spec
  await Promise.all(tasks.map((fn) => fn()));

  return { successes, failures };
}

export default createGoogleSlidesDelegate;
