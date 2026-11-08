// --- Snapping and alignment ---

function snapActive(e) {
    return settings.snap && !e.ctrlKey && !e.metaKey; // Holding Ctrl places things freely.
}

function nearestGridLine(value) {
    return Math.round(value / GRID_SIZE) * GRID_SIZE;
}

function snapDrawPoint(point, e) {
    if (!settings.grid || !snapActive(e)) {
        return point;
    }
    return { x: nearestGridLine(point.x), y: nearestGridLine(point.y) };
}

// The edges and centres of every other object in view, which a moving object can line up with.
function snapTargets() {
    const origin = screenToBoard({ x: 0, y: 0 });
    const size = viewportSize();
    const view = { x: origin.x, y: origin.y, w: size.w / camera.zoom, h: size.h / camera.zoom };
    const targets = { x: [], y: [] };
    items
        .filter((item) => !selectedIds.includes(item.id))
        .map((item) => boundsOfItems([item]))
        .filter((box) => boxesTouch(view, box))
        .forEach((box) => {
            [box.x, box.x + box.w / 2, box.x + box.w].forEach((position) => {
                targets.x.push({ position, from: box.y, to: box.y + box.h });
            });
            [box.y, box.y + box.h / 2, box.y + box.h].forEach((position) => {
                targets.y.push({ position, from: box.x, to: box.x + box.w });
            });
        });
    return targets;
}

// How far to nudge these lines to reach the closest target. Objects win over the grid.
function bestSnap(lines, targets) {
    const reach = SNAP_DISTANCE / camera.zoom;
    let best = null;
    lines.forEach((line) => {
        targets.forEach(({ position }) => {
            const difference = position - line;
            if (Math.abs(difference) <= reach && (best === null || Math.abs(difference) < Math.abs(best))) {
                best = difference;
            }
        });
    });
    if (best === null && settings.grid) {
        const difference = nearestGridLine(lines[0]) - lines[0];
        if (Math.abs(difference) <= reach) {
            best = difference;
        }
    }
    return best === null ? 0 : best;
}

// One guide per lined-up position, long enough to reach everything sharing it.
function guidesFor(axis, lines, targets, from, to) {
    const guides = new Map();
    targets.forEach((target) => {
        if (lines.some((line) => Math.abs(line - target.position) <= GUIDE_TOLERANCE)) {
            const guide = guides.get(target.position) || { axis, position: target.position, from, to };
            guide.from = Math.min(guide.from, target.from);
            guide.to = Math.max(guide.to, target.to);
            guides.set(target.position, guide);
        }
    });
    return [...guides.values()];
}

function snapMove(bounds, rawX, rawY, targets, e) {
    if (!snapActive(e)) {
        return { dx: rawX, dy: rawY, guides: [] };
    }
    const lineSet = (start, length) => [start, start + length / 2, start + length];
    const dx = rawX + bestSnap(lineSet(bounds.x + rawX, bounds.w), targets.x);
    const dy = rawY + bestSnap(lineSet(bounds.y + rawY, bounds.h), targets.y);
    const left = bounds.x + dx;
    const top = bounds.y + dy;
    return {
        dx,
        dy,
        guides: [
            ...guidesFor('x', lineSet(left, bounds.w), targets.x, top, top + bounds.h),
            ...guidesFor('y', lineSet(top, bounds.h), targets.y, left, left + bounds.w),
        ],
    };
}

function resizeGuides(newCentre, newW, newH) {
    const { hx, hy, targets } = gesture;
    const left = newCentre.x - newW / 2;
    const top = newCentre.y - newH / 2;
    const movingX = hx > 0 ? left + newW : left;
    const movingY = hy > 0 ? top + newH : top;
    return [
        ...(hx ? guidesFor('x', [movingX], targets.x, top, top + newH) : []),
        ...(hy ? guidesFor('y', [movingY], targets.y, left, left + newW) : []),
    ];
}

