// --- Images ---

// Image data is kept apart from the board so undo history doesn't copy it on every change.

function loadImageFile(file) {
    return new Promise((resolve, reject) => {
        const url = URL.createObjectURL(file);
        const image = new Image();
        image.onload = () => resolve({ image, url });
        image.onerror = () => {
            URL.revokeObjectURL(url);
            reject(new Error('Unreadable image'));
        };
        image.src = url;
    });
}

// Shrink large pictures so a board stays small enough to autosave.
async function prepareImage(file) {
    const { image, url } = await loadImageFile(file);
    const scale = Math.min(1, IMAGE_MAX_SIZE / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height);
    URL.revokeObjectURL(url);
    const type = file.type === 'image/jpeg' ? 'image/jpeg' : 'image/webp'; // WebP keeps transparency.
    return { src: canvas.toDataURL(type, IMAGE_QUALITY), width: canvas.width, height: canvas.height };
}

function createImageItem({ src, width, height }, centre) {
    const assetId = newAssetId();
    assets.set(assetId, src);
    storeAsset(assetId, src);
    const view = viewportSize();
    const limit = Math.min(IMAGE_PLACE_SIZE, (Math.min(view.w, view.h) * IMAGE_VIEW_SHARE) / camera.zoom);
    const scale = Math.min(1, limit / Math.max(width, height));
    const w = round(width * scale);
    const h = round(height * scale);
    return {
        id: newId(),
        type: 'image',
        assetId,
        x: round(centre.x - w / 2),
        y: round(centre.y - h / 2),
        w,
        h,
        opacity: 1,
        rotation: 0,
        locked: false,
        groupId: null,
    };
}

async function addImageFiles(fileList, screenPosition) {
    const files = [...fileList];
    const usable = files.filter((file) => IMAGE_TYPES.includes(file.type) && file.size <= IMAGE_MAX_BYTES);
    if (usable.length < files.length) {
        showToast('Only PNG, JPEG, WebP and GIF images up to 20 MB can be added.');
    }
    const centre = screenToBoard(screenPosition || viewportCentre());
    const added = [];
    for (const file of usable) {
        try {
            const prepared = await prepareImage(file);
            const offset = PASTE_OFFSET * added.length;
            const item = createImageItem(prepared, { x: centre.x + offset, y: centre.y + offset });
            items.push(item);
            added.push(item.id);
        } catch (error) {
            showToast(`Couldn't read ${file.name}.`);
        }
    }
    if (added.length > 0) {
        setTool('select');
        commit();
        select(added);
    }
}

function usedAssets() {
    const used = {};
    items.filter(isImage).forEach((item) => {
        if (assets.has(item.assetId)) {
            used[item.assetId] = assets.get(item.assetId);
        }
    });
    return used;
}

// Only needed when IndexedDB isn't available. Only rewrites when the set of images has changed.
function persistAssets() {
    if (assetDb !== null) {
        return;
    }
    const used = usedAssets();
    const keys = Object.keys(used).join();
    if (keys !== savedAssetKeys) {
        localStorage.setItem(ASSETS_STORAGE_KEY, JSON.stringify(used));
        savedAssetKeys = keys;
    }
}

function validAssets(raw) {
    const valid = {};
    if (raw && typeof raw === 'object') {
        Object.entries(raw).forEach(([key, value]) => {
            if (typeof value === 'string' && ASSET_PATTERN.test(value)) {
                valid[key] = value;
            }
        });
    }
    return valid;
}
