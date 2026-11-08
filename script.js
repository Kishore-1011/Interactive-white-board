const board = document.getElementById('white-board');
const fontSizeInput = document.getElementById('font-size');
const textColorInput = document.getElementById('text-color');

const CASCADE_START = 24;
const CASCADE_STEP = 28;
const CASCADE_LENGTH = 10;

// The board is plain data; the DOM is always drawn from it.
let boxes = [];
let selectedId = null;
let editingId = null;
let drag = null;
let nextId = 1;
let cascade = 0;

// Each history entry is a JSON snapshot of `boxes`. The empty board is the first entry.
const history = [JSON.stringify(boxes)];
let historyIndex = 0;

function findBox(id) {
    return boxes.find((box) => box.id === id);
}

function clampToBoard(element, x, y) {
    const boardRect = board.getBoundingClientRect();
    const elementRect = element.getBoundingClientRect();
    const maxX = Math.max(0, boardRect.width - elementRect.width);
    const maxY = Math.max(0, boardRect.height - elementRect.height);
    return {
        x: Math.min(Math.max(0, x), maxX),
        y: Math.min(Math.max(0, y), maxY),
    };
}

function createBoxElement(id) {
    const element = document.createElement('div');
    element.className = 'text-box';
    element.dataset.id = id;
    element.contentEditable = 'false';
    return element;
}

function updateSelectionStyles() {
    for (const element of board.children) {
        element.classList.toggle('selected', element.dataset.id === selectedId);
    }
}

// Existing elements are reused so a redraw never interrupts a drag or an edit in progress.
function render() {
    const elements = new Map([...board.children].map((element) => [element.dataset.id, element]));

    boxes.forEach((box, index) => {
        const element = elements.get(box.id) || createBoxElement(box.id);
        elements.delete(box.id);

        if (board.children[index] !== element) {
            board.insertBefore(element, board.children[index] || null);
        }
        if (box.id !== editingId && element.innerText !== box.text) {
            element.innerText = box.text;
        }
        element.style.fontSize = box.fontSize + 'px';
        element.style.color = box.color;

        const position = clampToBoard(element, box.x, box.y);
        box.x = position.x;
        box.y = position.y;
        element.style.left = box.x + 'px';
        element.style.top = box.y + 'px';
    });

    elements.forEach((element) => element.remove());
    updateSelectionStyles();
}

// Draw the board and add one undo step, unless nothing actually changed.
function commit() {
    render();
    const snapshot = JSON.stringify(boxes);
    if (snapshot === history[historyIndex]) {
        return;
    }
    history.splice(historyIndex + 1);
    history.push(snapshot);
    historyIndex++;
}

function restore(index) {
    historyIndex = index;
    boxes = JSON.parse(history[index]);
    if (!findBox(selectedId)) {
        selectedId = null;
    }
    render();
}

function undo() {
    if (historyIndex > 0) {
        restore(historyIndex - 1);
    }
}

function redo() {
    if (historyIndex < history.length - 1) {
        restore(historyIndex + 1);
    }
}

function select(id) {
    selectedId = id;
    updateSelectionStyles();
}

function addTextBox() {
    const offset = CASCADE_START + (cascade++ % CASCADE_LENGTH) * CASCADE_STEP;
    const box = {
        id: String(nextId++),
        text: 'New Text',
        x: offset,
        y: offset,
        fontSize: Number(fontSizeInput.value),
        color: textColorInput.value,
    };
    boxes.push(box);
    selectedId = box.id;
    commit();
}

function deleteSelected() {
    if (!findBox(selectedId)) {
        return;
    }
    boxes = boxes.filter((box) => box.id !== selectedId);
    selectedId = null;
    commit();
}

// Apply a style to the selected box. With nothing selected, the controls
// only set the defaults for the next new box.
function updateSelected(changes) {
    const box = findBox(selectedId);
    if (box) {
        Object.assign(box, changes);
        render();
    }
}

function selectAllText(element) {
    const range = document.createRange();
    range.selectNodeContents(element);
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
}

function fontSizeLimits() {
    return { min: Number(fontSizeInput.min), max: Number(fontSizeInput.max) };
}

board.addEventListener('mousedown', function (e) {
    const element = e.target.closest('.text-box');
    if (!element) {
        select(null);
        return;
    }

    select(element.dataset.id);
    if (element.dataset.id === editingId) {
        return; // Let the browser place the caret and select text.
    }

    const rect = element.getBoundingClientRect();
    drag = {
        box: findBox(element.dataset.id),
        element,
        offsetX: e.clientX - rect.left,
        offsetY: e.clientY - rect.top,
    };
});

document.addEventListener('mousemove', function (e) {
    if (!drag) {
        return;
    }
    const boardRect = board.getBoundingClientRect();
    const position = clampToBoard(
        drag.element,
        e.clientX - boardRect.left - drag.offsetX,
        e.clientY - boardRect.top - drag.offsetY
    );
    drag.box.x = position.x;
    drag.box.y = position.y;
    drag.element.style.left = position.x + 'px';
    drag.element.style.top = position.y + 'px';
});

document.addEventListener('mouseup', function () {
    if (drag) {
        drag = null;
        commit();
    }
});

board.addEventListener('dblclick', function (e) {
    const element = e.target.closest('.text-box');
    if (!element) {
        return;
    }
    editingId = element.dataset.id;
    element.contentEditable = 'true';
    element.focus();
    selectAllText(element);
});

board.addEventListener('focusout', function (e) {
    const element = e.target.closest('.text-box');
    if (!element || element.dataset.id !== editingId) {
        return;
    }
    const box = findBox(editingId);
    const text = element.innerText;
    if (text.trim()) {
        box.text = text; // A blank edit keeps the old text so the box can't become invisible.
    }
    editingId = null;
    element.contentEditable = 'false';
    commit();
});

// `input` previews the change live; `change` fires once at the end and records one undo step.
fontSizeInput.addEventListener('input', function () {
    const { min, max } = fontSizeLimits();
    const size = Number(this.value);
    if (size >= min && size <= max) {
        updateSelected({ fontSize: size });
    }
});

fontSizeInput.addEventListener('change', function () {
    const { min, max } = fontSizeLimits();
    const size = Math.min(max, Math.max(min, Number(this.value) || Number(this.defaultValue)));
    this.value = size;
    updateSelected({ fontSize: size });
    commit();
});

textColorInput.addEventListener('input', function () {
    updateSelected({ color: this.value });
});

textColorInput.addEventListener('change', commit);

window.addEventListener('resize', function () {
    if (!drag && !editingId) {
        render();
    }
});

document.getElementById('add-text-btn').addEventListener('click', addTextBox);
document.getElementById('undo-btn').addEventListener('click', undo);
document.getElementById('redo-btn').addEventListener('click', redo);
document.getElementById('delete-btn').addEventListener('click', deleteSelected);