function drawGuides(guides) {
    guideLayer.replaceChildren(...guides.map((guide) => {
        const element = document.createElement('div');
        element.className = 'guide';
        const start = guide.axis === 'x'
            ? boardToScreen({ x: guide.position, y: guide.from })
            : boardToScreen({ x: guide.from, y: guide.position });
        const length = (guide.to - guide.from) * camera.zoom;
        element.style.left = start.x + 'px';
        element.style.top = start.y + 'px';
        element.style.width = guide.axis === 'x' ? '1px' : length + 'px';
        element.style.height = guide.axis === 'x' ? length + 'px' : '1px';
        return element;
    }));
}

function setAlignMenu(isOpen) {
    setPopover(alignMenu, alignButton, isOpen);
}

// What lines up as a single piece: each group counts as one, unless a group is
// all that's selected, in which case its members line up with each other.
function alignUnits() {
    const selected = selectedItems();
    if (isGroupedSelection()) {
        return selected.map((item) => [item]);
    }
    const units = new Map();
    selected.forEach((item) => {
        const key = item.groupId === null ? item.id : item.groupId;
        units.set(key, [...(units.get(key) || []), item]);
    });
    return [...units.values()];
}

function moveUnit(unit, dx, dy) {
    unit.forEach((item) => moveItem(item, clone(item), dx, dy));
}

function alignSelection(mode) {
    const units = alignUnits();
    if (units.length < 2 || selectionLocked()) {
        return;
    }
    const area = boundsOfItems(selectedItems());
    units.forEach((unit) => {
        const box = boundsOfItems(unit);
        const offsets = {
            left: [area.x - box.x, 0],
            centre: [area.x + area.w / 2 - (box.x + box.w / 2), 0],
            right: [area.x + area.w - (box.x + box.w), 0],
            top: [0, area.y - box.y],
            middle: [0, area.y + area.h / 2 - (box.y + box.h / 2)],
            bottom: [0, area.y + area.h - (box.y + box.h)],
        };
        moveUnit(unit, ...offsets[mode]);
    });
    commit();
}

// Even out the gaps between pieces. The first and last pieces stay where they are.
function distributeSelection(axis) {
    const units = alignUnits();
    if (units.length < 3 || selectionLocked()) {
        return;
    }
    const start = axis === 'x' ? 'x' : 'y';
    const length = axis === 'x' ? 'w' : 'h';
    const entries = units
        .map((unit) => ({ unit, box: boundsOfItems(unit) }))
        .sort((a, b) => (a.box[start] + a.box[length] / 2) - (b.box[start] + b.box[length] / 2));
    const first = entries[0].box;
    const last = entries[entries.length - 1].box;
    const span = last[start] + last[length] - first[start];
    const used = entries.reduce((sum, entry) => sum + entry.box[length], 0);
    const gap = (span - used) / (entries.length - 1);

    let cursor = first[start];
    entries.forEach(({ unit, box }) => {
        const shift = cursor - box[start];
        moveUnit(unit, axis === 'x' ? shift : 0, axis === 'x' ? 0 : shift);
        cursor += box[length] + gap;
    });
    commit();
}

function drawSettings() {
    board.classList.toggle('grid-on', settings.grid);
    gridButton.classList.toggle('active', settings.grid);
    gridButton.setAttribute('aria-pressed', String(settings.grid));
    snapButton.classList.toggle('active', settings.snap);
    snapButton.setAttribute('aria-pressed', String(settings.snap));
}

function toggleSetting(name) {
    settings[name] = !settings[name];
    drawSettings();
    try {
        localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
    } catch (error) {
        // The setting still applies for this visit; it just won't be remembered.
    }
}

function loadSettings() {
    try {
        const saved = JSON.parse(localStorage.getItem(SETTINGS_STORAGE_KEY));
        if (saved && typeof saved.grid === 'boolean' && typeof saved.snap === 'boolean') {
            settings.grid = saved.grid;
            settings.snap = saved.snap;
        }
    } catch (error) {
        // No usable settings saved: keep the defaults.
    }
}
