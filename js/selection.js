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
    const text = selected.find(isText);
    const drawing = selected.find((item) => !isText(item));
    if (text) {
        fontSizeInput.value = Math.round(text.fontSize);
    }
    if (drawing) {
        brushSizeInput.value = drawing.strokeWidth;
        brushValue.textContent = drawing.strokeWidth;
    }
    if (selected.length > 0) {
        colorInput.value = selected[0].color;
    }
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
}

function addTextBox() {
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
        fontSize: Number(fontSizeInput.value),
        color: colorInput.value,
        rotation: 0,
        locked: false,
        groupId: null,
    };
    items.push(item);
    selectedIds = [item.id];
    commit();
}

function deleteSelected() {
    if (selectedIds.length === 0 || selectionLocked()) {
        return;
    }
    items = items.filter((item) => !selectedIds.includes(item.id));
    selectedIds = [];
    commit();
}

function clearBoard() {
    items = [];
    selectedIds = [];
    commit();
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
        if (isText(item)) {
            item.fontSize = size;
        }
    });
}

function setStrokeWidth(width) {
    updateSelected((item) => {
        if (!isText(item)) {
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
function insertCopies(source, offset) {
    const groupMap = new Map();
    const copies = clone(source).map((item) => {
        if (item.groupId !== null) {
            if (!groupMap.has(item.groupId)) {
                groupMap.set(item.groupId, 'g' + newId());
            }
            item.groupId = groupMap.get(item.groupId);
        }
        item.id = newId();
        moveItem(item, clone(item), offset, offset);
        return item;
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
    }
}

function cutSelection() {
    if (!selectionLocked()) {
        copySelection();
        deleteSelected();
    }
}

function paste() {
    if (clipboard.length > 0) {
        pasteCount++;
        setTool('select');
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
