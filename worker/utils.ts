export function cleanJsonString(str: string): string {
  let inString = false;
  let escaped = false;
  let result = "";
  for (let i = 0; i < str.length; i++) {
    const char = str[i];
    if (char === '"' && !escaped) {
      inString = !inString;
    }
    if (inString && char === '\n') {
      result += '\\n';
    } else if (inString && char === '\r') {
      // ignore Carriage Return
    } else {
      result += char;
    }
    escaped = char === '\\' && !escaped;
  }
  return result;
}

export function extractJson(content: string | undefined | null) {
  if (!content) {
    throw new Error("Content is undefined or null")
  }
  
  // Extract content inside ```json ... ``` blocks if present
  let rawJson = content.trim();
  const jsonMatch = rawJson.match(/```json\s*([\s\S]*?)\s*```/)
  if (jsonMatch) {
    rawJson = jsonMatch[1];
  }

  // Clean raw control characters from string values
  const cleaned = cleanJsonString(rawJson);
  
  return JSON.parse(cleaned);
}
