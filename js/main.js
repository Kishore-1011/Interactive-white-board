// --- Start ---

loadSavedBoard();
loadBoardName();
updateThemeButton();
loadView();
loadSettings();
drawSettings();
render();
drawCamera(false);
undoStack = [snapshot()];
setTool('select');
updateButtons();
