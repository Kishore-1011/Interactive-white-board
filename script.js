const board = document.getElementById('white-board');
const itemLayer = document.getElementById('item-layer');
const selectionFrameElement = document.getElementById('selection-frame');
const marqueeElement = document.getElementById('marquee');
const fontSizeInput = document.getElementById('font-size');
const colorInput = document.getElementById('color-input');
const brushSizeInput = document.getElementById('brush-size');
const undoButton = document.getElementById('undo-btn');
const redoButton = document.getElementById('redo-btn');
const groupButton = document.getElementById('group-btn');
const groupIcon = document.getElementById('group-icon');
const lockButton = document.getElementById('lock-btn');
const lockIcon = document.getElementById('lock-icon');
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
const zoomInButton = document.getElementById('zoom-in');
const zoomOutButton = document.getElementById('zoom-out');
const zoomResetButton = document.getElementById('zoom-reset');
const selectionButtons = ['front-btn', 'forward-btn', 'backward-btn', 'back-btn', 'duplicate-btn', 'delete-btn']
    .map((id) => document.getElementById(id));

const SVG_NAMESPACE = 'http://www.w3.org/2000/svg';
const STORAGE_KEY = 'interactive-white-board';
const NAME_STORAGE_KEY = 'interactive-white-board:name';
const THEME_STORAGE_KEY = 'interactive-white-board:theme';
const VIEW_STORAGE_KEY = 'interactive-white-board:view';
const VIEW_SAVE_MS = 200;
const MIN_ZOOM = 0.1;
const MAX_ZOOM = 4;
const ZOOM_STEPS = [0.1, 0.25, 0.5, 0.75, 1, 1.5, 2, 3, 4];
const WHEEL_ZOOM_SPEED = 0.002;
const WHEEL_LINE_HEIGHT = 16;
const FIT_PADDING = 48;
const DOT_SPACING = 22;
const MIN_DOT_SPACING = 14;
const MAX_DOT_SPACING = 44;
const EXPORT_PADDING = 32;
const EXPORT_MAX_SIZE = 8000;
const MAX_TEXT_WIDTH = 1200;
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
const HIT_PADDING = 12;
const MIN_RESIZE = 8;
const MIN_TEXT_WIDTH = 40;
const FLAT_SIZE = 1;
const ROTATE_SNAP = 15;
const ROTATE_HANDLE_ROOM = 34;
const PASTE_OFFSET = 24;
const COLOR_PATTERN = /^#[0-9a-f]{6}$/i;
const DRAWING_TYPES = ['pen', 'line', 'rectangle', 'ellipse'];
const HANDLE_VECTORS = {
    nw: [-1, -1], n: [0, -1], ne: [1, -1], e: [1, 0],
    se: [1, 1], s: [0, 1], sw: [-1, 1], w: [-1, 0],
};

// The board is one list of items, ordered back to front. The page is always drawn from it.
// Text:     { id, type: 'text', text, x, y, width, fontSize, color, rotation, locked, groupId }
// Drawings: { id, type, points, color, strokeWidth, rotation, locked, groupId }
let items = [];

const elements = new Map();
let selectedIds = [];
let editingId = null;
let tool = 'select';
let nextId = 1;
let cascade = 0;

// Where the screen is looking: screen = board position * zoom + x/y offset.
const camera = { x: 0, y: 0, zoom: 1 };
let viewSaveTimer = null;

// What the pointer is doing right now, if anything.
let gesture = null;
let activeDrawing = null;
let eraser = null;
let lastTap = null;
let spaceHeld = false;
let pinch = null;
const touches = new Map();

let clipboard = [];
let pasteCount = 0;

// Each entry is a JSON snapshot of the board.
let undoStack = [];
let undoIndex = 0;

// --- Helpers ---

function newId() {
    return String(nextId++);
}

function clone(value) {
    return JSON.parse(JSON.stringify(value));
}

function round(value) {
    return Math.round(value * 10) / 10;
}

function isText(item) {
    return item.type === 'text';
}

function findItem(id) {
    return items.find((item) => item.id === id);
}

function selectedItems() {
    return items.filter((item) => selectedIds.includes(item.id));
}

function selectionLocked() {
    return selectedItems().some((item) => item.locked);
}

function snapshot() {
    return JSON.stringify({ items });
}

function isInteracting() {
    return Boolean(gesture || activeDrawing || eraser);
}

