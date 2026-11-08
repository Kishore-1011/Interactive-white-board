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
