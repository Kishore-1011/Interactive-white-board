// --- Editing text ---

function selectAllText(element) {
    const range = document.createRange();
    range.selectNodeContents(element);
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
}

// Text boxes are edited directly; shapes are edited through the label inside them.
function editableElement(element) {
    return element.classList.contains('text-box') ? element : element.querySelector('.shape-text');
}

function startEditing(element) {
    const editable = editableElement(element);
    editingId = element.dataset.id;
    if (!selectedIds.includes(editingId)) {
        select([editingId]);
    }
    editable.contentEditable = 'true';
    editable.focus();
    selectAllText(editable);
    updateFrame();
}

// New text opens ready to type, with the placeholder selected so typing replaces it.
function beginTyping(id) {
    startEditing(elements.get(id));
}

// The topmost shape at this position, so an empty shape can be double-clicked anywhere inside.
function shapeAt(point) {
    return [...items].reverse().find((item) => {
        if (!canHoldText(item) || item.locked) {
            return false;
        }
        const box = itemBox(item);
        const local = rotatePoint(point, boxCentre(box), -item.rotation);
        return local.x >= box.x && local.x <= box.x + box.w && local.y >= box.y && local.y <= box.y + box.h;
    }) || null;
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
