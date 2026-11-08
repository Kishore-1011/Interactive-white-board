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
