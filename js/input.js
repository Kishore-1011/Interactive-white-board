// --- Input ---

board.addEventListener('pointerdown', function (e) {
    if (e.target.closest('#empty-state')) {
        return;
    }
    if (e.pointerType === 'touch') {
        touches.set(e.pointerId, screenPoint(e));
        if (touches.size === 2) {
            cancelGesture();
            startPinch();
            return;
        }
    }
    if (pinch || !e.isPrimary || (e.button !== 0 && e.button !== 1)) {
        return;
    }
    const element = e.target.closest('.item');
    if (editingId && (!element || element.dataset.id !== editingId)) {
        finishEditing();
    }
    if (e.button === 1 || spaceHeld || tool === 'hand') {
        startPan(e);
        return;
    }
    if (tool !== 'select') {
        startDrawing(e);
        return;
    }

    const handle = e.target.closest('[data-handle]');
    if (handle && !selectionLocked()) {
        if (handle.dataset.handle === 'rotate') {
            startRotate(e);
        } else {
            startResize(e, handle.dataset.handle);
        }
        return;
    }

    if (!element) {
        startMarquee(e, e.shiftKey);
        return;
    }

    const id = element.dataset.id;
    if (id === editingId) {
        return; // Let the browser place the caret and select text.
    }

    const wasSelected = selectedIds.includes(id);
    if (e.shiftKey) {
        if (wasSelected) {
            const members = expandGroups([id]);
            select(selectedIds.filter((selectedId) => !members.includes(selectedId)));
        } else {
            select([...selectedIds, id]);
        }
        return;
    }
    if (!wasSelected) {
        select([id]);
    }
    if (!selectionLocked()) {
        const collapseTo = wasSelected && selectedIds.length > 1 ? id : null;
        startMove(e, element, collapseTo);
    }
});

// Stops the browser's autoscroll so the middle button can pan.
board.addEventListener('mousedown', function (e) {
    if (e.button === 1) {
        e.preventDefault();
    }
});

board.addEventListener('contextmenu', function (e) {
    const element = e.target.closest('.item');
    if (element && element.dataset.id === editingId) {
        return; // While typing, the browser's own menu offers spelling and paste.
    }
    e.preventDefault();
    openContextMenu(e, element);
});

board.addEventListener('wheel', function (e) {
    closeContextMenu();
    e.preventDefault();
    if (isInteracting() || pinch) {
        return;
    }
    const unit = e.deltaMode === WheelEvent.DOM_DELTA_LINE ? WHEEL_LINE_HEIGHT : 1;
    if (e.ctrlKey || e.metaKey) {
        zoomAt(screenPoint(e), camera.zoom * Math.exp(-e.deltaY * unit * WHEEL_ZOOM_SPEED));
        return;
    }
    const sideways = e.shiftKey && e.deltaX === 0;
    const dx = (sideways ? e.deltaY : e.deltaX) * unit;
    const dy = (sideways ? 0 : e.deltaY) * unit;
    setCamera(camera.x - dx, camera.y - dy, camera.zoom);
}, { passive: false });

document.addEventListener('pointermove', function (e) {
    if (touches.has(e.pointerId)) {
        touches.set(e.pointerId, screenPoint(e));
    }
    if (pinch) {
        if (touches.size >= 2) {
            continuePinch();
        }
    } else if (activeDrawing || eraser) {
        continueDrawing(e);
    } else if (gesture) {
        const handlers = {
            pan: continuePan,
            move: continueMove,
            resize: continueResize,
            rotate: continueRotate,
            marquee: continueMarquee,
        };
        handlers[gesture.kind](e);
    }
});

function endPointer(e) {
    touches.delete(e.pointerId);
    if (pinch) {
        if (touches.size === 0) {
            pinch = null; // Wait for every finger to lift so the last one can't start a drag.
        }
        return;
    }
    if (activeDrawing || eraser) {
        finishDrawing();
    } else if (gesture && gesture.kind === 'pan') {
        finishPan();
    } else if (gesture && gesture.kind === 'marquee') {
        finishMarquee();
    } else if (gesture) {
        finishTransform(e);
    }
}

document.addEventListener('pointerup', endPointer);
document.addEventListener('pointercancel', endPointer);

board.addEventListener('focusout', function (e) {
    const element = e.target.closest('.text-box');
    if (!element || element.dataset.id !== editingId) {
        return;
    }
    const item = findItem(editingId);
    const text = element.innerText;
    if (text.trim()) {
        item.text = text; // A blank edit keeps the old text so the box can't become invisible.
    }
    editingId = null;
    element.contentEditable = 'false';
    commit();
});

