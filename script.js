const board = document.getElementById('white-board');
const textLayer = document.getElementById('text-layer');
const canvas = document.getElementById('drawing-layer');
const context = canvas.getContext('2d');
const fontSizeInput = document.getElementById('font-size');
const colorInput = document.getElementById('color-input');
const brushSizeInput = document.getElementById('brush-size');
const undoButton = document.getElementById('undo-btn');
const redoButton = document.getElementById('redo-btn');
const frontButton = document.getElementById('front-btn');
const deleteButton = document.getElementById('delete-btn');
const importInput = document.getElementById('import-input');
const toast = document.getElementById('toast');
const toolButtons = [...document.querySelectorAll('.tool-btn')];
const boardNameInput = document.getElementById('board-name');
const saveState = document.getElementById('save-state');
const saveIcon = document.getElementById('save-icon');
const saveLabel = document.getElementById('save-label');
const contextBar = document.getElementById('context-bar');
const contextGroups = [...contextBar.querySelectorAll('.context-group')];
const brushValue = document.getElementById('brush-value');
const themeButton = document.getElementById('theme-btn');
const exportToggle = document.getElementById('export-toggle');
const exportMenu = document.getElementById('export-menu');

const STORAGE_KEY = 'interactive-white-board';
const NAME_STORAGE_KEY = 'interactive-white-board:name';
const THEME_STORAGE_KEY = 'interactive-white-board:theme';
const DEFAULT_BOARD_NAME = 'Untitled board';
const TOAST_MS = 3500;
const MAX_UNDO_STEPS = 100;
const CASCADE_START = 24;
const CASCADE_STEP = 28;
const CASCADE_LENGTH = 10;
const DRAG_THRESHOLD = 3;
const DOUBLE_TAP_MS = 350;
const ERASER_RADIUS = 8;
const ERASER_STEP = 4;
const ELLIPSE_SEGMENTS = 48;
const EXPORT_SCALE = 2;
const TEXT_PADDING = 5;
const COLOR_PATTERN = /^#[0-9a-f]{6}$/i;
const DRAWING_TYPES = ['pen', 'line', 'rectangle', 'ellipse'];

// The board is plain data; the page is always drawn from it.
let boxes = [];
let drawings = [];

let selectedId = null;
let editingId = null;
let tool = 'select';
let nextId = 1;
let cascade = 0;

// What the pointer is doing right now, if anything.
let drag = null;
let activeDrawing = null;
let eraser = null;
let lastTap = null;

// Each entry is a JSON snapshot of the board.
let undoStack = [];
let undoIndex = 0;

function findBox(id) {
    return boxes.find((box) => box.id === id);
}

function snapshot() {
    return JSON.stringify({ boxes, drawings });
}

function isInteracting() {
    return Boolean(drag || activeDrawing || eraser);
}

let toastTimer = null;

