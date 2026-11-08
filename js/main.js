// --- Start ---

loadSavedBoard();
loadBoardName();
updateThemeButton();
loadView();
loadSettings();
drawSettings();
loadRecentColors();
buildPalette();
render();
drawCamera(false);
undoStack = [snapshot()];
setTool('select');
updateButtons();