document.addEventListener('keydown', function (e) {
    if (anyDialogOpen()) {
        return;
    }
    if (!contextMenu.hidden) {
        handleContextMenuKey(e);
        return;
    }
    if (e.key === 'Escape' && !exportMenu.hidden) {
        setExportMenu(false);
        exportToggle.focus();
        return;
    }
    if (e.key === 'Escape' && closeOpenPopovers()) {
        return;
    }
    if (editingId) {
        if (e.key === 'Escape') {
            finishEditing();
        }
        return;
    }
    if (e.target.matches('input[type="number"], input[type="text"], select')) {
        return; // Typing in a field must never trigger board shortcuts.
    }

    if (e.code === 'Space') {
        e.preventDefault(); // Otherwise it would also press whichever button has focus.
        if (document.activeElement.matches('button')) {
            document.activeElement.blur();
        }
        if (!e.repeat) {
            setSpaceHeld(true);
        }
        return;
    }
    if (e.shiftKey && e.code === 'Digit1') {
        e.preventDefault();
        fitToScreen();
        return;
    }

    if (e.key === '?') {
        e.preventDefault();
        openHelp();
        return;
    }

    const key = e.key.toLowerCase();
    const command = e.ctrlKey || e.metaKey;
    if (!command && !e.altKey && !e.shiftKey) {
        const addShortcuts = { t: () => addTextBox(), n: () => addNote(), i: () => imageInput.click() };
        if (TOOL_KEYS[key]) {
            setTool(TOOL_KEYS[key]);
            return;
        }
        if (addShortcuts[key]) {
            e.preventDefault(); // Otherwise the letter could land in the new text.
            addShortcuts[key]();
            return;
        }
    }
    const shortcuts = {
        z: () => (e.shiftKey ? redo() : undo()),
        y: redo,
        c: copySelection,
        x: cutSelection,
        v: paste,
        d: duplicateSelection,
        a: selectAll,
        g: () => (e.shiftKey ? ungroup() : toggleGroup()),
        ']': bringToFront,
        '[': sendToBack,
        '=': () => stepZoom(1),
        '+': () => stepZoom(1),
        '-': () => stepZoom(-1),
        0: resetZoom,
    };

    if (command && shortcuts[key]) {
        e.preventDefault();
        shortcuts[key]();
    } else if ((key === 'delete' || key === 'backspace') && selectedIds.length > 0) {
        e.preventDefault();
        deleteSelected();
    } else if (key === 'escape') {
        select([]);
    }
});

document.addEventListener('keyup', function (e) {
    if (e.code === 'Space') {
        setSpaceHeld(false);
    }
});

window.addEventListener('blur', () => setSpaceHeld(false));

// `input` previews the change live; `change` fires once at the end and records one undo step.
fontSizeInput.addEventListener('input', function () {
    const { min, max } = fontSizeLimits();
    const size = Number(this.value);
    if (size >= min && size <= max) {
        setFontSize(size);
    }
});

fontSizeInput.addEventListener('change', function () {
    const { min, max } = fontSizeLimits();
    const size = Math.min(max, Math.max(min, Number(this.value) || Number(this.defaultValue)));
    this.value = size;
    setFontSize(size);
    commit();
});

colorInput.addEventListener('input', function () {
    setColor(this.value);
});

colorInput.addEventListener('change', function () {
    commit();
    addRecentColor(this.value);
});

fillInput.addEventListener('input', function () {
    setFill(this.value);
});

fillInput.addEventListener('change', function () {
    commit();
    addRecentColor(this.value);
});

opacityInput.addEventListener('input', function () {
    setOpacity(Number(this.value));
});

opacityInput.addEventListener('change', commit);

fontFamilySelect.addEventListener('change', function () {
    const fontFamily = this.value;
    setTextStyle((item) => {
        item.fontFamily = fontFamily;
    });
    this.blur(); // Hands the keyboard back to the board.
});

boldButton.addEventListener('click', toggleBold);
textAlignButton.addEventListener('click', cycleTextAlign);
colorButton.addEventListener('click', () => togglePalette('color', colorButton));
fillButton.addEventListener('click', () => togglePalette('fill', fillButton));
layerButton.addEventListener('click', () => setPopover(layerMenu, layerButton, layerMenu.hidden));

noFillButton.addEventListener('click', function () {
    setFill(null);
    commit();
    setPopover(paletteMenu, null, false);
});

paletteMenu.addEventListener('click', function (e) {
    const chip = e.target.closest('[data-color]');
    if (chip) {
        applyPaletteColor(chip.dataset.color);
    }
});

// Dropping picture files onto the board, or choosing them with the Image button.
function draggingFiles(e) {
    return [...e.dataTransfer.types].includes('Files');
}

board.addEventListener('dragover', function (e) {
    if (draggingFiles(e)) {
        e.preventDefault();
        board.classList.add('drop-target');
    }
});

board.addEventListener('dragleave', function (e) {
    if (!board.contains(e.relatedTarget)) {
        board.classList.remove('drop-target');
    }
});

