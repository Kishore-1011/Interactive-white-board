// --- Moving, resizing, rotating and rubber-band selection ---

function startMove(e, element, collapseTo) {
    const selected = selectedItems();
    gesture = {
        kind: 'move',
        startX: e.clientX,
        startY: e.clientY,
        element,
        collapseTo,
        bounds: boundsOfItems(selected),
        targets: snapTargets(),
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
    const snapped = snapMove(gesture.bounds, rawX / camera.zoom, rawY / camera.zoom, gesture.targets, e);
    gesture.starts.forEach(({ item, start }) => {
        moveItem(item, start, snapped.dx, snapped.dy);
        renderItem(item);
    });
    drawGuides(snapped.guides);
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
        targets: snapTargets(),
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
    const { hx, hy, frame, centre, targets } = gesture;
    const pointer = boardPoint(e);
    const canSnap = snapActive(e) && frame.rotation === 0; // Guides are upright, so only upright frames use them.
    if (canSnap && hx) {
        pointer.x += bestSnap([pointer.x], targets.x);
    }
    if (canSnap && hy) {
        pointer.y += bestSnap([pointer.y], targets.y);
    }
    const local = rotatePoint(pointer, centre, -frame.rotation);
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
    drawGuides(canSnap ? resizeGuides(newCentre, newW, newH) : []);
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
    drawGuides([]);
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
