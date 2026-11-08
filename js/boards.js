// --- Multiple saved boards ---

// The open board always lives in the main storage keys, so saving works the same with
// one board or many. Every other board is packed into a single key of its own.

let boardsIndex = [];
let currentBoardId = null;

function newBoardId() {
    return `b${Date.now()}-${newId()}`;
}

function parkedKey(id) {
    return `${PARKED_BOARD_PREFIX}${id}`;
}

function persistBoardsIndex() {
    try {
        localStorage.setItem(BOARDS_STORAGE_KEY, JSON.stringify({ current: currentBoardId, boards: boardsIndex }));
    } catch (error) {
        setSaveState(false);
    }
}

function currentBoardEntry() {
    return boardsIndex.find((entry) => entry.id === currentBoardId);
}

function touchCurrentBoard() {
    const entry = currentBoardEntry();
    if (entry) {
        entry.updatedAt = Date.now();
        persistBoardsIndex();
    }
}

function renameCurrentBoard(name) {
    const entry = currentBoardEntry();
    if (entry) {
        entry.name = name;
        persistBoardsIndex();
    }
}

function isValidBoardsIndex(saved) {
    return Boolean(saved)
        && Array.isArray(saved.boards)
        && saved.boards.length > 0
        && saved.boards.every((entry) => entry && typeof entry.id === 'string' && typeof entry.name === 'string')
        && saved.boards.some((entry) => entry.id === saved.current);
}

function initBoards() {
    let saved = null;
    try {
        saved = JSON.parse(localStorage.getItem(BOARDS_STORAGE_KEY));
    } catch (error) {
        saved = null;
    }
    if (isValidBoardsIndex(saved)) {
        boardsIndex = saved.boards;
        currentBoardId = saved.current;
    } else {
        currentBoardId = newBoardId();
        boardsIndex = [{ id: currentBoardId, name: boardName(), updatedAt: Date.now() }];
        persistBoardsIndex();
    }
}

function readActiveBoard() {
    const active = {};
    ACTIVE_BOARD_KEYS.forEach((key) => {
        active[key] = localStorage.getItem(key);
    });
    return active;
}

function writeActiveBoard(data) {
    ACTIVE_BOARD_KEYS.forEach((key) => {
        if (data[key] === null || data[key] === undefined) {
            localStorage.removeItem(key);
        } else {
            localStorage.setItem(key, data[key]);
        }
    });
}

function saveViewNow() {
    clearTimeout(viewSaveTimer);
    localStorage.setItem(VIEW_STORAGE_KEY, JSON.stringify(camera));
}

// Put the open board away and make `nextActive` the open one. Everything is
// rolled back if storage runs out, so a failed switch can never lose a board.
function parkCurrentBoard(nextActive, targetId) {
    const targetRaw = targetId ? localStorage.getItem(parkedKey(targetId)) : null;
    let current = null;
    try {
        finishEditing();
        save(snapshot());
        if (saveState.dataset.state === 'error') {
            throw new Error('Not saved');
        }
        saveViewNow();
        current = readActiveBoard();
        writeActiveBoard({});
        localStorage.setItem(parkedKey(currentBoardId), JSON.stringify(current));
        if (targetId) {
            localStorage.removeItem(parkedKey(targetId));
        }
        writeActiveBoard(nextActive);
        return true;
    } catch (error) {
        try {
            localStorage.removeItem(parkedKey(currentBoardId));
            if (current) {
                writeActiveBoard(current);
            }
            if (targetRaw) {
                localStorage.setItem(parkedKey(targetId), targetRaw);
            }
        } catch (rollbackError) {
            // Storage is full; what's on screen is still intact and can be exported.
        }
        showToast("There's no room to save this board. Export it, then try again.");
        return false;
    }
}

// Show whichever board is in the main storage keys, starting from a clean slate.
function loadCurrentBoard() {
    clearTimeout(viewSaveTimer);
    items = [];
    selectedIds = [];
    editingId = null;
    cascade = 0;
    assets.clear();
    savedAssetKeys = null;
    camera.x = 0;
    camera.y = 0;
    camera.zoom = 1;
    loadSavedBoard();
    loadBoardName();
    loadView();
    render();
    drawCamera(true);
    undoStack = [snapshot()];
    undoIndex = 0;
    syncControls();
    updateButtons();
    lastAssetLoad = finishAssetLoading();
}

function createBoard() {
    if (!parkCurrentBoard({}, null)) {
        return false;
    }
    currentBoardId = newBoardId();
    boardsIndex.unshift({ id: currentBoardId, name: DEFAULT_BOARD_NAME, updatedAt: Date.now() });
    persistBoardsIndex();
    loadCurrentBoard();
    return true;
}

function parkedBoardData(id) {
    try {
        return JSON.parse(localStorage.getItem(parkedKey(id))) || {};
    } catch (error) {
        return {};
    }
}

function switchBoard(id) {
    if (id === currentBoardId || !parkCurrentBoard(parkedBoardData(id), id)) {
        return;
    }
    currentBoardId = id;
    persistBoardsIndex();
    loadCurrentBoard();
}

function deleteBoard(id) {
    if (boardsIndex.length < 2) {
        return;
    }
    if (id === currentBoardId) {
        const next = boardsIndex.find((entry) => entry.id !== id);
        const data = parkedBoardData(next.id);
        localStorage.removeItem(parkedKey(next.id));
        writeActiveBoard(data);
        currentBoardId = next.id;
        loadCurrentBoard();
    } else {
        localStorage.removeItem(parkedKey(id));
    }
    boardsIndex = boardsIndex.filter((entry) => entry.id !== id);
    persistBoardsIndex();
}

function boardEditedLabel(entry) {
    return entry.updatedAt ? `Edited ${new Date(entry.updatedAt).toLocaleDateString()}` : '';
}

function createBoardRow(entry) {
    const row = document.createElement('div');
    row.className = 'board-row';
    row.dataset.id = entry.id;

    const open = document.createElement('button');
    open.type = 'button';
    open.className = 'board-open';
    const name = document.createElement('strong');
    name.textContent = entry.name;
    const detail = document.createElement('span');
    detail.textContent = entry.id === currentBoardId ? 'Open now' : boardEditedLabel(entry);
    open.append(name, detail);
    open.addEventListener('click', () => {
        switchBoard(entry.id);
        boardsDialog.close();
    });

    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'board-delete';
    remove.textContent = 'Delete';
    remove.setAttribute('aria-label', `Delete ${entry.name}`);
    remove.disabled = boardsIndex.length < 2;
    remove.addEventListener('click', () => {
        if (remove.dataset.confirm) {
            deleteBoard(entry.id);
            drawBoardsList();
        } else {
            remove.dataset.confirm = 'true';
            remove.textContent = 'Really delete?';
        }
    });

    row.append(open, remove);
    return row;
}

function drawBoardsList() {
    boardsList.replaceChildren(...boardsIndex.map(createBoardRow));
}

function openBoardsDialog() {
    drawBoardsList();
    boardsDialog.showModal();
}

function startNewBoard() {
    const isBlank = items.length === 0 && boardName() === DEFAULT_BOARD_NAME;
    if (isBlank || createBoard()) {
        boardsDialog.close();
    }
}
