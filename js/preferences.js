// --- Board name, theme and menus ---

function boardName() {
    return boardNameInput.value.trim() || DEFAULT_BOARD_NAME;
}

function storeBoardName() {
    try {
        localStorage.setItem(NAME_STORAGE_KEY, boardName());
    } catch (error) {
        setSaveState(false);
    }
}

function setBoardName(name) {
    boardNameInput.value = name.slice(0, Number(boardNameInput.maxLength));
    storeBoardName();
}

function loadBoardName() {
    try {
        boardNameInput.value = localStorage.getItem(NAME_STORAGE_KEY) || DEFAULT_BOARD_NAME;
    } catch (error) {
        boardNameInput.value = DEFAULT_BOARD_NAME;
    }
}

function exportFilename(extension) {
    const safeName = boardName().replace(/[\\/:*?"<>|]+/g, '').trim().replace(/\s+/g, '-');
    return `${safeName || 'whiteboard'}.${extension}`;
}

function updateThemeButton() {
    const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    const label = `Switch to ${next} theme`;
    themeButton.setAttribute('aria-label', label);
    themeButton.dataset.tip = label;
}

function toggleTheme() {
    const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    updateThemeButton();
    try {
        localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch (error) {
        // The theme still applies for this visit; it just won't be remembered.
    }
}

function setExportMenu(isOpen) {
    exportMenu.hidden = !isOpen;
    exportToggle.setAttribute('aria-expanded', String(isOpen));
}