function showToast(message) {
    toast.textContent = message;
    toast.classList.add('visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('visible'), TOAST_MS);
}

function setSaveState(isSaved) {
    saveState.dataset.state = isSaved ? 'saved' : 'error';
    saveIcon.setAttribute('href', isSaved ? '#i-check' : '#i-alert');
    saveLabel.textContent = isSaved ? 'Saved' : 'Autosave off';
    saveState.title = isSaved
        ? 'Saved in this browser'
        : 'This browser is not saving your board. Use Export to keep it.';
}

// --- Drawing layer ---

function resizeCanvas() {
    const rect = board.getBoundingClientRect();
    const ratio = window.devicePixelRatio || 1;
    canvas.width = Math.round(rect.width * ratio);
    canvas.height = Math.round(rect.height * ratio);
    paint();
}

function drawItem(target, item) {
    const [start, end = start] = item.points;
    target.strokeStyle = item.color;
    target.lineWidth = item.width;
    target.lineCap = 'round';
    target.lineJoin = 'round';
    target.beginPath();

    if (item.type === 'pen') {
        target.moveTo(start.x, start.y);
        item.points.slice(1).forEach((point) => target.lineTo(point.x, point.y));
        if (item.points.length === 1) {
            target.lineTo(start.x + 0.01, start.y); // A single tap still leaves a dot.
        }
    } else if (item.type === 'line') {
        target.moveTo(start.x, start.y);
        target.lineTo(end.x, end.y);
    } else if (item.type === 'rectangle') {
        target.rect(start.x, start.y, end.x - start.x, end.y - start.y);
    } else if (item.type === 'ellipse') {
        target.ellipse(
            (start.x + end.x) / 2,
            (start.y + end.y) / 2,
            Math.abs(end.x - start.x) / 2,
            Math.abs(end.y - start.y) / 2,
            0,
            0,
            Math.PI * 2
        );
    }
    target.stroke();
}

function paint() {
    const ratio = window.devicePixelRatio || 1;
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.clearRect(0, 0, canvas.width, canvas.height);
    drawings.forEach((item) => drawItem(context, item));
}

function boardPoint(e) {
    const rect = board.getBoundingClientRect();
    return {
        x: Math.round((e.clientX - rect.left) * 10) / 10,
        y: Math.round((e.clientY - rect.top) * 10) / 10,
    };
}

function distance(a, b) {
    return Math.hypot(a.x - b.x, a.y - b.y);
}

function distanceToSegment(point, a, b) {
    const lengthSquared = (b.x - a.x) ** 2 + (b.y - a.y) ** 2;
    if (lengthSquared === 0) {
        return distance(point, a);
    }
    const along = ((point.x - a.x) * (b.x - a.x) + (point.y - a.y) * (b.y - a.y)) / lengthSquared;
    const t = Math.min(1, Math.max(0, along));
    return distance(point, { x: a.x + t * (b.x - a.x), y: a.y + t * (b.y - a.y) });
}

// The drawn path of an item as connected points, used by the eraser.
function outline(item) {
    const [start, end = start] = item.points;
    if (item.type === 'rectangle') {
        return [
            start,
            { x: end.x, y: start.y },
            end,
            { x: start.x, y: end.y },
            start,
        ];
    }
    if (item.type === 'ellipse') {
        const centre = { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 };
        const radius = { x: Math.abs(end.x - start.x) / 2, y: Math.abs(end.y - start.y) / 2 };
        return Array.from({ length: ELLIPSE_SEGMENTS + 1 }, (_, i) => {
            const angle = (i / ELLIPSE_SEGMENTS) * Math.PI * 2;
            return { x: centre.x + radius.x * Math.cos(angle), y: centre.y + radius.y * Math.sin(angle) };
        });
    }
    return item.points;
}

function isHit(item, point) {
    const path = outline(item);
    const reach = item.width / 2 + ERASER_RADIUS;
    if (path.length === 1) {
        return distance(point, path[0]) <= reach;
    }
    return path.slice(1).some((next, i) => distanceToSegment(point, path[i], next) <= reach);
}

// Sample along the pointer's path so a fast swipe doesn't skip over thin strokes.
function eraseBetween(from, to) {
    const steps = Math.max(1, Math.ceil(distance(from, to) / ERASER_STEP));
    const probes = Array.from({ length: steps + 1 }, (_, i) => ({
        x: from.x + ((to.x - from.x) * i) / steps,
        y: from.y + ((to.y - from.y) * i) / steps,
    }));
    const remaining = drawings.filter((item) => !probes.some((probe) => isHit(item, probe)));
    if (remaining.length !== drawings.length) {
        drawings = remaining;
        paint();
    }
}

function startDrawing(e) {
    const point = boardPoint(e);
    if (tool === 'eraser') {
        eraser = { last: point };
        eraseBetween(point, point);
        return;
    }
    activeDrawing = {
        type: tool,
        color: colorInput.value,
        width: Number(brushSizeInput.value),
        points: tool === 'pen' ? [point] : [point, point],
    };
    drawings.push(activeDrawing);
    paint();
}

function continueDrawing(e) {
    const point = boardPoint(e);
    if (eraser) {
        eraseBetween(eraser.last, point);
        eraser.last = point;
        return;
    }
    if (activeDrawing.type === 'pen') {
        const last = activeDrawing.points[activeDrawing.points.length - 1];
        if (distance(last, point) >= 1) {
            activeDrawing.points.push(point);
        }
    } else {
        activeDrawing.points[1] = point;
    }
    paint();
}

function finishDrawing() {
    if (activeDrawing && activeDrawing.type !== 'pen') {
        const [start, end] = activeDrawing.points;
        if (distance(start, end) === 0) {
            drawings.pop(); // A shape needs a size; a tap alone draws nothing.
        }
    }
    activeDrawing = null;
    eraser = null;
    commit();
}

// --- Text layer ---

function clampToBoard(element, x, y) {
    const boardRect = board.getBoundingClientRect();
    const elementRect = element.getBoundingClientRect();
    const maxX = Math.max(0, boardRect.width - elementRect.width);
    const maxY = Math.max(0, boardRect.height - elementRect.height);
    return {
        x: Math.min(Math.max(0, x), maxX),
        y: Math.min(Math.max(0, y), maxY),
    };
}

function createBoxElement(id) {
    const element = document.createElement('div');
    element.className = 'text-box';
    element.dataset.id = id;
    element.contentEditable = 'false';
    return element;
}

function updateSelectionStyles() {
    for (const element of textLayer.children) {
        element.classList.toggle('selected', element.dataset.id === selectedId);
    }
}

function updateButtons() {
    undoButton.disabled = undoIndex === 0;
    redoButton.disabled = undoIndex === undoStack.length - 1;
    frontButton.disabled = !findBox(selectedId);
    deleteButton.disabled = !findBox(selectedId);
    updateContextBar();
}

// The floating bar only offers options that apply to what's selected or active.
function updateContextBar() {
    let mode = '';
    if (tool === 'eraser') {
        mode = 'eraser';
    } else if (DRAWING_TYPES.includes(tool)) {
        mode = 'draw';
    } else if (findBox(selectedId)) {
        mode = 'text';
    }
    contextBar.hidden = !mode;
    contextGroups.forEach((group) => {
        group.hidden = !group.dataset.show.split(' ').includes(mode);
    });
}

// Existing elements are reused so a redraw never interrupts a drag or an edit in progress.
function render() {
    const elements = new Map([...textLayer.children].map((element) => [element.dataset.id, element]));

    boxes.forEach((box, index) => {
        const element = elements.get(box.id) || createBoxElement(box.id);
        elements.delete(box.id);

        if (textLayer.children[index] !== element) {
            textLayer.insertBefore(element, textLayer.children[index] || null);
        }
        if (box.id !== editingId && element.innerText !== box.text) {
            element.innerText = box.text;
        }
        element.style.fontSize = box.fontSize + 'px';
        element.style.color = box.color;

        const position = clampToBoard(element, box.x, box.y);
        box.x = position.x;
        box.y = position.y;
        element.style.left = box.x + 'px';
        element.style.top = box.y + 'px';
    });

    elements.forEach((element) => element.remove());
    updateSelectionStyles();
    paint();
}

function save(json) {
    try {
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
    ({ boxes, drawings } = JSON.parse(undoStack[index]));
    render();
    select(findBox(selectedId) ? selectedId : null);
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

// Selecting a box also shows its size and colour in the controls.
function select(id) {
    selectedId = id;
    const box = findBox(id);
    if (box) {
        fontSizeInput.value = box.fontSize;
        colorInput.value = box.color;
    }
    updateSelectionStyles();
    updateButtons();
}

function setTool(name) {
    tool = name;
    if (name !== 'select') {
        select(null);
    }
    board.classList.toggle('drawing', name !== 'select');
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
    const box = {
        id: String(nextId++),
        text: 'New Text',
        x: offset,
        y: offset,
        fontSize: Number(fontSizeInput.value),
        color: colorInput.value,
    };
    boxes.push(box);
    selectedId = box.id;
    commit();
}

function deleteSelected() {
    if (!findBox(selectedId)) {
        return;
    }
    boxes = boxes.filter((box) => box.id !== selectedId);
    selectedId = null;
    commit();
}

function bringToFront() {
    const box = findBox(selectedId);
    if (box) {
        boxes = [...boxes.filter((other) => other !== box), box];
        commit();
    }
}

function clearBoard() {
    boxes = [];
    drawings = [];
    selectedId = null;
    commit();
}

// Apply a style to the selected box. With nothing selected, the controls
// only set the defaults for whatever is added next.
function updateSelected(changes) {
    const box = findBox(selectedId);
    if (box) {
        Object.assign(box, changes);
        render();
    }
}

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
    updateSelected({ fontSize: size });
    commit();
}

// --- Board name, theme and menus ---

function boardName() {
    return boardNameInput.value.trim() || DEFAULT_BOARD_NAME;
}

function storeBoardName() {
    try {
        localStorage.setItem(NAME_STORAGE_KEY, boardName());
    } catch (error) {
        setSaveState(false);
    }
}

function setBoardName(name) {
    boardNameInput.value = name.slice(0, Number(boardNameInput.maxLength));
    storeBoardName();
}

function loadBoardName() {
    try {
        boardNameInput.value = localStorage.getItem(NAME_STORAGE_KEY) || DEFAULT_BOARD_NAME;
    } catch (error) {
        boardNameInput.value = DEFAULT_BOARD_NAME;
    }
}

function exportFilename(extension) {
    const safeName = boardName().replace(/[\\/:*?"<>|]+/g, '').trim().replace(/\s+/g, '-');
    return `${safeName || 'whiteboard'}.${extension}`;
}

function updateThemeButton() {
    const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    const label = `Switch to ${next} theme`;
    themeButton.setAttribute('aria-label', label);
    themeButton.dataset.tip = label;
}

function toggleTheme() {
    const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    updateThemeButton();
    try {
        localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch (error) {
        // The theme still applies for this visit; it just won't be remembered.
    }
}

function setExportMenu(isOpen) {
    exportMenu.hidden = !isOpen;
    exportToggle.setAttribute('aria-expanded', String(isOpen));
}

// --- Saving and opening ---

function isValidBox(box) {
    return Boolean(box)
        && typeof box.text === 'string'
        && Number.isFinite(box.x)
        && Number.isFinite(box.y)
        && Number.isFinite(box.fontSize)
        && COLOR_PATTERN.test(box.color);
}

function isValidDrawing(item) {
    return Boolean(item)
        && DRAWING_TYPES.includes(item.type)
        && COLOR_PATTERN.test(item.color)
        && Number.isFinite(item.width)
        && Array.isArray(item.points)
        && item.points.length > 0
        && item.points.every((point) => point && Number.isFinite(point.x) && Number.isFinite(point.y));
}

function parseBoard(json) {
    const data = JSON.parse(json);
    if (!data || !Array.isArray(data.boxes) || !Array.isArray(data.drawings)
        || !data.boxes.every(isValidBox) || !data.drawings.every(isValidDrawing)) {
        throw new Error('Not a whiteboard file');
    }
    return data;
}

function setBoard(data) {
    boxes = data.boxes.map((box) => ({ ...box, id: String(nextId++) }));
    drawings = data.drawings;
    cascade = boxes.length;
    selectedId = null;
}

function loadSavedBoard() {
    try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
            setBoard(parseBoard(saved));
        }
    } catch (error) {
        boxes = [];
        drawings = []; // Storage is blocked or the saved data is damaged: start empty.
    }
}

function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function exportJson() {
    const json = JSON.stringify({ name: boardName(), boxes, drawings });
    downloadBlob(new Blob([json], { type: 'application/json' }), exportFilename('json'));
}

function wrapText(target, text, maxWidth) {
    return text.split('\n').flatMap((paragraph) => {
        const lines = [];
        let line = '';
        paragraph.split(' ').forEach((word) => {
            const candidate = line ? line + ' ' + word : word;
            if (line && target.measureText(candidate).width > maxWidth) {
                lines.push(line);
                line = word;
            } else {
                line = candidate;
            }
        });
        lines.push(line);
        return lines;
    });
}

function drawBoxText(target, box, element) {
    const style = window.getComputedStyle(element);
    const lineHeight = parseFloat(style.lineHeight) || box.fontSize * 1.5;
    target.font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
    target.fillStyle = box.color;
    target.textBaseline = 'middle';

    const maxWidth = Math.ceil(element.getBoundingClientRect().width) - TEXT_PADDING * 2;
    wrapText(target, box.text, maxWidth).forEach((line, i) => {
        target.fillText(line, box.x + TEXT_PADDING, box.y + TEXT_PADDING + lineHeight * (i + 0.5));
    });
}

function exportPng() {
    const rect = board.getBoundingClientRect();
    const output = document.createElement('canvas');
    output.width = Math.round(rect.width * EXPORT_SCALE);
    output.height = Math.round(rect.height * EXPORT_SCALE);

    const target = output.getContext('2d');
    target.scale(EXPORT_SCALE, EXPORT_SCALE);
    target.fillStyle = '#ffffff';
    target.fillRect(0, 0, rect.width, rect.height);
    drawings.forEach((item) => drawItem(target, item));
    boxes.forEach((box, index) => drawBoxText(target, box, textLayer.children[index]));

    output.toBlob((blob) => downloadBlob(blob, exportFilename('png')), 'image/png');
}

async function importJson() {
    const file = importInput.files[0];
    importInput.value = '';
    if (!file) {
        return;
    }
    try {
        const data = parseBoard(await file.text());
        setBoard(data);
        commit();
        select(null);
        if (typeof data.name === 'string' && data.name.trim()) {
            setBoardName(data.name.trim());
        }
        showToast(`Opened ${file.name}.`);
    } catch (error) {
        showToast('That file is not a saved whiteboard.');
    }
}

// --- Input ---

board.addEventListener('pointerdown', function (e) {
    if (!e.isPrimary || e.button !== 0) {
        return;
    }
    const element = e.target.closest('.text-box');
    if (editingId && (!element || element.dataset.id !== editingId)) {
        finishEditing();
    }
    if (tool !== 'select') {
        startDrawing(e);
        return;
    }
    if (!element) {
        select(null);
        return;
    }

    select(element.dataset.id);
    if (element.dataset.id === editingId) {
        return; // Let the browser place the caret and select text.
    }

    const rect = element.getBoundingClientRect();
    drag = {
        box: findBox(element.dataset.id),
        element,
        startX: e.clientX,
        startY: e.clientY,
        offsetX: e.clientX - rect.left,
        offsetY: e.clientY - rect.top,
        moved: false,
    };
});

document.addEventListener('pointermove', function (e) {
    if (activeDrawing || eraser) {
        continueDrawing(e);
        return;
    }
    if (!drag) {
        return;
    }
    if (!drag.moved && Math.hypot(e.clientX - drag.startX, e.clientY - drag.startY) < DRAG_THRESHOLD) {
        return;
    }
    drag.moved = true;

    const boardRect = board.getBoundingClientRect();
    const position = clampToBoard(
        drag.element,
        e.clientX - boardRect.left - drag.offsetX,
        e.clientY - boardRect.top - drag.offsetY
    );
    drag.box.x = position.x;
    drag.box.y = position.y;
    drag.element.style.left = position.x + 'px';
    drag.element.style.top = position.y + 'px';
});

function endPointer(e) {
    if (activeDrawing || eraser) {
        finishDrawing();
        return;
    }
    if (drag) {
        const { element, moved } = drag;
        drag = null;
        commit();
        if (!moved && e.type === 'pointerup') {
            registerTap(element, e.timeStamp);
        }
    }
}

document.addEventListener('pointerup', endPointer);
document.addEventListener('pointercancel', endPointer);

board.addEventListener('focusout', function (e) {
    const element = e.target.closest('.text-box');
    if (!element || element.dataset.id !== editingId) {
        return;
    }
    const box = findBox(editingId);
    const text = element.innerText;
    if (text.trim()) {
        box.text = text; // A blank edit keeps the old text so the box can't become invisible.
    }
    editingId = null;
    element.contentEditable = 'false';
    commit();
});

document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && !exportMenu.hidden) {
        setExportMenu(false);
        exportToggle.focus();
        return;
    }
    if (editingId) {
        if (e.key === 'Escape') {
            finishEditing();
        }
        return;
    }
    if (e.target.matches('input[type="number"], input[type="text"]')) {
        return; // Typing in a field must never trigger board shortcuts.
    }

    const key = e.key.toLowerCase();
    if ((e.ctrlKey || e.metaKey) && key === 'z') {
        e.preventDefault();
        if (e.shiftKey) {
            redo();
        } else {
            undo();
        }
    } else if ((e.ctrlKey || e.metaKey) && key === 'y') {
        e.preventDefault();
        redo();
    } else if ((key === 'delete' || key === 'backspace') && findBox(selectedId)) {
        e.preventDefault();
        deleteSelected();
    } else if (key === 'escape') {
        select(null);
    }
});