function distance(a, b) {
    return Math.hypot(a.x - b.x, a.y - b.y);
}

function rotatePoint(point, centre, degrees) {
    const angle = (degrees * Math.PI) / 180;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const dx = point.x - centre.x;
    const dy = point.y - centre.y;
    return { x: centre.x + dx * cos - dy * sin, y: centre.y + dx * sin + dy * cos };
}

function normaliseAngle(degrees) {
    return round(((degrees % 360) + 360) % 360);
}

function boxCentre(box) {
    return { x: box.x + box.w / 2, y: box.y + box.h / 2 };
}

function pointsBox(points) {
    const xs = points.map((point) => point.x);
    const ys = points.map((point) => point.y);
    const x = Math.min(...xs);
    const y = Math.min(...ys);
    return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y };
}

// The item's box before rotation; rotation is always about the centre of this box.
function itemBox(item) {
    if (isText(item)) {
        const element = elements.get(item.id);
        return {
            x: item.x,
            y: item.y,
            w: element ? element.offsetWidth : 0,
            h: element ? element.offsetHeight : 0,
        };
    }
    return pointsBox(item.points);
}

function itemCorners(item) {
    const box = itemBox(item);
    const centre = boxCentre(box);
    return [
        { x: box.x, y: box.y },
        { x: box.x + box.w, y: box.y },
        { x: box.x + box.w, y: box.y + box.h },
        { x: box.x, y: box.y + box.h },
    ].map((corner) => rotatePoint(corner, centre, item.rotation));
}

// The upright box that surrounds these items, including their rotation.
function boundsOfItems(list) {
    return pointsBox(list.flatMap(itemCorners));
}

// A pointer position in screen pixels, measured from the top-left of the visible board.
function screenPoint(e) {
    const rect = board.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
}

function screenToBoard(point) {
    return { x: (point.x - camera.x) / camera.zoom, y: (point.y - camera.y) / camera.zoom };
}

function boardToScreen(point) {
    return { x: point.x * camera.zoom + camera.x, y: point.y * camera.zoom + camera.y };
}

function boardPoint(e) {
    const point = screenToBoard(screenPoint(e));
    return { x: round(point.x), y: round(point.y) };
}

function viewportSize() {
    const rect = board.getBoundingClientRect();
    return { w: rect.width, h: rect.height };
}

