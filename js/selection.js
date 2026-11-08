// --- Selection and actions ---

// Selecting any member of a group selects the whole group.
function expandGroups(ids) {
    const groupIds = new Set(items
        .filter((item) => ids.includes(item.id) && item.groupId !== null)
        .map((item) => item.groupId));
    return items
        .filter((item) => ids.includes(item.id) || groupIds.has(item.groupId))
        .map((item) => item.id);
}

// Selecting also shows the selection's size and colour in the controls.
function syncControls() {
    const selected = selectedItems();
    const text = selected.find(isStyledText);
    const drawing = selected.find(isDrawing);
    const labelled = selected.find((item) => canHoldText(item) && item.text);
    if (labelled) {
        textColorInput.value = labelled.textColor;
    }
    const coloured = selected.find((item) => !isImage(item));
    if (text) {
        fontSizeInput.value = Math.round(text.fontSize);
        updateTextStyleButtons(text);
    }
    if (drawing) {
        brushSizeInput.value = drawing.strokeWidth;
        brushValue.textContent = drawing.strokeWidth;
    }
    if (coloured) {
        colorInput.value = coloured.color;
    }
    if (selected.length > 0) {
        const percent = Math.round(selected[0].opacity * 100);
        opacityInput.value = percent;
        opacityValue.textContent = `${percent}%`;
    }
    updateSwatches();
}

function select(ids) {
    selectedIds = expandGroups(ids);
    syncControls();
    updateSelectionStyles();
    updateButtons();
}

function setTool(name) {
    tool = name;
    if (name !== 'select') {
        select([]);
    }
    board.classList.toggle('drawing', name !== 'select');
    board.classList.toggle('hand-tool', name === 'hand');
    toolButtons.forEach((button) => {
        const isActive = button.dataset.tool === name;
        button.classList.toggle('active', isActive);
        button.setAttribute('aria-pressed', String(isActive));
    });
    updateContextBar();
    updateEmptyState();
    updateMoreToolsButton();
    setRailExpanded(false);
}

function addTextItem(overrides) {
    setTool('select');
    const offset = CASCADE_START + (cascade++ % CASCADE_LENGTH) * CASCADE_STEP;
    const position = screenToBoard({ x: offset, y: offset }); // Always lands where you're looking.
    const item = {
        id: newId(),
        type: 'text',
        text: 'New Text',
        x: round(position.x),
        y: round(position.y),
        width: null,
        height: null,
        fontSize: Number(fontSizeInput.value),
        fontFamily: 'sans',
        bold: false,
        align: 'left',
        color: colorInput.value,
        fill: null,
        note: false,
        opacity: 1,
        rotation: 0,
        locked: false,
        groupId: null,
        ...overrides,
    };
    items.push(item);
    selectedIds = [item.id];
    commit();
    syncControls();
    beginTyping(item.id);
}

function addTextBox(position = {}) {
    addTextItem(position);
}

function addNote(position = {}) {
    addTextItem({
        text: 'New note',
        width: NOTE_SIZE,
        height: NOTE_SIZE,
        fontSize: 20,
        color: NOTE_TEXT_COLOR,
        fill: NOTE_FILL,
        note: true,
        ...position,
    });
}

function removeSelected() {
    items = items.filter((item) => !selectedIds.includes(item.id));
    selectedIds = [];
    commit();
}

function deleteSelected() {
    if (selectedIds.length === 0 || selectionLocked()) {
        return;
    }
    const count = selectedIds.length;
    removeSelected();
    showToast(count === 1 ? 'Deleted.' : `Deleted ${count} objects.`, true);
}

function clearBoard() {
    if (items.length === 0) {
        return;
    }
    items = [];
    selectedIds = [];
    commit();
    showToast('Board cleared.', true);
}

// Apply a style to every selected item it suits, leaving locked selections alone.
function updateSelected(apply) {
    if (!selectionLocked()) {
        selectedItems().forEach(apply);
        render();
    }
}

function setFontSize(size) {
    updateSelected((item) => {
        if (isStyledText(item)) {
            item.fontSize = size;
        }
    });
}