board.addEventListener('drop', function (e) {
    board.classList.remove('drop-target');
    if (draggingFiles(e)) {
        e.preventDefault();
        addImageFiles(e.dataTransfer.files, screenPoint(e));
    }
});

// A file dropped just outside the board shouldn't make the browser navigate away from it.
window.addEventListener('dragover', (e) => e.preventDefault());
window.addEventListener('drop', (e) => e.preventDefault());

document.getElementById('add-image-btn').addEventListener('click', () => imageInput.click());

imageInput.addEventListener('change', function () {
    addImageFiles(this.files, null);
    this.value = '';
});

brushSizeInput.addEventListener('input', function () {
    brushValue.textContent = this.value;
    setStrokeWidth(Number(this.value));
});

brushSizeInput.addEventListener('change', commit);

boardNameInput.addEventListener('input', storeBoardName);

boardNameInput.addEventListener('blur', function () {
    this.value = boardName();
});

boardNameInput.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' || e.key === 'Escape') {
        this.blur();
    }
});

exportToggle.addEventListener('click', () => setExportMenu(exportMenu.hidden));
exportMenu.addEventListener('click', () => setExportMenu(false));

document.addEventListener('pointerdown', function (e) {
    if (!exportMenu.hidden && !e.target.closest('.export-wrap')) {
        setExportMenu(false);
    }
    closePopoversOutside(e.target);
    if (!contextMenu.hidden && !e.target.closest('#context-menu')) {
        closeContextMenu();
    }
});

alignButton.addEventListener('click', () => setAlignMenu(alignMenu.hidden));
alignMenu.querySelectorAll('[data-align]').forEach((button) => {
    button.addEventListener('click', () => alignSelection(button.dataset.align));
});
distributeButtons.forEach((button) => {
    button.addEventListener('click', () => distributeSelection(button.dataset.distribute));
});
gridButton.addEventListener('click', () => toggleSetting('grid'));
snapButton.addEventListener('click', () => toggleSetting('snap'));

toolButtons.forEach((button) => {
    button.addEventListener('click', () => setTool(button.dataset.tool));
});

document.getElementById('add-text-btn').addEventListener('click', () => addTextBox());
document.getElementById('add-note-btn').addEventListener('click', () => addNote());
document.getElementById('empty-note-btn').addEventListener('click', () => addNote());
document.getElementById('empty-text-btn').addEventListener('click', () => addTextBox());
document.getElementById('empty-templates-btn').addEventListener('click', openTemplates);
document.getElementById('help-btn').addEventListener('click', openHelp);
document.getElementById('boards-btn').addEventListener('click', openBoardsDialog);
document.getElementById('new-board-btn').addEventListener('click', startNewBoard);
document.getElementById('board-templates-btn').addEventListener('click', openTemplates);
document.getElementById('export-pdf-btn').addEventListener('click', exportPdf);
moreToolsButton.addEventListener('click', () => setRailExpanded(!toolRail.classList.contains('expanded')));

document.querySelectorAll('[data-close-dialog]').forEach((button) => {
    button.addEventListener('click', () => button.closest('dialog').close());
});

// Clicking the dimmed area around a dialog closes it.
DIALOGS.forEach((dialog) => {
    dialog.addEventListener('click', (e) => {
        if (e.target === dialog) {
            dialog.close();
        }
    });
});
document.getElementById('font-down').addEventListener('click', () => stepFontSize(-1));
document.getElementById('font-up').addEventListener('click', () => stepFontSize(1));
zoomInButton.addEventListener('click', () => stepZoom(1));
zoomOutButton.addEventListener('click', () => stepZoom(-1));
zoomResetButton.addEventListener('click', resetZoom);
document.getElementById('fit-btn').addEventListener('click', fitToScreen);
themeButton.addEventListener('click', toggleTheme);
undoButton.addEventListener('click', undo);
redoButton.addEventListener('click', redo);
document.getElementById('front-btn').addEventListener('click', bringToFront);
document.getElementById('forward-btn').addEventListener('click', () => stepLayer(1));
document.getElementById('backward-btn').addEventListener('click', () => stepLayer(-1));
document.getElementById('back-btn').addEventListener('click', sendToBack);
document.getElementById('duplicate-btn').addEventListener('click', duplicateSelection);
groupButton.addEventListener('click', toggleGroup);
lockButton.addEventListener('click', toggleLock);
document.getElementById('delete-btn').addEventListener('click', deleteSelected);
document.getElementById('clear-btn').addEventListener('click', clearBoard);
document.getElementById('export-png-btn').addEventListener('click', exportPng);
document.getElementById('export-json-btn').addEventListener('click', exportJson);
document.getElementById('import-json-btn').addEventListener('click', () => importInput.click());
importInput.addEventListener('change', importJson);
