// --- Arrows that stay attached to objects ---

// True once the pointer has moved, so a plain tap with the arrow tool draws nothing.
let arrowDragged = false;
let attachHighlight = null;

function canAttachTo(item) {
    return item.type !== 'arrow' && item.type !== 'pen' && item.type !== 'line';
}

// The topmost object under this board position, leaving a little room around its edge.
function attachTargetAt(point, excludeId) {
    const margin = ATTACH_MARGIN / camera.zoom;
    return [...items].reverse().find((item) => {
        if (!canAttachTo(item) || item.id === excludeId) {
            return false;
        }
        const box = itemBox(item);
        const local = rotatePoint(point, boxCentre(box), -item.rotation);
        return local.x >= box.x - margin && local.x <= box.x + box.w + margin
            && local.y >= box.y - margin && local.y <= box.y + box.h + margin;
    }) || null;
}

// Where a line coming from `toward` meets the outside of this object.
function edgePoint(item, toward) {
    const box = itemBox(item);
    const centre = boxCentre(box);
    const local = rotatePoint(toward, centre, -item.rotation);
    const dx = local.x - centre.x;
    const dy = local.y - centre.y;
    if (dx === 0 && dy === 0) {
        return centre;
    }
    const halfW = box.w / 2 + ATTACH_GAP;
    const halfH = box.h / 2 + ATTACH_GAP;
    const scale = item.type === 'ellipse'
        ? 1 / Math.hypot(dx / halfW, dy / halfH)
        : 1 / Math.max(Math.abs(dx) / halfW, Math.abs(dy) / halfH);
    const edge = rotatePoint({ x: centre.x + dx * scale, y: centre.y + dy * scale }, centre, item.rotation);
    return { x: round(edge.x), y: round(edge.y) };
}

// Re-aim every attached arrow at what it's joined to. Deleted objects simply let go.
function refreshArrows() {
    items.forEach((arrow) => {
        if (arrow.type !== 'arrow' || (arrow === activeDrawing && !arrowDragged)) {
            return;
        }
        const start = arrow.startId ? findItem(arrow.startId) : null;
        const end = arrow.endId ? findItem(arrow.endId) : null;
        arrow.startId = start ? arrow.startId : null;
        arrow.endId = end ? arrow.endId : null;
        if (!start && !end) {
            return;
        }
        const startAim = start ? boxCentre(itemBox(start)) : arrow.points[0];
        const endAim = end ? boxCentre(itemBox(end)) : arrow.points[1];
        const points = [
            start ? edgePoint(start, endAim) : arrow.points[0],
            end ? edgePoint(end, startAim) : arrow.points[1],
        ];
        if (JSON.stringify(points) !== JSON.stringify(arrow.points)) {
            arrow.points = points;
            if (elements.has(arrow.id)) {
                renderItem(arrow);
            }
        }
    });
}

function setAttachHighlight(item) {
    if (attachHighlight) {
        attachHighlight.classList.remove('attach-target');
        attachHighlight = null;
    }
    if (item && elements.has(item.id)) {
        attachHighlight = elements.get(item.id);
        attachHighlight.classList.add('attach-target');
    }
}

function beginArrow(arrow, point) {
    const target = attachTargetAt(point, null);
    arrow.startId = target ? target.id : null;
    arrow.endId = null;
    arrowDragged = false;
    setAttachHighlight(target);
}

function updateArrowEnd(arrow, point) {
    arrowDragged = true;
    const target = attachTargetAt(point, arrow.startId);
    arrow.endId = target ? target.id : null;
    setAttachHighlight(target);
    refreshArrows();
}

// Returns whether the arrow is worth keeping.
function finishArrow() {
    const kept = arrowDragged;
    arrowDragged = false;
    setAttachHighlight(null);
    return kept;
}

// A selected arrow shows a handle on each end instead of a resize frame.
function updateArrowHandles() {
    const selected = selectedItems(); // During an undo, the selected object may no longer exist.
    const [arrow] = selected;
    const show = selected.length === 1 && arrow.type === 'arrow' && !arrow.locked && !editingId;
    arrowHandles.forEach((handle) => {
        handle.hidden = !show;
    });
    if (!show) {
        return;
    }
    const centre = boxCentre(pointsBox(arrow.points));
    arrow.points.forEach((point, index) => {
        const screen = boardToScreen(rotatePoint(point, centre, arrow.rotation));
        arrowHandles[index].style.left = screen.x + 'px';
        arrowHandles[index].style.top = screen.y + 'px';
        arrowHandles[index].classList.toggle('attached', Boolean(index ? arrow.endId : arrow.startId));
    });
}

function startArrowEnd(which) {
    const [arrow] = selectedItems();
    if (arrow.rotation) {
        const centre = boxCentre(pointsBox(arrow.points));
        arrow.points = arrow.points.map((point) => {
            const turned = rotatePoint(point, centre, arrow.rotation);
            return { x: round(turned.x), y: round(turned.y) };
        });
        arrow.rotation = 0;
    }
    gesture = { kind: 'arrow-end', arrow, which };
}

function continueArrowEnd(e) {
    const { arrow, which } = gesture;
    const point = boardPoint(e);
    const target = attachTargetAt(point, which ? arrow.startId : arrow.endId);
    arrow[which ? 'endId' : 'startId'] = target ? target.id : null;
    arrow.points[which] = snapDrawPoint(point, e);
    setAttachHighlight(target);
    refreshArrows();
    renderItem(arrow);
    updateFrame();
}

// Moving an arrow by itself pulls it off whatever it was joined to.
function detachSelectedArrows() {
    selectedItems().forEach((arrow) => {
        if (arrow.type !== 'arrow') {
            return;
        }
        if (arrow.startId && !selectedIds.includes(arrow.startId)) {
            arrow.startId = null;
        }
        if (arrow.endId && !selectedIds.includes(arrow.endId)) {
            arrow.endId = null;
        }
    });
}
