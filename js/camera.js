// --- Panning and zooming ---

function clampZoom(zoom) {
    return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom));
}

function updateDots() {
    let spacing = GRID_SIZE * camera.zoom;
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
        || (gesture && ['move', 'resize', 'rotate', 'arrow-end'].includes(gesture.kind)));
    if (gesture && gesture.kind === 'pan') {
        finishPan();
    }
    marqueeElement.hidden = true;
    drawGuides([]);
    setAttachHighlight(null);
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