function moveItem(item, start, dx, dy) {
    if (isText(item)) {
        item.x = round(start.x + dx);
        item.y = round(start.y + dy);
    } else {
        item.points = start.points.map((point) => ({ x: round(point.x + dx), y: round(point.y + dy) }));
    }
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

// --- Drawing shapes ---

function pathData(item) {
    if (item.type === 'pen') {
        const [first, ...rest] = item.points;
        if (rest.length === 0) {
            return `M${first.x} ${first.y}L${first.x + 0.01} ${first.y}`; // A single tap still leaves a dot.
        }
        return `M${first.x} ${first.y}` + rest.map((point) => `L${point.x} ${point.y}`).join('');
    }
    if (item.type === 'line') {
        const [start, end] = item.points;
        return `M${start.x} ${start.y}L${end.x} ${end.y}`;
    }
    const box = pointsBox(item.points);
    if (item.type === 'rectangle') {
        return `M${box.x} ${box.y}H${box.x + box.w}V${box.y + box.h}H${box.x}Z`;
    }
    const rx = box.w / 2;
    const ry = box.h / 2;
    const cy = box.y + ry;
    return `M${box.x} ${cy}A${rx} ${ry} 0 1 0 ${box.x + box.w} ${cy}A${rx} ${ry} 0 1 0 ${box.x} ${cy}Z`;
}

// The drawn path as connected points, in the item's unrotated position. Used by the eraser.
function outline(item) {
    const box = pointsBox(item.points);
    if (item.type === 'rectangle') {
        const right = box.x + box.w;
        const bottom = box.y + box.h;
        return [
            { x: box.x, y: box.y },
            { x: right, y: box.y },
            { x: right, y: bottom },
            { x: box.x, y: bottom },
            { x: box.x, y: box.y },
        ];
    }
    if (item.type === 'ellipse') {
        const centre = boxCentre(box);
        return Array.from({ length: ELLIPSE_SEGMENTS + 1 }, (_, i) => {
            const angle = (i / ELLIPSE_SEGMENTS) * Math.PI * 2;
            return { x: centre.x + (box.w / 2) * Math.cos(angle), y: centre.y + (box.h / 2) * Math.sin(angle) };
        });
    }
    return item.points;
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

function isHit(item, point) {
    const local = rotatePoint(point, boxCentre(pointsBox(item.points)), -item.rotation);
    const path = outline(item);
    const reach = item.strokeWidth / 2 + ERASER_RADIUS / camera.zoom;
    if (path.length === 1) {
        return distance(local, path[0]) <= reach;
    }
    return path.slice(1).some((next, i) => distanceToSegment(local, path[i], next) <= reach);
}

// Sample along the pointer's path so a fast swipe doesn't skip over thin strokes.
function eraseBetween(from, to) {
    const steps = Math.max(1, Math.ceil((distance(from, to) * camera.zoom) / ERASER_STEP));
    const probes = Array.from({ length: steps + 1 }, (_, i) => ({
        x: from.x + ((to.x - from.x) * i) / steps,
        y: from.y + ((to.y - from.y) * i) / steps,
    }));
    const remaining = items.filter((item) => isText(item) || item.locked
        || !probes.some((probe) => isHit(item, probe)));
    if (remaining.length !== items.length) {
        items = remaining;
        render();
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
        id: newId(),
        type: tool,
        points: tool === 'pen' ? [point] : [point, point],
        color: colorInput.value,
        strokeWidth: Number(brushSizeInput.value),
        rotation: 0,
        locked: false,
        groupId: null,
    };
    items.push(activeDrawing);
    render();
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
        if (distance(last, point) * camera.zoom >= 1) {
            activeDrawing.points.push(point);
        }
    } else {
        activeDrawing.points[1] = point;
    }
    renderItem(activeDrawing);
}

function finishDrawing() {
    if (activeDrawing && activeDrawing.type !== 'pen') {
        const [start, end] = activeDrawing.points;
        if (distance(start, end) === 0) {
            items.pop(); // A shape needs a size; a tap alone draws nothing.
        }
    }
    activeDrawing = null;
    eraser = null;
    commit();
}

// --- Drawing the page ---

function createItemElement(item) {
    const element = document.createElement('div');
    element.dataset.id = item.id;
    if (isText(item)) {
        element.className = 'item text-box';
        element.contentEditable = 'false';
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

    if (isText(item)) {
        if (item.id !== editingId && element.innerText !== item.text) {
            element.innerText = item.text;
        }
        element.style.fontSize = item.fontSize + 'px';
        element.style.color = item.color;
        element.style.width = item.width === null ? '' : item.width + 'px';
        element.style.maxWidth = item.width === null ? MAX_TEXT_WIDTH + 'px' : '';
        element.style.left = item.x + 'px';
        element.style.top = item.y + 'px';
    } else {
        const box = pointsBox(item.points);
        const data = pathData(item);
        const [ink, hit] = element.querySelectorAll('path');
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
    return isText(selected[0]) ? 'text' : 'free';
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
    } else if (selected.length > 0) {
        if (selectionLocked()) {
            tags.add('locked');
        } else {
            tags.add('selection');
            if (selected.some(isText)) {
                tags.add('text');
            }
            if (selected.some((item) => !isText(item))) {
                tags.add('stroke');
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

// --- Moving, resizing, rotating and rubber-band selection ---

function startMove(e, element, collapseTo) {
    const selected = selectedItems();
    gesture = {
        kind: 'move',
        startX: e.clientX,
        startY: e.clientY,
        element,
        collapseTo,
        starts: selected.map((item) => ({ item, start: clone(item) })),
        moved: false,
    };
}

function continueMove(e) {
    const rawX = e.clientX - gesture.startX;
    const rawY = e.clientY - gesture.startY;
    if (!gesture.moved && Math.hypot(rawX, rawY) < DRAG_THRESHOLD) {
        return;
    }
    gesture.moved = true;
    const dx = rawX / camera.zoom;
    const dy = rawY / camera.zoom;
    gesture.starts.forEach(({ item, start }) => {
        moveItem(item, start, dx, dy);
        renderItem(item);
    });
    updateFrame();
}

function startResize(e, handle) {
    const selected = selectedItems();
    const frame = currentFrame();
    const [hx, hy] = HANDLE_VECTORS[handle];
    const single = selected.length === 1 ? selected[0] : null;
    gesture = {
        kind: 'resize',
        hx,
        hy,
        frame,
        centre: boxCentre(frame),
        uniform: !single || (isText(single) && hx !== 0 && hy !== 0),
        textWidth: Boolean(single && isText(single) && hy === 0),
        starts: selected.map((item) => {
            const box = itemBox(item);
            return { item, start: clone(item), box, centre: boxCentre(box) };
        }),
    };
}

function resizeItem(entry, itemCentre, sx, sy) {
    const { item, start, box, centre } = entry;
    if (isText(item)) {
        const { min, max } = fontSizeLimits();
        const fontSize = Math.min(max, Math.max(min, start.fontSize * sx));
        const scale = fontSize / start.fontSize;
        item.fontSize = round(fontSize);
        item.width = start.width === null ? null : round(start.width * scale);
        item.x = round(itemCentre.x - (box.w * scale) / 2);
        item.y = round(itemCentre.y - (box.h * scale) / 2);
    } else {
        item.points = start.points.map((point) => ({
            x: round(itemCentre.x + (point.x - centre.x) * sx),
            y: round(itemCentre.y + (point.y - centre.y) * sy),
        }));
    }
}

function continueResize(e) {
    const { hx, hy, frame, centre } = gesture;
    const local = rotatePoint(boardPoint(e), centre, -frame.rotation);
    const anchorX = (-hx * frame.w) / 2;
    const anchorY = (-hy * frame.h) / 2;
    const localX = local.x - centre.x;
    const localY = local.y - centre.y;

    const minWidth = gesture.textWidth ? MIN_TEXT_WIDTH : MIN_RESIZE;
    let newW = hx && frame.w >= FLAT_SIZE ? Math.max(minWidth, hx * (localX - anchorX)) : frame.w;
    let newH = hy && frame.h >= FLAT_SIZE ? Math.max(MIN_RESIZE, hy * (localY - anchorY)) : frame.h;
    let sx = frame.w >= FLAT_SIZE ? newW / frame.w : 1;
    let sy = frame.h >= FLAT_SIZE ? newH / frame.h : 1;

    const keepShape = gesture.uniform || (e.shiftKey && hx !== 0 && hy !== 0);
    if (keepShape) {
        const scale = hx && hy ? Math.max(sx, sy) : (hx ? sx : sy);
        sx = scale;
        sy = scale;
        newW = frame.w * scale;
        newH = frame.h * scale;
    }

    const newCentre = rotatePoint({
        x: centre.x + (hx ? anchorX + (hx * newW) / 2 : 0),
        y: centre.y + (hy ? anchorY + (hy * newH) / 2 : 0),
    }, centre, frame.rotation);

    gesture.starts.forEach((entry) => {
        if (gesture.textWidth) {
            entry.item.width = round(newW);
            entry.item.x = round(newCentre.x - newW / 2);
        } else {
            // Where this item's centre lands after the frame is scaled.
            const offset = rotatePoint(entry.centre, centre, -frame.rotation);
            const itemCentre = rotatePoint({
                x: newCentre.x + (offset.x - centre.x) * sx,
                y: newCentre.y + (offset.y - centre.y) * sy,
            }, newCentre, frame.rotation);
            resizeItem(entry, itemCentre, sx, sy);
        }
        renderItem(entry.item);
    });
    updateFrame();
}

function pointerAngle(point, centre) {
    return (Math.atan2(point.y - centre.y, point.x - centre.x) * 180) / Math.PI;
}

function startRotate(e) {
    const selected = selectedItems();
    const frame = currentFrame();
    const centre = boxCentre(frame);
    gesture = {
        kind: 'rotate',
        frame,
        centre,
        delta: 0,
        startAngle: pointerAngle(boardPoint(e), centre),
        starts: selected.map((item) => ({ item, start: clone(item), centre: boxCentre(itemBox(item)) })),
    };
}

function continueRotate(e) {
    const { centre, starts, frame } = gesture;
    let delta = pointerAngle(boardPoint(e), centre) - gesture.startAngle;
    if (e.shiftKey) {
        const single = starts.length === 1 ? frame.rotation : 0;
        delta = Math.round((single + delta) / ROTATE_SNAP) * ROTATE_SNAP - single;
    }
    gesture.delta = delta;
    starts.forEach(({ item, start, centre: itemCentre }) => {
        const moved = rotatePoint(itemCentre, centre, delta);
        moveItem(item, start, moved.x - itemCentre.x, moved.y - itemCentre.y);
        item.rotation = normaliseAngle(start.rotation + delta);
        renderItem(item);
    });
    updateFrame();
}

function startMarquee(e, additive) {
    gesture = {
        kind: 'marquee',
        origin: boardPoint(e),
        additive,
        base: additive ? [...selectedIds] : [],
        moved: false,
    };
}

function marqueeBox(point) {
    const { origin } = gesture;
    return {
        x: Math.min(origin.x, point.x),
        y: Math.min(origin.y, point.y),
        w: Math.abs(point.x - origin.x),
        h: Math.abs(point.y - origin.y),
    };
}

function boxesTouch(a, b) {
    return a.x <= b.x + b.w && a.x + a.w >= b.x && a.y <= b.y + b.h && a.y + a.h >= b.y;
}

function continueMarquee(e) {
    const point = boardPoint(e);
    if (!gesture.moved && distance(gesture.origin, point) * camera.zoom < DRAG_THRESHOLD) {
        return;
    }
    gesture.moved = true;
    const box = marqueeBox(point);
    const corner = boardToScreen(box);
    gesture.box = box;
    marqueeElement.hidden = false;
    marqueeElement.style.left = corner.x + 'px';
    marqueeElement.style.top = corner.y + 'px';
    marqueeElement.style.width = box.w * camera.zoom + 'px';
    marqueeElement.style.height = box.h * camera.zoom + 'px';
}

function finishMarquee() {
    marqueeElement.hidden = true;
    const { moved, box, base, additive } = gesture;
    gesture = null;
    if (!moved) {
        if (!additive) {
            select([]);
        }
        return;
    }
    const touched = items
        .filter((item) => !item.locked && boxesTouch(box, boundsOfItems([item])))
        .map((item) => item.id);
    select([...base, ...touched]);
}

function finishTransform(e) {
    const finished = gesture;
    gesture = null;
    commit();
    if (finished.kind === 'move' && !finished.moved) {
        if (finished.collapseTo) {
            select([finished.collapseTo]);
        }
        if (finished.element.classList.contains('text-box') && e.type === 'pointerup') {
            registerTap(finished.element, e.timeStamp);
        }
    }
}

// --- Panning and zooming ---

function clampZoom(zoom) {
    return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom));
}

function updateDots() {
    let spacing = DOT_SPACING * camera.zoom;
    while (spacing < MIN_DOT_SPACING) {
        spacing *= 2;
    }
    while (spacing > MAX_DOT_SPACING) {
        spacing /= 2;
    }
    board.style.backgroundSize = `${spacing}px ${spacing}px`;
    board.style.backgroundPosition = `${camera.x}px ${camera.y}px`;
}

function drawCamera(zoomChanged) {
    itemLayer.style.transform = `translate(${camera.x}px, ${camera.y}px) scale(${camera.zoom})`;
    board.style.setProperty('--zoom', camera.zoom);
    updateDots();
    zoomResetButton.textContent = `${Math.round(camera.zoom * 100)}%`;
    zoomInButton.disabled = camera.zoom >= MAX_ZOOM;
    zoomOutButton.disabled = camera.zoom <= MIN_ZOOM;
    if (zoomChanged) {
        render(); // Click areas stay a comfortable size on screen at every zoom.
    } else {
        updateFrame();
    }
}

function queueViewSave() {
    clearTimeout(viewSaveTimer);
    viewSaveTimer = setTimeout(() => {
        try {
            localStorage.setItem(VIEW_STORAGE_KEY, JSON.stringify(camera));
        } catch (error) {
            // The view just won't be remembered next time.
        }
    }, VIEW_SAVE_MS);
}

function setCamera(x, y, zoom) {
    const zoomChanged = zoom !== camera.zoom;
    camera.x = x;
    camera.y = y;
    camera.zoom = zoom;
    drawCamera(zoomChanged);
    queueViewSave();
}

function loadView() {
    try {
        const view = JSON.parse(localStorage.getItem(VIEW_STORAGE_KEY));
        if (view && Number.isFinite(view.x) && Number.isFinite(view.y) && Number.isFinite(view.zoom)) {
            camera.x = view.x;
            camera.y = view.y;
            camera.zoom = clampZoom(view.zoom);
        }
    } catch (error) {
        // No usable view saved: start at the default.
    }
}

// Zoom while keeping the board position under this screen point exactly where it is.
function zoomAt(point, zoom) {
    const anchor = screenToBoard(point);
    const nextZoom = clampZoom(zoom);
    setCamera(point.x - anchor.x * nextZoom, point.y - anchor.y * nextZoom, nextZoom);
}

function viewportCentre() {
    const size = viewportSize();
    return { x: size.w / 2, y: size.h / 2 };
}

function stepZoom(direction) {
    const next = direction > 0
        ? ZOOM_STEPS.find((step) => step > camera.zoom + 0.001)
        : [...ZOOM_STEPS].reverse().find((step) => step < camera.zoom - 0.001);
    if (next !== undefined) {
        zoomAt(viewportCentre(), next);
    }
}

function resetZoom() {
    zoomAt(viewportCentre(), 1);
}

// Show the whole board, never enlarging it past 100%.
function fitToScreen() {
    if (items.length === 0) {
        setCamera(0, 0, 1);
        return;
    }
    const bounds = boundsOfItems(items);
    const size = viewportSize();
    const room = FIT_PADDING * 2;
    const zoom = clampZoom(Math.min(1, (size.w - room) / Math.max(bounds.w, 1), (size.h - room) / Math.max(bounds.h, 1)));
    const centre = boxCentre(bounds);
    setCamera(size.w / 2 - centre.x * zoom, size.h / 2 - centre.y * zoom, zoom);
}

function startPan(e) {
    gesture = { kind: 'pan', startX: e.clientX, startY: e.clientY, cameraX: camera.x, cameraY: camera.y };
    board.classList.add('is-panning');
}

function continuePan(e) {
    setCamera(gesture.cameraX + e.clientX - gesture.startX, gesture.cameraY + e.clientY - gesture.startY, camera.zoom);
}

function finishPan() {
    gesture = null;
    board.classList.remove('is-panning');
}

function setSpaceHeld(isHeld) {
    spaceHeld = isHeld;
    board.classList.toggle('space-pan', isHeld);
}

// A second finger means the first wasn't drawing or dragging after all, so that's undone.
function cancelGesture() {
    const changedBoard = Boolean(activeDrawing || eraser
        || (gesture && ['move', 'resize', 'rotate'].includes(gesture.kind)));
    if (gesture && gesture.kind === 'pan') {
        finishPan();
    }
    marqueeElement.hidden = true;
    gesture = null;
    activeDrawing = null;
    eraser = null;
    if (changedBoard) {
        restore(undoIndex);
    }
}

function touchMidpoint() {
    const [first, second] = [...touches.values()];
    return { x: (first.x + second.x) / 2, y: (first.y + second.y) / 2 };
}

function touchSpread() {
    const [first, second] = [...touches.values()];
    return Math.max(distance(first, second), 1);
}

function startPinch() {
    pinch = { spread: touchSpread(), zoom: camera.zoom, anchor: screenToBoard(touchMidpoint()) };
}

function continuePinch() {
    const zoom = clampZoom((pinch.zoom * touchSpread()) / pinch.spread);
    const middle = touchMidpoint();
    setCamera(middle.x - pinch.anchor.x * zoom, middle.y - pinch.anchor.y * zoom, zoom);
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

function isPoint(point) {
    return Boolean(point) && Number.isFinite(point.x) && Number.isFinite(point.y);
}

function isValidItem(item) {
    if (!item || !COLOR_PATTERN.test(item.color) || !Number.isFinite(item.rotation)) {
        return false;
    }
    if (item.type === 'text') {
        return typeof item.text === 'string'
            && Number.isFinite(item.x)
            && Number.isFinite(item.y)
            && Number.isFinite(item.fontSize)
            && (item.width === null || Number.isFinite(item.width));
    }
    return DRAWING_TYPES.includes(item.type)
        && Number.isFinite(item.strokeWidth)
        && Array.isArray(item.points)
        && item.points.length > 0
        && item.points.every(isPoint);
}

function normaliseItem(raw) {
    const base = {
        rotation: raw.rotation === undefined ? 0 : raw.rotation,
        locked: Boolean(raw.locked),
        groupId: typeof raw.groupId === 'string' ? raw.groupId : null,
    };
    if (raw.type === 'text') {
        return { ...raw, ...base, width: raw.width === undefined ? null : raw.width };
    }
    return { ...raw, ...base };
}

// Boards saved before everything became one list kept text and drawings apart, with text on top.
function legacyItems(data) {
    return [
        ...data.drawings.map(({ width, ...drawing }) => ({ ...drawing, strokeWidth: width })),
        ...data.boxes.map((box) => ({ ...box, type: 'text' })),
    ];
}

function parseBoard(json) {
    const data = JSON.parse(json);
    let raw = null;
    if (data && Array.isArray(data.items)) {
        raw = data.items;
    } else if (data && Array.isArray(data.boxes) && Array.isArray(data.drawings)) {
        raw = legacyItems(data);
    }
    if (!raw || !raw.every((item) => item && typeof item === 'object')) {
        throw new Error('Not a whiteboard file');
    }
    const parsed = raw.map(normaliseItem);
    if (!parsed.every(isValidItem)) {
        throw new Error('Not a whiteboard file');
    }
    return { name: data.name, items: parsed };
}

function setBoard(data) {
    const groupMap = new Map();
    items = data.items.map((item) => {
        let { groupId } = item;
        if (groupId !== null) {
            if (!groupMap.has(groupId)) {
                groupMap.set(groupId, 'g' + newId());
            }
            groupId = groupMap.get(groupId);
        }
        return { ...item, id: newId(), groupId };
    });
    cascade = items.filter(isText).length;
    selectedIds = [];
}

function loadSavedBoard() {
    try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
            setBoard(parseBoard(saved));
        }
    } catch (error) {
        items = []; // Storage is blocked or the saved data is damaged: start empty.
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
    const json = JSON.stringify({ name: boardName(), items });
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

function drawTextItem(target, item, box) {
    const style = window.getComputedStyle(elements.get(item.id));
    const lineHeight = parseFloat(style.lineHeight) || item.fontSize * 1.5;
    target.font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
    target.fillStyle = item.color;
    target.textBaseline = 'middle';

    const maxWidth = Math.ceil(box.w) - TEXT_PADDING * 2 + 1;
    wrapText(target, item.text, maxWidth).forEach((line, i) => {
        target.fillText(line, box.x + TEXT_PADDING, box.y + TEXT_PADDING + lineHeight * (i + 0.5));
    });
}

function drawStrokeItem(target, item) {
    target.strokeStyle = item.color;
    target.lineWidth = item.strokeWidth;
    target.lineCap = 'round';
    target.lineJoin = 'round';
    target.stroke(new Path2D(pathData(item)));
}

// The area to export: everything on the board with a margin, wherever the view happens to be.
function exportArea() {
    if (items.length === 0) {
        const size = viewportSize();
        return { x: 0, y: 0, w: size.w, h: size.h };
    }
    const bounds = boundsOfItems(items);
    const thickest = Math.max(0, ...items.filter((item) => !isText(item)).map((item) => item.strokeWidth));
    const margin = EXPORT_PADDING + thickest / 2;
    return {
        x: bounds.x - margin,
        y: bounds.y - margin,
        w: bounds.w + margin * 2,
        h: bounds.h + margin * 2,
    };
}

function exportPng() {
    const area = exportArea();
    const scale = Math.min(EXPORT_SCALE, EXPORT_MAX_SIZE / Math.max(area.w, area.h));
    const output = document.createElement('canvas');
    output.width = Math.round(area.w * scale);
    output.height = Math.round(area.h * scale);

    const target = output.getContext('2d');
    target.scale(scale, scale);
    target.translate(-area.x, -area.y);
    target.fillStyle = '#ffffff';
    target.fillRect(area.x, area.y, area.w, area.h);

    items.forEach((item) => {
        const box = itemBox(item);
        const centre = boxCentre(box);
        target.save();
        target.translate(centre.x, centre.y);
        target.rotate((item.rotation * Math.PI) / 180);
        target.translate(-centre.x, -centre.y);
        if (isText(item)) {
            drawTextItem(target, item, box);
        } else {
            drawStrokeItem(target, item);
        }
        target.restore();
    });

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
        select([]);
        fitToScreen();
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

board.addEventListener('wheel', function (e) {
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

    const key = e.key.toLowerCase();
    const command = e.ctrlKey || e.metaKey;
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
    const color = this.value;
    updateSelected((item) => {
        item.color = color;
    });
});

colorInput.addEventListener('change', commit);

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
});

toolButtons.forEach((button) => {
    button.addEventListener('click', () => setTool(button.dataset.tool));
});

document.getElementById('add-text-btn').addEventListener('click', addTextBox);
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

// --- Start ---

loadSavedBoard();
loadBoardName();
updateThemeButton();
loadView();
render();
drawCamera(false);
undoStack = [snapshot()];
setTool('select');
updateButtons();
