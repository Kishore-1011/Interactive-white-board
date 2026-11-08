// --- Help, templates, the empty board and the phone toolbar ---

const DIALOGS = [helpDialog, boardsDialog, templatesDialog];

function anyDialogOpen() {
    return DIALOGS.some((dialog) => dialog.open);
}

function openHelp() {
    helpDialog.showModal();
}

function openTemplates() {
    templatesDialog.showModal();
}

function updateEmptyState() {
    emptyState.hidden = items.length > 0 || tool !== 'select';
}

function setRailExpanded(isExpanded) {
    toolRail.classList.toggle('expanded', isExpanded);
    moreToolsButton.setAttribute('aria-expanded', String(isExpanded));
}

function updateMoreToolsButton() {
    moreToolsButton.classList.toggle('active', SECONDARY_TOOLS.includes(tool));
}
