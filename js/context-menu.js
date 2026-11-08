// --- Right-click menu ---

function closeContextMenu() {
    contextMenu.hidden = true;
}

function selectionMenuEntries() {
    if (selectionLocked()) {
        return [
            { label: 'Copy', shortcut: 'Ctrl+C', action: copySelection },
            { label: 'Unlock', action: toggleLock },
        ];
    }
    const entries = [
        { label: 'Cut', shortcut: 'Ctrl+X', action: cutSelection },
        { label: 'Copy', shortcut: 'Ctrl+C', action: copySelection },
        { label: 'Duplicate', shortcut: 'Ctrl+D', action: duplicateSelection },
        null,
        { label: 'Bring to front', shortcut: 'Ctrl+]', action: bringToFront },
        { label: 'Send to back', shortcut: 'Ctrl+[', action: sendToBack },
        null,
    ];
    if (isGroupedSelection()) {
        entries.push({ label: 'Ungroup', shortcut: 'Ctrl+Shift+G', action: toggleGroup });
    } else if (selectedIds.length > 1) {
        entries.push({ label: 'Group', shortcut: 'Ctrl+G', action: toggleGroup });
    }
    entries.push(
        { label: 'Lock', action: toggleLock },
        null,
        { label: 'Delete', shortcut: 'Del', action: deleteSelected, danger: true }
    );
    return entries;
}

function boardMenuEntries(point) {
    return [
        { label: 'Paste here', shortcut: 'Ctrl+V', action: () => paste(point), disabled: clipboard.length === 0 },
        { label: 'Select all', shortcut: 'Ctrl+A', action: selectAll, disabled: items.length === 0 },
        null,
        {
            label: 'Add sticky note here',
            action: () => addNote({ x: round(point.x - NOTE_SIZE / 2), y: round(point.y - (NOTE_SIZE / 2)) }),
        },
        { label: 'Add text here', action: () => addTextBox({ x: point.x, y: point.y }) },
        null,
        { label: 'Fit to screen', shortcut: 'Shift+1', action: fitToScreen },
    ];
}

function createMenuEntry(entry) {
    if (entry === null) {
        const divider = document.createElement('hr');
        divider.className = 'menu-divider';
        return divider;
    }
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'context-item';
    button.setAttribute('role', 'menuitem');
    button.classList.toggle('danger', Boolean(entry.danger));
    button.disabled = Boolean(entry.disabled);
    const label = document.createElement('span');
    label.textContent = entry.label;
    button.appendChild(label);
    if (entry.shortcut) {
        const shortcut = document.createElement('kbd');
        shortcut.textContent = entry.shortcut;
        button.appendChild(shortcut);
    }
    button.addEventListener('click', () => {
        closeContextMenu();
        entry.action();
    });
    return button;
}

function openContextMenu(e, element) {
    // A long press starts as a drag that hasn't moved yet; one already moving keeps going.
    if (activeDrawing || eraser || (gesture && gesture.moved !== false)) {
        return;
    }
    gesture = null;
    marqueeElement.hidden = true;

    if (element && !selectedIds.includes(element.dataset.id)) {
        setTool('select');
        select([element.dataset.id]);
    }
    const onSelection = Boolean(element) || Boolean(e.target.closest('[data-handle]'));
    const entries = onSelection && selectedIds.length > 0
        ? selectionMenuEntries()
        : boardMenuEntries(boardPoint(e));

    contextMenu.replaceChildren(...entries.map(createMenuEntry));
    contextMenu.hidden = false;
    const left = Math.min(e.clientX, window.innerWidth - contextMenu.offsetWidth - MENU_MARGIN);
    const top = Math.min(e.clientY, window.innerHeight - contextMenu.offsetHeight - MENU_MARGIN);
    contextMenu.style.left = Math.max(MENU_MARGIN, left) + 'px';
    contextMenu.style.top = Math.max(MENU_MARGIN, top) + 'px';
    const first = contextMenu.querySelector('.context-item:not(:disabled)');
    if (first) {
        first.focus();
    }
}

function handleContextMenuKey(e) {
    if (e.key === 'Escape') {
        closeContextMenu();
        return;
    }
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        const entries = [...contextMenu.querySelectorAll('.context-item:not(:disabled)')];
        const step = e.key === 'ArrowDown' ? 1 : -1;
        const next = (entries.indexOf(document.activeElement) + step + entries.length) % entries.length;
        entries[next].focus();
    }
}
