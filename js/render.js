// --- Drawing the page ---

function createItemElement(item) {
    const element = document.createElement('div');
    element.dataset.id = item.id;
    if (isText(item)) {
        element.className = 'item text-box';
        element.contentEditable = 'false';
        return element;
    }
    if (isImage(item)) {
        element.className = 'item item-image';
        const image = document.createElement('img');
        image.alt = '';
        image.draggable = false;
        element.appendChild(image);
        return element;
    }
    element.className = 'item item-drawing';
    const svg = document.createElementNS(SVG_NAMESPACE, 'svg');
    svg.setAttribute('aria-hidden', 'true');
    const group = document.createElementNS(SVG_NAMESPACE, 'g');
    ['ink', 'hit'].forEach((name) => {
        const path = document.createElementNS(SVG_NAMESPACE, 'path');
        path.setAttribute('class', name);
        group.appendChild(path);
    });
    svg.appendChild(group);
    element.appendChild(svg);
    return element;
}

function renderItem(item) {
    const element = elements.get(item.id);
    element.classList.toggle('locked', item.locked);
    element.style.opacity = item.opacity < 1 ? item.opacity : '';

    if (isText(item)) {
        if (item.id !== editingId && element.innerText !== item.text) {
            element.innerText = item.text;
        }
        element.style.fontSize = item.fontSize + 'px';
        element.style.color = item.color;
        element.style.fontFamily = FONTS[item.fontFamily];
        element.style.fontWeight = item.bold ? '700' : '';
        element.style.textAlign = item.align;
        element.style.background = item.fill || '';
        element.style.height = item.height === null ? '' : item.height + 'px';
        element.classList.toggle('note', item.note);
        element.style.width = item.width === null ? '' : item.width + 'px';
        element.style.maxWidth = item.width === null ? MAX_TEXT_WIDTH + 'px' : '';
        element.style.left = item.x + 'px';
        element.style.top = item.y + 'px';
    } else if (isImage(item)) {
        const image = element.firstChild;
        const source = assets.get(item.assetId) || '';
        if (image.getAttribute('src') !== source) {
            image.setAttribute('src', source);
        }
        element.style.left = item.x + 'px';
        element.style.top = item.y + 'px';
        element.style.width = item.w + 'px';
        element.style.height = item.h + 'px';
    } else {
        const box = pointsBox(item.points);
        const data = pathData(item);
        const [ink, hit] = element.querySelectorAll('path');
        ink.style.fill = item.fill || 'none';
        element.classList.toggle('filled', Boolean(item.fill));
        element.querySelector('g').setAttribute('transform', `translate(${-box.x} ${-box.y})`);
        ink.setAttribute('d', data);
        ink.setAttribute('stroke', item.color);
        ink.setAttribute('stroke-width', item.strokeWidth);
        hit.setAttribute('d', data);
        hit.setAttribute('stroke-width', item.strokeWidth + HIT_PADDING / camera.zoom);
        element.style.left = box.x + 'px';
        element.style.top = box.y + 'px';
        element.style.width = box.w + 'px';
        element.style.height = box.h + 'px';
    }
    element.style.transform = item.rotation ? `rotate(${item.rotation}deg)` : '';
}

// Existing elements are reused so a redraw never interrupts a drag or an edit in progress.
function render() {
    const stale = new Map(elements);
    items.forEach((item, index) => {
        let element = elements.get(item.id);
        if (!element) {
            element = createItemElement(item);
            elements.set(item.id, element);
        }
        stale.delete(item.id);
        if (itemLayer.children[index] !== element) {
            itemLayer.insertBefore(element, itemLayer.children[index] || null);
        }
        renderItem(item);
    });
    refreshArrows();
    stale.forEach((element, id) => {
        element.remove();
        elements.delete(id);
    });
    updateSelectionStyles();
}

function currentFrame() {
    const selected = selectedItems();
    if (selected.length === 0 || editingId) {
        return null;
    }
    if (selected.length === 1) {
        return { ...itemBox(selected[0]), rotation: selected[0].rotation };
    }
    if (gesture && gesture.kind === 'rotate') {
        return { ...gesture.frame, rotation: gesture.delta };
    }
    return { ...boundsOfItems(selected), rotation: 0 };
}

function frameMode() {
    const selected = selectedItems();
    if (selectionLocked()) {
        return 'locked';
    }
    if (selected.length > 1) {
        return 'uniform';
    }
    const [item] = selected;
    if (isImage(item)) {
        return 'uniform';
    }
    return isText(item) && !item.note ? 'text' : 'free';
}

