/**
 * Robust clipboard copy that reports whether it ACTUALLY succeeded.
 *
 * Call this synchronously from the click/gesture handler (don't `await`
 * other work first): the preferred `navigator.clipboard.writeText` call
 * captures the browser's transient user activation at call time, so the
 * subsequent await is fine, but a fetch BEFORE it would lose activation
 * and throw NotAllowedError.
 *
 * Resolves true only when the text reached the clipboard — never
 * optimistically — so callers can show an honest success/failure.
 */
export async function copyTextToClipboard(text: string): Promise<boolean> {
    // Preferred path: async Clipboard API.
    try {
        if (navigator.clipboard?.writeText) {
            await navigator.clipboard.writeText(text);
            return true;
        }
    } catch {
        // Permission/focus problem — fall through to the legacy path.
    }

    // Legacy fallback: off-screen <textarea> + execCommand('copy').
    try {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.setAttribute('readonly', '');
        textarea.style.position = 'fixed';
        textarea.style.top = '0';
        textarea.style.left = '0';
        textarea.style.opacity = '0';

        const selection = document.getSelection();
        const savedRange =
            selection && selection.rangeCount > 0
                ? selection.getRangeAt(0)
                : null;

        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();
        const ok = document.execCommand('copy');
        document.body.removeChild(textarea);

        // Restore any selection we clobbered.
        if (selection && savedRange) {
            selection.removeAllRanges();
            selection.addRange(savedRange);
        }
        return ok;
    } catch {
        return false;
    }
}
