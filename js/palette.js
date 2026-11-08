// --- Colours, fill, opacity, text style and pop-up menus ---

const POPOVERS = [alignMenu, layerMenu, paletteMenu];
const popoverOpeners = new Map();

function setPopover(menu, opener, isOpen) {
    document.querySelectorAll(`[aria-controls="${menu.id}"]`).forEach((button) => {
        button.setAttribute('aria-expanded', 'false');
    });
    menu.hidden = !isOpen;
    if (!isOpen) {
        return;
    }
    opener.setAttribute('aria-expanded', 'true');
    popoverOpeners.set(menu, opener);
    const stageRect = stage.getBoundingClientRect();
    const openerRect = opener.getBoundingClientRect();
    const middle = openerRect.left + openerRect.width / 2 - stageRect.left;
    const maxLeft = stageRect.width - menu.offsetWidth - MENU_MARGIN;
    menu.style.left = Math.max(MENU_MARGIN, Math.min(middle - menu.offsetWidth / 2, maxLeft)) + 'px';
    menu.style.top = openerRect.bottom - stageRect.top + MENU_GAP + 'px';
}

// Returns whether anything was open, so Esc can stop there.
function closeOpenPopovers() {
    const open = POPOVERS.filter((menu) => !menu.hidden);
    open.forEach((menu) => {
        setPopover(menu, null, false);
        popoverOpeners.get(menu).focus();
    });
    return open.length > 0;
}

function closePopoversOutside(target) {
    POPOVERS.filter((menu) => !menu.hidden).forEach((menu) => {
        if (!target.closest(`#${menu.id}, [aria-controls="${menu.id}"]`)) {
            setPopover(menu, null, false);
        }
    });
}

function displayedFill() {
    const shape = selectedItems().find(isFillable);
    return shape ? shape.fill : currentFill;
}

function updateSwatches() {
    colorSwatch.style.background = colorInput.value;
    const fill = displayedFill();
    fillSwatch.style.background = fill || '';
    fillSwatch.classList.toggle('no-fill', !fill);
    if (fill) {
        fillInput.value = fill;
    }
}

function setColor(color) {
    colorInput.value = color;
    updateSelected((item) => {
        if (!isImage(item)) {
            item.color = color;
        }
    });
    updateSwatches();
}

function setFill(color) {
    if (selectedIds.length === 0) {
        currentFill = color;
    }
    updateSelected((item) => {
        if (isFillable(item) && (color !== null || !item.note)) {
            item.fill = color; // A sticky note always keeps a colour.
        }
    });
    updateSwatches();
}

function drawRecentColors() {
    paletteRecent.replaceChildren(...recentColors.map(createColorChip));
    paletteRecentLabel.hidden = recentColors.length === 0;
}

function addRecentColor(color) {
    recentColors = [color, ...recentColors.filter((other) => other !== color)].slice(0, MAX_RECENT_COLORS);
    drawRecentColors();
    try {
        localStorage.setItem(RECENT_COLORS_STORAGE_KEY, JSON.stringify(recentColors));
    } catch (error) {
        // The colours still work for this visit; they just won't be remembered.
    }
}

function loadRecentColors() {
    try {
        const saved = JSON.parse(localStorage.getItem(RECENT_COLORS_STORAGE_KEY));
        if (Array.isArray(saved)) {
            recentColors = saved
                .filter((color) => typeof color === 'string' && COLOR_PATTERN.test(color))
                .slice(0, MAX_RECENT_COLORS);
        }
    } catch (error) {
        recentColors = [];
    }
}

function applyPaletteColor(color) {
    if (paletteTarget === 'fill') {
        setFill(color);
    } else {
        setColor(color);
    }
    commit();
    addRecentColor(color);
    setPopover(paletteMenu, null, false);
}

function createColorChip(color) {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'color-chip';
    chip.style.background = color;
    chip.dataset.color = color;
    chip.setAttribute('aria-label', `Use colour ${color}`);
    return chip;
}

function buildPalette() {
    palettePresets.replaceChildren(...PRESET_COLORS.map(createColorChip));
    drawRecentColors();
}

function togglePalette(target, opener) {
    const wasOpen = !paletteMenu.hidden && paletteTarget === target;
    paletteTarget = target;
    colorInput.hidden = target !== 'color';
    fillInput.hidden = target !== 'fill';
    noFillButton.hidden = target !== 'fill' || selectedItems().some((item) => item.note);
    setPopover(paletteMenu, opener, !wasOpen);
}

function setOpacity(percent) {
    opacityValue.textContent = `${percent}%`;
    updateSelected((item) => {
        item.opacity = percent / 100;
    });
}

function updateTextStyleButtons(text) {
    fontFamilySelect.value = text.fontFamily;
    boldButton.classList.toggle('active', text.bold);
    boldButton.setAttribute('aria-pressed', String(text.bold));
    textAlignIcon.setAttribute('href', `#i-text-${text.align}`);
    textAlignButton.setAttribute('aria-label', `Text alignment: ${text.align}`);
}

function setTextStyle(apply) {
    updateSelected((item) => {
        if (isText(item)) {
            apply(item);
        }
    });
    commit();
    const text = selectedItems().find(isText);
    if (text) {
        updateTextStyleButtons(text);
    }
}

function toggleBold() {
    const bold = !selectedItems().find(isText).bold;
    setTextStyle((item) => {
        item.bold = bold;
    });
}

function cycleTextAlign() {
    const current = selectedItems().find(isText).align;
    const align = TEXT_ALIGNMENTS[(TEXT_ALIGNMENTS.indexOf(current) + 1) % TEXT_ALIGNMENTS.length];
    setTextStyle((item) => {
        item.align = align;
    });
}