// `input` previews the change live; `change` fires once at the end and records one undo step.
fontSizeInput.addEventListener('input', function () {
    const { min, max } = fontSizeLimits();
    const size = Number(this.value);
    if (size >= min && size <= max) {
        updateSelected({ fontSize: size });
    }
});

fontSizeInput.addEventListener('change', function () {
    const { min, max } = fontSizeLimits();
    const size = Math.min(max, Math.max(min, Number(this.value) || Number(this.defaultValue)));
    this.value = size;
    updateSelected({ fontSize: size });
    commit();
});

colorInput.addEventListener('input', function () {
    updateSelected({ color: this.value });
});

colorInput.addEventListener('change', commit);

brushSizeInput.addEventListener('input', function () {
    brushValue.textContent = this.value;
});

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
});

new ResizeObserver(function () {
    resizeCanvas();
    if (!isInteracting() && !editingId) {
        render();
    }
}).observe(board);

toolButtons.forEach((button) => {
    button.addEventListener('click', () => setTool(button.dataset.tool));
});

document.getElementById('add-text-btn').addEventListener('click', addTextBox);
document.getElementById('font-down').addEventListener('click', () => stepFontSize(-1));
document.getElementById('font-up').addEventListener('click', () => stepFontSize(1));
themeButton.addEventListener('click', toggleTheme);
undoButton.addEventListener('click', undo);
redoButton.addEventListener('click', redo);
frontButton.addEventListener('click', bringToFront);
deleteButton.addEventListener('click', deleteSelected);
document.getElementById('clear-btn').addEventListener('click', clearBoard);
document.getElementById('export-png-btn').addEventListener('click', exportPng);
document.getElementById('export-json-btn').addEventListener('click', exportJson);
document.getElementById('import-json-btn').addEventListener('click', () => importInput.click());
importInput.addEventListener('change', importJson);

// --- Start ---

loadSavedBoard();
loadBoardName();
updateThemeButton();
resizeCanvas();
render();
undoStack = [snapshot()];
setTool('select');
updateButtons();
