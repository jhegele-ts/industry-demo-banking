/**
 * Inserts text at the caret of whatever is focused, mimicking a paste. This is
 * what lets a saved hotkey work with any field in the app without that field
 * needing hotkey-specific wiring.
 *
 * It can only reach elements in this document. ThoughtSpot's embeds render in
 * a cross-origin iframe that no page script can write into — which is why the
 * caller also copies the phrase to the clipboard: click into the embed's own
 * field, press Cmd/Ctrl+V, and the text is already waiting.
 */
export function pasteIntoFocusedElement(text: string): void {
  const el = document.activeElement;

  if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
    if (el.disabled || el.readOnly) return;
    insertIntoFormField(el, text);
    return;
  }

  if (el instanceof HTMLElement && el.isContentEditable) {
    document.execCommand("insertText", false, text);
  }
}

// Per spec only these input types expose selectionStart/End — email, number
// and date don't support selection at all. For those the offsets below fall
// back to the end of the value (an append) and setSelectionRange is skipped
// rather than throwing.
const SELECTABLE = new Set(["text", "search", "url", "tel", "password"]);

function supportsSelection(el: HTMLInputElement | HTMLTextAreaElement) {
  return el instanceof HTMLTextAreaElement || SELECTABLE.has(el.type);
}

function insertIntoFormField(
  el: HTMLInputElement | HTMLTextAreaElement,
  text: string,
): void {
  const selectable = supportsSelection(el);
  const start = (selectable ? el.selectionStart : null) ?? el.value.length;
  const end = (selectable ? el.selectionEnd : null) ?? el.value.length;
  const next = el.value.slice(0, start) + text + el.value.slice(end);

  // A React-controlled field tracks its value through the prototype's native
  // setter, not the instance — assigning el.value directly goes unnoticed.
  // Calling the native setter then dispatching a real "input" event is the
  // standard way to make a controlled field pick up an outside change.
  const proto =
    el instanceof HTMLTextAreaElement
      ? window.HTMLTextAreaElement.prototype
      : window.HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto, "value")?.set?.call(el, next);
  el.dispatchEvent(new Event("input", { bubbles: true }));

  if (selectable) {
    const caret = start + text.length;
    el.setSelectionRange(caret, caret);
  }
}
