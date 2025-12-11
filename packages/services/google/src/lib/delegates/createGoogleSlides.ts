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
 * - slides?: slides_v1.Slides (authenticated)
 *
 * Behavior (v3):
 *  - For each item in the input array, create ONE presentation.
 *  - The provided template is assumed to be a single-slide template.
 *  - item.content is now an array of GoogleSlide:
 *      {
 *        slideNumber: number;
 *        content: GoogleSlideContentItem[];
 *      }
 *  - For each GoogleSlide in item.content (ordered by slideNumber):
 *      - For the first slide:
 *          - Use the template’s first slide (basePageId).
 *          - Apply all its GoogleSlideContentItem placeholders to that page.
 *      - For each subsequent slide:
 *          - Duplicate the base slide into a new page.
 *          - Apply that slide’s content items to the new page.
 *
 * Implementation notes:
 *  - Uses placeholders (targetType === "PLACEHOLDER") with page-scoped
 *    ReplaceAllTextRequest via `pageObjectIds`.
 *  - OBJECT_ID targeting is not supported for per-slide duplication;
 *    such items will trigger a validation error.
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

  // For this “repeat base slide” behavior, we *only* support PLACEHOLDER
  // because objectIds change when slides are duplicated.
  if (item.targetType === "OBJECT_ID") {
    return "targetType OBJECT_ID is not supported when duplicating template slides; use PLACEHOLDER instead";
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

  if (!slides) {
    // We absolutely require Slides API access.
    return {
      successes: [],
      failures: input.map((item, index) => ({
        inputIndex: index,
        templateId: item.templateId,
        errorCode: "CONFIG_ERROR",
        errorMessage:
          "Slides client not available; createGoogleSlidesDelegate requires an authenticated Slides client.",
      })),
    };
  }

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

    // validate nested content items (per GoogleSlide)
    const invalid: {
      slideIdx: number;
      itemIdx: number;
      err: string;
    }[] = [];

    item.content.forEach((slide, slideIdx) => {
      slide.content.forEach((ci, itemIdx) => {
        const err = validateContentItem(ci);
        if (err) {
          invalid.push({ slideIdx, itemIdx, err });
        }
      });
    });

    if (invalid.length > 0) {
      failures.push({
        inputIndex: index,
        templateId: normalized,
        errorCode: "VALIDATION_ERROR",
        errorMessage: `Invalid content items: ${invalid
          .map(
            (x) =>
              `slide:${x.slideIdx} index:${x.itemIdx} -> ${x.err}`
          )
          .join("; ")}`,
      });
      return;
    }

    // determine name for copy
    let targetName = item.name;

    try {
      // 1) Copy the template presentation
      const copyRes = await drive.files.copy({
        fileId: normalized,
        requestBody: { name: targetName },
        fields: "id,name",
        supportsAllDrives: true, //required for shared drive files
      });

      const file = copyRes.data;
      const presentationId = file.id!;
      const slidesClient = slides;

      // 🔽 NEW: ensure org-wide access on the copy
      await drive.permissions.create({
        fileId: presentationId,
        requestBody: {
          type: 'domain',
          role: 'writer',              // or 'reader' if you prefer
          domain: 'codestrap.me',      // or pull from env if you want
          allowFileDiscovery: false,   // “with the link” semantics
        },
        supportsAllDrives: true,
      });

      // If name omitted, fetch original template name to generate default
      if (!targetName) {
        const templateMeta = await drive.files.get({
          fileId: normalized,
          fields: "name",
          supportsAllDrives: true, //required for shared drive files
        });
        const templateName = templateMeta.data.name || "Template";
        targetName = formatDefaultName(templateName);
        // update copied file name
        await drive.files.update({
          fileId: presentationId,
          requestBody: { name: targetName },
          supportsAllDrives: true, //required for shared drive files
        });
      }

      // 2) Load the copied presentation and get the first slide’s pageObjectId
      const pres = await slidesClient.presentations.get({
        presentationId,
      });

      const pages = pres.data.slides;
      if (!pages || pages.length === 0 || !pages[0].objectId) {
        failures.push({
          inputIndex: index,
          templateId: normalized,
          errorCode: "TEMPLATE_ERROR",
          errorMessage:
            "Template presentation has no slides or first slide is missing an objectId.",
        });
        return;
      }

      const basePageId = pages[0].objectId;

      // 3) Build batchUpdate requests:
      //    item.content is GoogleSlide[]
      //    - respect slideNumber if provided, otherwise fall back to JSON order
      const orderedSlides = [...item.content]
        .map((slide, index) => ({
          ...slide,
          sortKey: typeof slide.slideNumber === 'number' ? slide.slideNumber : index,
        }))
        .sort((a, b) => a.sortKey - b.sortKey); // ASC: s1, s2, s3...

      const duplicateRequests: slides_v1.Schema$Request[] = [];
      const replaceRequests: slides_v1.Schema$Request[] = [];

      orderedSlides.forEach((slide, slideIdx) => {
        let targetPageId: string;

        if (slideIdx === 0) {
          // First logical slide uses the original base slide
          targetPageId = basePageId;
        } else {
          // For each additional logical slide, create a new page
          const newPageId = `${basePageId}_${slideIdx}`;

          // IMPORTANT: unshift so duplicates execute in reverse order
          // (last slide duplicated first) to preserve visual ordering.
          duplicateRequests.unshift({
            duplicateObject: {
              objectId: basePageId,
              objectIds: {
                [basePageId]: newPageId,
              },
            },
          } as slides_v1.Schema$Request);

          targetPageId = newPageId;
        }

        // Apply all content items for this logical slide to its target page
        slide.content.forEach((ci) => {
          if (ci.targetType === 'PLACEHOLDER') {
            replaceRequests.push({
              replaceAllText: {
                containsText: {
                  text: ci.placeholder || '',
                  matchCase: true,
                },
                replaceText: ci.text,
                pageObjectIds: [targetPageId],
              },
            } as slides_v1.Schema$Request);
          }
        });
      });

      const requests: slides_v1.Schema$Request[] = [
        ...duplicateRequests,
        ...replaceRequests,
      ];

      if (requests.length > 0) {
        try {
          await slidesClient.presentations.batchUpdate({
            presentationId,
            requestBody: { requests },
          });
        } catch (err: any) {
          const msg = err?.message || String(err);
          failures.push({
            inputIndex: index,
            templateId: normalized,
            errorCode: err?.code ? String(err.code) : 'SLIDES_API_ERROR',
            errorMessage: `Error applying slide content: ${msg}`,
            details: err?.response?.data || undefined,
          });
          return;
        }
      }

      // 5) Fetch final file metadata
      const meta = await drive.files.get({
        fileId: presentationId,
        fields: "id,name,webViewLink,webContentLink",
        supportsAllDrives: true, //required for shared drive files
      });

      successes.push({
        inputIndex: index,
        templateId: normalized,
        presentationId,
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

  await Promise.all(tasks.map((fn) => fn()));

  return { successes, failures };
}

export default createGoogleSlidesDelegate;
