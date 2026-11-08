// --- Editing text ---

function selectAllText(element) {
    const range = document.createRange();
    range.selectNodeContents(element);
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
}

function startEditing(element) {
    editingId = element.dataset.id;
    element.contentEditable = 'true';
    element.focus();
    selectAllText(element);
    updateFrame();
}

function finishEditing() {
    if (editingId && document.activeElement) {
        document.activeElement.blur();
    }
}

function registerTap(element, time) {
    const id = element.dataset.id;
    if (lastTap && lastTap.id === id && time - lastTap.time < DOUBLE_TAP_MS) {
        lastTap = null;
        startEditing(element);
    } else {
        lastTap = { id, time };
    }
}

function fontSizeLimits() {
    return { min: Number(fontSizeInput.min), max: Number(fontSizeInput.max) };
}

function stepFontSize(delta) {
    const { min, max } = fontSizeLimits();
    const size = Math.min(max, Math.max(min, Number(fontSizeInput.value) + delta));
    fontSizeInput.value = size;
    setFontSize(size);
    commit();
}
