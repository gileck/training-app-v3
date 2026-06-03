/**
 * Read a browser `File` as base64. Strips the `data:<mime>;base64,`
 * prefix so the resulting string is JSON-friendly for transport to a
 * server API (e.g. the agent's `uploadAttachment`).
 *
 * Throws if the reader fails or returns a non-string result.
 */
export function fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            const result = reader.result;
            if (typeof result !== 'string') {
                reject(new Error('FileReader returned non-string result'));
                return;
            }
            // `result` is `data:<mime>;base64,<payload>` — strip prefix.
            const commaIdx = result.indexOf(',');
            resolve(commaIdx >= 0 ? result.slice(commaIdx + 1) : result);
        };
        reader.onerror = () =>
            reject(reader.error ?? new Error('Failed to read file'));
        reader.readAsDataURL(file);
    });
}