function setStrokeWidth(width) {
    updateSelected((item) => {
        if (isDrawing(item)) {
            item.strokeWidth = width;
        }
    });
}

function reorderSelection(reorder) {
    if (selectedIds.length === 0 || selectionLocked()) {
        return;
    }
    items = reorder(
        items.filter((item) => selectedIds.includes(item.id)),
        items.filter((item) => !selectedIds.includes(item.id))
    );
    commit();
}

function bringToFront() {
    reorderSelection((selected, others) => [...others, ...selected]);
}

function sendToBack() {
    reorderSelection((selected, others) => [...selected, ...others]);
}

// Move each selected item past the neighbour next to it, leaving the rest in order.
function stepLayer(direction) {
    if (selectedIds.length === 0 || selectionLocked()) {
        return;
    }
    const next = [...items];
    const order = direction > 0 ? next.map((_, i) => next.length - 1 - i) : next.map((_, i) => i);
    order.forEach((index) => {
        const target = index + direction;
        if (selectedIds.includes(next[index].id) && next[target] && !selectedIds.includes(next[target].id)) {
            [next[index], next[target]] = [next[target], next[index]];
        }
    });
    items = next;
    commit();
}

function toggleGroup() {
    if (selectedIds.length < 2 || selectionLocked()) {
        return;
    }
    const groupId = isGroupedSelection() ? null : 'g' + newId();
    selectedItems().forEach((item) => {
        item.groupId = groupId;
    });
    commit();
}

function ungroup() {
    if (isGroupedSelection()) {
        toggleGroup();
    }
}

function toggleLock() {
    const locked = !selectionLocked();
    selectedItems().forEach((item) => {
        item.locked = locked;
    });
    commit();
}

// Add copies of these items, offset so they're visible, and select them.
function insertCopies(source, offsetX, offsetY = offsetX) {
    const groupMap = new Map();
    const idMap = new Map();
    const copies = clone(source).map((item) => {
        if (item.groupId !== null) {
            if (!groupMap.has(item.groupId)) {
                groupMap.set(item.groupId, 'g' + newId());
            }
            item.groupId = groupMap.get(item.groupId);
        }
        const copyId = newId();
        idMap.set(item.id, copyId);
        item.id = copyId;
        moveItem(item, clone(item), offsetX, offsetY);
        return item;
    });
    // A copied arrow stays attached only to objects that were copied along with it.
    copies.filter((item) => item.type === 'arrow').forEach((arrow) => {
        arrow.startId = idMap.get(arrow.startId) || null;
        arrow.endId = idMap.get(arrow.endId) || null;
    });
    items.push(...copies);
    selectedIds = copies.map((item) => item.id);
    render();
    syncControls();
    commit();
}

function copySelection() {
    if (selectedIds.length > 0) {
        clipboard = clone(selectedItems());
        pasteCount = 0;
        // Replaces any picture on the system clipboard, so the next paste is what was just copied.
        if (navigator.clipboard) {
            navigator.clipboard.writeText(CLIPBOARD_MARKER).catch(() => {});
        }
    }
}

function cutSelection() {
    if (!selectionLocked()) {
        copySelection();
        removeSelected();
    }
}

// Pastes beside the original, or centred on `point` when one is given.
function paste(point) {
    if (clipboard.length === 0) {
        return;
    }
    setTool('select');
    if (point) {
        const centre = boxCentre(pointsBox(clipboard.flatMap((item) => (isDrawing(item)
            ? item.points
            : [{ x: item.x, y: item.y }]))));
        insertCopies(clipboard, round(point.x - centre.x), round(point.y - centre.y));
    } else {
        pasteCount++;
        insertCopies(clipboard, PASTE_OFFSET * pasteCount);
    }
}

function duplicateSelection() {
    if (selectedIds.length > 0 && !selectionLocked()) {
        insertCopies(selectedItems(), PASTE_OFFSET);
    }
}

function selectAll() {
    setTool('select');
    select(items.filter((item) => !item.locked).map((item) => item.id));
}
