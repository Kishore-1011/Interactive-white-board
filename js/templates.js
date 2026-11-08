// --- Starter templates ---

function templateBuilder() {
    let id = 0;
    const base = () => ({ id: String(++id), rotation: 0 });
    const blockColour = '#334155';
    return {
        note: (x, y, text, fill = NOTE_FILL, size = 170) => ({
            ...base(), type: 'text', text, x, y, width: size, height: size * 0.8, fontSize: 18,
            color: NOTE_TEXT_COLOR, fill, note: true,
        }),
        heading: (x, y, width, text, size = 26) => ({
            ...base(), type: 'text', text, x, y, width, fontSize: size, color: '#111827', bold: true, align: 'center',
        }),
        box: (x, y, w, h, fill = null, type = 'rectangle', text = '') => ({
            ...base(), type, points: [{ x, y }, { x: x + w, y: y + h }], color: blockColour, strokeWidth: 3, fill, text,
            fontSize: 18,
        }),
        arrow: (from, to) => ({
            ...base(), type: 'arrow', points: [{ x: 0, y: 0 }, { x: 1, y: 1 }], color: blockColour, strokeWidth: 3,
            startId: from.id, endId: to.id,
        }),
    };
}

function columnsTemplate(headings, fills, perColumn) {
    const t = templateBuilder();
    const columnWidth = 230;
    const gap = 24;
    const result = [];
    headings.forEach((heading, column) => {
        const x = column * (columnWidth + gap);
        result.push(t.box(x, 0, columnWidth, 760, '#f8fafc'));
        result.push(t.heading(x, 16, columnWidth, heading, 24));
        for (let row = 0; row < perColumn; row++) {
            result.push(t.note(x + 30, 80 + row * 160, '', fills[column % fills.length]));
        }
    });
    return result;
}

const TEMPLATES = [
    {
        name: 'Brainstorm',
        description: 'One big idea with thoughts around it',
        build() {
            const t = templateBuilder();
            const centre = t.box(330, 240, 260, 150, '#e0e7ff', 'ellipse', 'Main idea');
            const notes = [
                t.note(0, 0, 'Idea'), t.note(375, -60, 'Idea', '#bfdbfe'), t.note(750, 0, 'Idea', '#bbf7d0'),
                t.note(0, 420, 'Idea', '#fecaca'), t.note(375, 540, 'Idea', '#e9d5ff'), t.note(750, 420, 'Idea', '#fed7aa'),
            ];
            return [centre, ...notes, ...notes.map((note) => t.arrow(centre, note))];
        },
    },
    {
        name: 'Flowchart',
        description: 'Steps and a decision, already connected',
        build() {
            const t = templateBuilder();
            const start = t.box(280, 0, 200, 80, '#bbf7d0', 'ellipse', 'Start');
            const step = t.box(280, 150, 200, 90, '#dbeafe', 'rectangle', 'Do something');
            const decision = t.box(280, 310, 200, 90, '#fef08a', 'rectangle', 'Decide?');
            const yes = t.box(0, 480, 200, 90, '#dbeafe', 'rectangle', 'Yes');
            const no = t.box(560, 480, 200, 90, '#fecaca', 'rectangle', 'No');
            return [
                start, step, decision, yes, no,
                t.arrow(start, step), t.arrow(step, decision), t.arrow(decision, yes), t.arrow(decision, no),
            ];
        },
    },
    {
        name: 'Kanban',
        description: 'To do, doing and done columns',
        build: () => columnsTemplate(['To do', 'Doing', 'Done'], ['#fef08a', '#bfdbfe', '#bbf7d0'], 4),
    },
    {
        name: 'Retrospective',
        description: 'What went well and what to change',
        build: () => columnsTemplate(['Went well', 'To improve', 'Actions'], ['#bbf7d0', '#fecaca', '#bfdbfe'], 4),
    },
    {
        name: 'Weekly plan',
        description: 'A column for each working day',
        build: () => columnsTemplate(['Mon', 'Tue', 'Wed', 'Thu', 'Fri'], ['#fef08a'], 3),
    },
];

// A small picture of a template, drawn from the same data the board uses.
function templatePreview(templateItems) {
    const parts = templateItems.map((raw) => {
        const item = { fill: null, ...raw };
        if (item.type === 'text') {
            const height = item.note ? item.height : item.fontSize * 1.4;
            return `<rect x="${item.x}" y="${item.y}" width="${item.width}" height="${height}" fill="${item.fill || 'none'}"/>`;
        }
        return '';
    });
    const bounds = pointsBox(templateItems.flatMap((item) => (item.type === 'text'
        ? [{ x: item.x, y: item.y }, { x: item.x + item.width, y: item.y + (item.height || item.fontSize * 1.4) }]
        : item.type === 'arrow' ? [] : item.points)));
    const shapes = templateItems.filter((item) => item.type !== 'text' && item.type !== 'arrow').map((item) => {
        const fill = item.fill || 'none';
        return `<path d="${pathData(item)}" fill="${fill}" stroke="#94a3b8" stroke-width="4"/>`;
    });
    const pad = 12;
    const viewBox = `${bounds.x - pad} ${bounds.y - pad} ${bounds.w + pad * 2} ${bounds.h + pad * 2}`;
    return `<svg viewBox="${viewBox}" aria-hidden="true">${shapes.join('')}${parts.join('')}</svg>`;
}

function useTemplate(template) {
    if (items.length > 0 && !createBoard()) {
        return; // Never overwrite work: a template on a busy board opens as a new one.
    }
    setBoard(parseBoard(JSON.stringify({ items: template.build() }), null));
    render();
    undoStack = [snapshot()];
    undoIndex = 0;
    save(undoStack[0]);
    touchCurrentBoard();
    setBoardName(template.name);
    select([]);
    fitToScreen();
    templatesDialog.close();
    if (boardsDialog.open) {
        boardsDialog.close();
    }
}

function buildTemplates() {
    templatesList.replaceChildren(...TEMPLATES.map((template) => {
        const card = document.createElement('button');
        card.type = 'button';
        card.className = 'template-card';
        card.innerHTML = templatePreview(template.build());
        const name = document.createElement('strong');
        name.textContent = template.name;
        const detail = document.createElement('span');
        detail.textContent = template.description;
        card.append(name, detail);
        card.addEventListener('click', () => useTemplate(template));
        return card;
    }));
}
