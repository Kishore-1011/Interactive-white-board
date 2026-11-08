// --- Long-term image storage ---

// Pictures live in IndexedDB, which holds far more than localStorage. The board itself stays
// in localStorage and only refers to pictures by id, so it can still load instantly; the
// pictures arrive a moment later. If IndexedDB isn't available, images.js falls back to
// keeping them in localStorage.

const assetDbReady = new Promise((resolve) => {
    let request;
    try {
        request = indexedDB.open(ASSET_DB_NAME, 1);
    } catch (error) {
        resolve(null);
        return;
    }
    request.onupgradeneeded = () => request.result.createObjectStore(ASSET_STORE_NAME);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => resolve(null);
}).then((db) => {
    assetDb = db;
    return db;
});

function runAssetTransaction(db, mode, work) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(ASSET_STORE_NAME, mode);
        const result = work(transaction.objectStore(ASSET_STORE_NAME));
        transaction.oncomplete = () => resolve(result);
        transaction.onerror = () => reject(transaction.error);
        transaction.onabort = () => reject(transaction.error);
    });
}

function storeAsset(id, source) {
    const write = assetDbReady.then((db) => {
        if (db) {
            return runAssetTransaction(db, 'readwrite', (store) => store.put(source, id));
        }
        return null;
    }).catch(() => {
        assetWriteFailed = true;
        setSaveState(false);
        showToast("This picture couldn't be saved. Export your board to keep it.");
    });
    pendingAssetWrites.push(write);
}

function readAssets(db, ids) {
    const found = new Map();
    return runAssetTransaction(db, 'readonly', (store) => {
        ids.forEach((id) => {
            const request = store.get(id);
            request.onsuccess = () => {
                if (typeof request.result === 'string') {
                    found.set(id, request.result);
                }
            };
        });
    }).then(() => found);
}

function readLegacyAssets() {
    try {
        return JSON.parse(localStorage.getItem(ASSETS_STORAGE_KEY));
    } catch (error) {
        return null;
    }
}

// Fetch the open board's pictures, and move any still held in localStorage into IndexedDB.
async function finishAssetLoading() {
    const token = ++assetLoadToken;
    const db = await assetDbReady;
    const hadLegacy = localStorage.getItem(ASSETS_STORAGE_KEY) !== null;
    let found = new Map();
    try {
        await Promise.all(pendingAssetWrites);
        pendingAssetWrites = [];
        const needed = items.filter((item) => isImage(item) && !assets.has(item.assetId)).map((item) => item.assetId);
        if (db && needed.length > 0) {
            found = await readAssets(db, needed);
        }
    } catch (error) {
        setSaveState(false); // Leave the board as it is rather than dropping pictures we couldn't read.
        return;
    }
    if (token !== assetLoadToken) {
        return; // Another board was opened while this one was loading.
    }

    found.forEach((source, id) => assets.set(id, source));
    const before = items.length;
    items = items.filter((item) => !isImage(item) || assets.has(item.assetId));
    render();
    if (items.length !== before && undoStack.length === 1) {
        undoStack = [snapshot()]; // Pictures that no longer exist shouldn't come back with undo.
        undoIndex = 0;
        updateButtons();
    }
    if (db && hadLegacy && !assetWriteFailed) {
        localStorage.setItem(STORAGE_KEY, snapshot());
        localStorage.removeItem(ASSETS_STORAGE_KEY);
    }
}

function assetIdsInBoardJson(json) {
    if (!json) {
        return [];
    }
    return (JSON.parse(json).items || []).filter((item) => item && item.type === 'image').map((item) => item.assetId);
}

// Delete stored pictures that no board uses any more. Runs once at startup, so pictures
// removed during a session stay available to undo. Any doubt about a board means no cleanup.
async function cleanUpAssets() {
    const db = await assetDbReady;
    if (!db) {
        return;
    }
    const used = new Set(items.filter(isImage).map((item) => item.assetId));
    Object.keys(localStorage).filter((key) => key.startsWith(PARKED_BOARD_PREFIX)).forEach((key) => {
        const parked = JSON.parse(localStorage.getItem(key));
        assetIdsInBoardJson(parked[STORAGE_KEY]).forEach((id) => used.add(id));
    });
    const keys = await runAssetTransaction(db, 'readonly', (store) => store.getAllKeys());
    const orphans = keys.result.filter((key) => !used.has(key));
    if (orphans.length > 0) {
        await runAssetTransaction(db, 'readwrite', (store) => orphans.forEach((key) => store.delete(key)));
    }
}
