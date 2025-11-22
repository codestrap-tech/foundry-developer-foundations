export function generateMarkdownTable(jsonData: Record<string, any>[]) {
  if (!jsonData.length) return '';

  // Extract headers from the first object
  const headers = Object.keys(jsonData[0]);

  // Generate header row
  let markdownTable = `| ${headers.join(' | ')} |\n`;
  markdownTable += `| ${headers.map(() => '---').join(' | ')} |\n`;

  // Generate data rows
  for (const row of jsonData) {
    const values = headers.map((header) => row[header]);
    markdownTable += `| ${values.join(' | ')} |\n`;
  }

  return markdownTable;
}