function updateFrame() {
    const frame = currentFrame();
    selectionFrameElement.hidden = !frame;
    if (!frame) {
        return;
    }
    // The frame is drawn in screen space so the handles stay the same size at any zoom.
    const corner = boardToScreen(frame);
    const style = selectionFrameElement.style;
    style.left = corner.x + 'px';
    style.top = corner.y + 'px';
    style.width = frame.w * camera.zoom + 'px';
    style.height = frame.h * camera.zoom + 'px';
    style.transform = frame.rotation ? `rotate(${frame.rotation}deg)` : '';

    const dataset = selectionFrameElement.dataset;
    const mode = frameMode();
    dataset.mode = mode;
    dataset.flatX = String(mode === 'free' && frame.w < FLAT_SIZE);
    dataset.flatY = String(mode === 'free' && frame.h < FLAT_SIZE);
    dataset.rotateBelow = String(corner.y < ROTATE_HANDLE_ROOM);
}

function updateSelectionStyles() {
    elements.forEach((element, id) => {
        element.classList.toggle('selected', selectedIds.includes(id));
    });
    board.classList.toggle('multi-selection', selectedIds.length > 1);
    updateFrame();
}

function isGroupedSelection() {
    const selected = selectedItems();
    return selected.length > 1
        && selected[0].groupId !== null
        && selected.every((item) => item.groupId === selected[0].groupId);
}

function updateButtons() {
    const selected = selectedItems();
    undoButton.disabled = undoIndex === 0;
    redoButton.disabled = undoIndex === undoStack.length - 1;
    selectionButtons.forEach((button) => {
        button.disabled = selected.length === 0;
    });
    distributeButtons.forEach((button) => {
        button.disabled = alignUnits().length < 3;
    });

    const grouped = isGroupedSelection();
    const groupLabel = grouped ? 'Ungroup' : 'Group';
    groupButton.disabled = selected.length < 2;
    groupButton.setAttribute('aria-label', groupLabel);
    groupButton.dataset.tip = grouped ? 'Ungroup (Ctrl+Shift+G)' : 'Group (Ctrl+G)';
    groupIcon.setAttribute('href', grouped ? '#i-ungroup' : '#i-group');

    const locked = selectionLocked();
    const lockLabel = locked ? 'Unlock' : 'Lock';
    lockButton.setAttribute('aria-label', lockLabel);
    lockButton.setAttribute('aria-pressed', String(locked));
    lockButton.dataset.tip = lockLabel;
    lockIcon.setAttribute('href', locked ? '#i-unlock' : '#i-lock');

    updateContextBar();
}

// The floating bar only offers options that apply to what's selected or active.
function updateContextBar() {
    const tags = new Set();
    const selected = selectedItems();
    if (tool === 'eraser') {
        tags.add('eraser');
    } else if (DRAWING_TYPES.includes(tool)) {
        tags.add('draw');
        if (FILLABLE_TYPES.includes(tool)) {
            tags.add('fillable');
        }
    } else if (selected.length > 0) {
        if (selectionLocked()) {
            tags.add('locked');
        } else {
            tags.add('selection');
            if (alignUnits().length >= 2) {
                tags.add('multi');
            }
            if (selected.some(isText)) {
                tags.add('text');
            }
            if (selected.some(isDrawing)) {
                tags.add('stroke');
            }
            if (selected.some((item) => !isImage(item))) {
                tags.add('colorable');
            }
            if (selected.some(isFillable)) {
                tags.add('fillable');
            }
            if (selected.length === 1 && isText(selected[0])) {
                tags.add('single-text');
            }
        }
    }
    contextBar.hidden = tags.size === 0;
    contextGroups.forEach((group) => {
        group.hidden = !group.dataset.show.split(' ').some((tag) => tags.has(tag));
    });
    if (!tags.has('multi')) {
        setAlignMenu(false);
    }
}

function save(json) {
    try {
        persistAssets(); // Images first, so a saved board never points at missing pictures.
        localStorage.setItem(STORAGE_KEY, json);
        setSaveState(true);
    } catch (error) {
        setSaveState(false);
    }
}

// Draw the board and add one undo step, unless nothing actually changed.
function commit() {
    render();
    const json = snapshot();
    if (json !== undoStack[undoIndex]) {
        undoStack.splice(undoIndex + 1);
        undoStack.push(json);
        if (undoStack.length > MAX_UNDO_STEPS) {
            undoStack.shift();
        }
        undoIndex = undoStack.length - 1;
        save(json);
    }
    updateButtons();
}

function restore(index) {
    undoIndex = index;
    ({ items } = JSON.parse(undoStack[index]));
    render();
    select(selectedIds.filter(findItem));
    save(undoStack[index]);
}

function undo() {
    if (undoIndex > 0 && !isInteracting()) {
        restore(undoIndex - 1);
    }
}

function redo() {
    if (undoIndex < undoStack.length - 1 && !isInteracting()) {
        restore(undoIndex + 1);
    }
}
