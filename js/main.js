// --- Start ---

updateThemeButton();
loadSettings();
drawSettings();
loadRecentColors();
buildPalette();
buildTemplates();
loadCurrentBoard();
initBoards();
setTool('select');
lastAssetLoad.then(cleanUpAssets).catch(() => {});
updateButtons();
