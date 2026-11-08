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
        points: tool === 'pen' ? [point] : [snapDrawPoint(point, e), snapDrawPoint(point, e)],
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
        activeDrawing.points[1] = snapDrawPoint(point, e);
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
