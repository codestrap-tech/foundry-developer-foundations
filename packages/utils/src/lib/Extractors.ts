export function extractJsonFromBackticks(text: string): string {
  text = cleanJsonString(text);

  const open = text.indexOf("```");
  if (open === -1) {
    return text;
  }

  const close = text.indexOf("```", open + 3);
  if (close === -1 || close <= open + 2) {
    throw new Error("No valid closing fence (```) found after opening fence");
  }

  // earliest of '{' or '[' after the opening fence
  const a = text.indexOf("{", open + 3);
  const b = text.indexOf("[", open + 3);
  const jsonStart = (a >= 0 && (b < 0 || a < b)) ? a : b;

  if (jsonStart === -1 || jsonStart >= close) {
    throw new Error("JSON must start with either { or [ after the opening fence (```) and before the closing fence");
  }

  const extractedJSONClean = text.substring(jsonStart, close);

  return extractedJSONClean;
}

export function extractHtmlFromBackticks(text: string): string {
  const regex = /```(?:html)?\s*([\s\S]+?)```/;
  const match = text.match(regex);
  return match ? match[1].trim() : text;
}

export function cleanJsonString(src: string): string {
  let s = src.trim();

  // 1) Remove BOM & zero-width chars
  s = s.replace(/^\uFEFF/, "").replace(/[\u200B-\u200D\u2060\uFEFF]/g, "");

  // 2) Normalize curly/smart quotes
  s = s.replace(/[“”]/g, '"').replace(/[‘’]/g, "'");

  // 3) Strip // and /* */ comments (note: this is not string-aware)
  // eslint-disable-next-line regexp/no-unused-capturing-group
  s = s.replace(/(^|\s)\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "");

  // 4) Remove trailing commas before } or ]
  s = s.replace(/,\s*(?=[}\]])/g, "");

  // 5) Collapse backslashes before non-escape chars (keep valid escapes)
  s = s.replace(/\\(?!["\\/bfnrtu])/g, "");

  // 6) Neutralize inner ``` sequences INSIDE strings so they don't look like fences.
  //    Replace runs of >=3 backticks with \u0060\u0060\u0060 (still renders as ``` when parsed).
  {
    let out = "";
    let inStr = false;
    let esc = false;
    for (let i = 0; i < s.length; i++) {
      const ch = s[i];

      if (inStr) {
        if (esc) {
          out += "\\" + ch;      // preserve the escape as written
          esc = false;
          continue;
        }
        if (ch === "\\") {
          esc = true;
          continue;
        }
        if (ch === "`") {
          // count run of backticks
          let j = i;
          while (j < s.length && s[j] === "`") j++;
          const run = j - i;
          if (run >= 3) {
            // emit same count as \u0060
            for (let k = 0; k < run; k++) out += "\\u0060";
            i = j - 1;
            continue;
          }
          // single or double backtick in string: keep as-is
          out += ch;
          continue;
        }
        out += ch;
        if (ch === '"') inStr = false;
        continue;
      }

      // not in string
      out += ch;
      if (ch === '"') inStr = true;
    }
    s = out;
  }

  // 7) Trim again
  return s.trim();
}

