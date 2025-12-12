import { Marked } from 'marked';
import { markedHighlight } from 'marked-highlight';
import hljs from 'highlight.js';
import DOMPurify from 'dompurify';

export function useMarkdown() {
  return (content: string, codeFormattingEnabled?: boolean) => {
    if (codeFormattingEnabled) {
      const markedInstance = new Marked(
        markedHighlight({
          langPrefix: 'hljs language-',
          highlight(code, lang) {
            const normalized = (lang || '').toLowerCase();
            const language =
              normalized === 'ts'
                ? 'typescript'
                : normalized === 'tsx'
                  ? 'typescript'
                  : normalized === 'js'
                    ? 'javascript'
                    : normalized === 'jsx'
                      ? 'javascript'
                      : normalized;

            try {
              if (language && hljs.getLanguage(language)) {
                return hljs.highlight(code, { language }).value;
              }
            } catch {
              // fall through to auto
            }
            return hljs.highlightAuto(code, ['typescript', 'javascript']).value;
          },
        }),
      );
      markedInstance.setOptions({
        breaks: true,
        gfm: true,
      });

      const html = markedInstance.parse(content) as string;
      return DOMPurify.sanitize(html);
    }

    const markedInstance = new Marked();
    markedInstance.setOptions({
      breaks: true,
      gfm: true,
    });
    const html = markedInstance.parse(content) as string;

    const decodedHtml = html
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'");
    return DOMPurify.sanitize(decodedHtml);
  };
}
