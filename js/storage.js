// --- Saving and opening ---

function isPoint(point) {
    return Boolean(point) && Number.isFinite(point.x) && Number.isFinite(point.y);
}

function isValidItem(item) {
    if (!item || !Number.isFinite(item.rotation) || !Number.isFinite(item.opacity)) {
        return false;
    }
    if (item.type === 'image') {
        return typeof item.assetId === 'string'
            && [item.x, item.y, item.w, item.h].every(Number.isFinite);
    }
    if (!COLOR_PATTERN.test(item.color) || !(item.fill === null || COLOR_PATTERN.test(item.fill))) {
        return false;
    }
    if (item.type === 'text') {
        return typeof item.text === 'string'
            && Number.isFinite(item.x)
            && Number.isFinite(item.y)
            && Number.isFinite(item.fontSize)
            && (item.width === null || Number.isFinite(item.width))
            && (item.height === null || Number.isFinite(item.height))
            && item.fontFamily in FONTS
            && TEXT_ALIGNMENTS.includes(item.align);
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
        opacity: raw.opacity === undefined ? 1 : raw.opacity,
    };
    if (raw.type === 'image') {
        return { ...raw, ...base };
    }
    const fill = raw.fill === undefined ? null : raw.fill;
    if (raw.type === 'text') {
        return {
            ...raw,
            ...base,
            fill,
            width: raw.width === undefined ? null : raw.width,
            height: raw.height === undefined ? null : raw.height,
            fontFamily: raw.fontFamily === undefined ? 'sans' : raw.fontFamily,
            bold: Boolean(raw.bold),
            align: raw.align === undefined ? 'left' : raw.align,
            note: Boolean(raw.note),
        };
    }
    if (raw.type === 'arrow') {
        return {
            ...raw,
            ...base,
            fill: null,
            startId: typeof raw.startId === 'string' ? raw.startId : null,
            endId: typeof raw.endId === 'string' ? raw.endId : null,
        };
    }
    return { ...raw, ...base, fill };
}

// Boards saved before everything became one list kept text and drawings apart, with text on top.
function legacyItems(data) {
    return [
        ...data.drawings.map(({ width, ...drawing }) => ({ ...drawing, strokeWidth: width })),
        ...data.boxes.map((box) => ({ ...box, type: 'text' })),
    ];
}

function parseBoard(json, storedAssets) {
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
    const boardAssets = validAssets(data.assets || storedAssets);
    return {
        name: data.name,
        items: parsed.filter((item) => !isImage(item) || boardAssets[item.assetId]), // Skip pictures that are missing.
        assets: boardAssets,
    };
}

function setBoard(data) {
    const groupMap = new Map();
    const idMap = new Map();
    const assetMap = new Map();
    Object.entries(data.assets).forEach(([key, source]) => {
        const assetId = 'a' + newId();
        assets.set(assetId, source);
        assetMap.set(key, assetId);
    });
    items = data.items.map((item) => {
        let { groupId } = item;
        if (groupId !== null) {
            if (!groupMap.has(groupId)) {
                groupMap.set(groupId, 'g' + newId());
            }
            groupId = groupMap.get(groupId);
        }
        const id = newId();
        idMap.set(item.id, id);
        const copy = { ...item, id, groupId };
        if (isImage(copy)) {
            copy.assetId = assetMap.get(item.assetId);
        }
        return copy;
    });
    items.filter((item) => item.type === 'arrow').forEach((arrow) => {
        arrow.startId = idMap.get(arrow.startId) || null;
        arrow.endId = idMap.get(arrow.endId) || null;
    });
    cascade = items.filter(isText).length;
    selectedIds = [];
}

function loadSavedBoard() {
    try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
            setBoard(parseBoard(saved, JSON.parse(localStorage.getItem(ASSETS_STORAGE_KEY))));
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
    const json = JSON.stringify({ name: boardName(), items, assets: usedAssets() });
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
    if (item.fill) {
        target.fillStyle = item.fill;
        target.fillRect(box.x, box.y, box.w, box.h);
    }
    if (item.note) {
        target.beginPath();
        target.rect(box.x, box.y, box.w, box.h);
        target.clip(); // Text that doesn't fit a note is cut off, the same as on screen.
    }
    target.fillStyle = item.color;
    target.textBaseline = 'middle';
    target.textAlign = item.align;

    const padding = item.note ? NOTE_PADDING : TEXT_PADDING;
    const textX = {
        left: box.x + padding,
        center: box.x + box.w / 2,
        right: box.x + box.w - padding,
    }[item.align];
    const maxWidth = Math.ceil(box.w) - padding * 2 + 1;
    wrapText(target, item.text, maxWidth).forEach((line, i) => {
        target.fillText(line, textX, box.y + padding + lineHeight * (i + 0.5));
    });
}

function drawImageItem(target, item, box) {
    const image = elements.get(item.id).firstChild;
    if (image.complete && image.naturalWidth > 0) {
        target.drawImage(image, box.x, box.y, box.w, box.h);
    }
}

function drawStrokeItem(target, item) {
    target.strokeStyle = item.color;
    target.lineWidth = item.strokeWidth;
    target.lineCap = 'round';
    target.lineJoin = 'round';
    const path = new Path2D(pathData(item));
    if (item.fill) {
        target.fillStyle = item.fill;
        target.fill(path);
    }
    target.stroke(path);
}

// The area to export: everything on the board with a margin, wherever the view happens to be.
function exportArea() {
    if (items.length === 0) {
        const size = viewportSize();
        return { x: 0, y: 0, w: size.w, h: size.h };
    }
    const bounds = boundsOfItems(items);
    const thickest = Math.max(0, ...items.filter(isDrawing).map((item) => item.strokeWidth));
    const margin = EXPORT_PADDING + thickest / 2;
    return {
        x: bounds.x - margin,
        y: bounds.y - margin,
        w: bounds.w + margin * 2,
        h: bounds.h + margin * 2,
    };
}

function drawExportItem(target, item) {
    const box = itemBox(item);
    const centre = boxCentre(box);
    target.save();
    target.translate(centre.x, centre.y);
    target.rotate((item.rotation * Math.PI) / 180);
    target.translate(-centre.x, -centre.y);
    if (isText(item)) {
        drawTextItem(target, item, box);
    } else if (isImage(item)) {
        drawImageItem(target, item, box);
    } else {
        drawStrokeItem(target, item);
    }
    target.restore();
}

function exportPng() {
    const area = exportArea();
    const scale = Math.min(EXPORT_SCALE, EXPORT_MAX_SIZE / Math.max(area.w, area.h));
    const output = document.createElement('canvas');
    output.width = Math.round(area.w * scale);
    output.height = Math.round(area.h * scale);

    const prepare = (canvas) => {
        const context = canvas.getContext('2d');
        context.scale(scale, scale);
        context.translate(-area.x, -area.y);
        return context;
    };
    const target = prepare(output);
    target.fillStyle = '#ffffff';
    target.fillRect(area.x, area.y, area.w, area.h);

    items.forEach((item) => {
        if (item.opacity >= 1) {
            drawExportItem(target, item);
            return;
        }
        // Fade the finished object as one piece, so overlapping fill and outline match the screen.
        const layer = document.createElement('canvas');
        layer.width = output.width;
        layer.height = output.height;
        drawExportItem(prepare(layer), item);
        target.save();
        target.setTransform(1, 0, 0, 1, 0, 0);
        target.globalAlpha = item.opacity;
        target.drawImage(layer, 0, 0);
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
