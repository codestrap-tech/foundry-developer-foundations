export function sanitizeJSONString(input: string): string {
  // Replace double quotes with escaped double quotes
  let sanitized = input.replace(/"/g, '\\"');

  // Replace line feeds with escaped newline characters
  sanitized = sanitized.replace(/\n/g, '\\n');

  // Replace carriage returns (if any) with escaped characters
  sanitized = sanitized.replace(/\r/g, '\\r');

  return sanitized;
}
