import { COLOR_PALETTE } from "./colors.js";
import { ITEM_PALETTE, getItemDefinition, getItemName } from "./items.js";
import { boardData, getSelectedColor, getSelectedItemType, getSelectedLaserDirection, getSelectedTool, setSelectedColor, setSelectedItemType, setSelectedLaserDirection, setSelectedTool, tools } from "./editor-state.js";
import { renderEditorBoard } from "./editor-canvas.js";
import { refreshStageNameDisplay } from "./stage-title.js";

const COLOR_TOOL_TYPES = ["block", "switch", "colorWall"];
const colorPalette = document.querySelector("#color-palette");
const itemPalette = document.querySelector("#item-palette");
const editorContainer = document.querySelector("#editor-container");
const selectedToolName = document.querySelector("#selected-tool-name");
const selectedToolIcon = document.querySelector("#selected-tool-icon");
const selectedToolDetail = document.querySelector("#selected-tool-detail");
const selectedToolColor = document.querySelector("#selected-tool-color");
const toolbox = document.querySelector("#toolbox");
const toolboxToggle = document.querySelector("#toolbox-toggle");
const newButton = document.querySelector("#new-btn");
const laserDirectionPalette = document.querySelector("#laser-direction-palette");
const directionButtons = [];
const buttons = [...document.querySelectorAll("#toolbox .btn-selected")];
const status = document.createElement("p");
const colorButtons = [];
const itemButtons = [];
let activeColorTool = null;
const TOOL_ICONS = {
    wall: '<rect x="8" y="10" width="48" height="44" rx="4" fill="currentColor"/><path d="M8 25h48M8 40h48M24 10v15m18 0v15M24 40v14" fill="none" stroke="#263445" stroke-width="3"/>',
    block: '<path d="M32 7 55 19v27L32 58 9 46V19L32 7Z" fill="currentColor" stroke="#ffffff" stroke-width="2"/><path d="m9 19 23 13 23-13M32 32v26" fill="none" stroke="#ffffff" stroke-width="2"/>',
    water: '<path d="M32 7C25 18 14 30 14 40a18 18 0 0 0 36 0C50 30 39 18 32 7Z" fill="currentColor"/><path d="M23 41c1 5 4 8 9 9" fill="none" stroke="#ffffff" stroke-width="3" stroke-linecap="round"/>',
    switch: '<rect x="8" y="39" width="48" height="14" rx="4" fill="#9ba8b6"/><circle cx="32" cy="30" r="17" fill="currentColor" stroke="#ffffff" stroke-width="3"/><path d="M24 30h16" stroke="#ffffff" stroke-width="3" stroke-linecap="round"/>',
    item: '<path d="M24 8h16v10l10 22a10 10 0 0 1-9 14H23a10 10 0 0 1-9-14l10-22V8Z" fill="currentColor" stroke="#ffffff" stroke-width="2"/><path d="M22 38h20" stroke="#ffffff" stroke-width="3"/>',
    colorWall: '<path d="M12 54V18h8v36m12 0V10h8v44m12 0V24h8v30" fill="currentColor" stroke="#ffffff" stroke-width="2"/><path d="M8 55h48" stroke="#ffffff" stroke-width="3"/>',
    laser: '<g transform="rotate(0 32 32)"><rect x="24" y="39" width="16" height="15" rx="3" fill="currentColor" stroke="#ffffff" stroke-width="2"/><path d="M27 39V27a5 5 0 0 1 10 0v12" fill="none" stroke="currentColor" stroke-width="6"/><path d="M32 25V9m-8 9 8-9 8 9" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><path d="M32 8 24 20h16L32 8Z" fill="currentColor"/></g>',
    start: '<circle cx="32" cy="32" r="23" fill="currentColor" stroke="#ffffff" stroke-width="3"/><path d="M25 43V21l18 11-18 11Z" fill="#263445"/>',
    goal: '<path d="M18 55V10" stroke="#ffffff" stroke-width="4" stroke-linecap="round"/><path d="M21 12h28L40 23l9 11H21Z" fill="currentColor" stroke="#ffffff" stroke-width="2"/>',
    eraser: '<path d="m11 39 22-25a6 6 0 0 1 9 0l11 11a6 6 0 0 1 0 9L37 53H22L11 42a2 2 0 0 1 0-3Z" fill="currentColor" stroke="#ffffff" stroke-width="3"/><path d="m22 53 18-21" stroke="#263445" stroke-width="3"/>',
};

const TOOL_ICON_COLORS = {
    wall: "#a6a6a6",
    water: "#3889ad",
    item: "#78c477",
    laser: "#e45b63",
    start: "#70e1c1",
    goal: "#f3c969",
    eraser: "#e7edf4",
};

function renderSelectedToolIcon(tool) {
    if (!selectedToolIcon) return;
    if (!tool || (!TOOL_ICONS[tool.type] && tool.type !== "item")) {
        selectedToolIcon.innerHTML = "";
        return;
    }

    const itemDefinition = tool.type === "item" ? getItemDefinition(getSelectedItemType()) : null;
    let svgContent = itemDefinition?.icon ?? TOOL_ICONS[tool.type];
    if (tool.type === "laser") {
        const rotation = { up: 0, right: 90, down: 180, left: 270 }[getSelectedLaserDirection()];
        svgContent = svgContent.replace("rotate(0 32 32)", `rotate(${rotation} 32 32)`);
    }
    selectedToolIcon.style.color = itemDefinition?.color
        ?? (COLOR_TOOL_TYPES.includes(tool.type) ? getSelectedColor() : TOOL_ICON_COLORS[tool.type]);
    selectedToolIcon.innerHTML = `<svg viewBox="0 0 64 64" focusable="false">${svgContent}</svg>`;
}

status.id = "tool-status";
status.setAttribute("role", "status");
status.setAttribute("aria-live", "polite");
toolbox?.append(status);

function updateStatus() {
    const selectedTool = getSelectedTool();
    if (selectedTool) {
        const keyText = selectedTool.key ? "（キー " + selectedTool.key + "）" : "";
        const colorText = COLOR_TOOL_TYPES.includes(selectedTool.type)
            ? " / " + getSelectedColor() : "";
        const directionLabel = { up: "上", down: "下", left: "左", right: "右" }[getSelectedLaserDirection()];
        const directionText = selectedTool.type === "laser" ? " / 向き: " + directionLabel : "";
        const itemText = selectedTool.type === "item" ? " / " + getItemName(getSelectedItemType()) : "";
        status.textContent = "選択中: " + selectedTool.label + keyText + colorText + directionText + itemText;
        if (selectedToolName) selectedToolName.textContent = selectedTool.label;
        renderSelectedToolIcon(selectedTool);
        if (selectedToolDetail) {
            selectedToolDetail.textContent = COLOR_TOOL_TYPES.includes(selectedTool.type)
                ? getSelectedColor()
                : selectedTool.type === "laser" ? "向き: " + directionLabel
                    : selectedTool.type === "item" ? getItemName(getSelectedItemType())
                        : keyText;
        }
        if (selectedToolColor) {
            const hasColor = COLOR_TOOL_TYPES.includes(selectedTool.type);
            selectedToolColor.hidden = !hasColor;
            selectedToolColor.style.backgroundColor = hasColor ? getSelectedColor() : "transparent";
        }
    } else {
        status.textContent = "ツール未選択";
        if (selectedToolName) selectedToolName.textContent = "なし";
        renderSelectedToolIcon(null);
        if (selectedToolDetail) selectedToolDetail.textContent = "";
        if (selectedToolColor) selectedToolColor.hidden = true;
    }

    directionButtons.forEach((button) => {
        button.setAttribute("aria-pressed", String(button.dataset.direction === getSelectedLaserDirection()));
    });
    colorButtons.forEach((button, index) => {
        const color = COLOR_PALETTE[index];
        button.hidden = color.excludeFor?.includes(selectedTool?.type) ?? false;
        button.setAttribute("aria-pressed", String(color.hex === getSelectedColor()));
    });
    itemButtons.forEach((button, index) => {
        const item = ITEM_PALETTE[index];
        button.setAttribute("aria-pressed", String(item.type === getSelectedItemType()));
    });
    buttons.forEach((button) => {
        const isSelected = selectedTool !== null && button.id === selectedTool.id;
        button.setAttribute("aria-pressed", String(isSelected));
        button.classList.toggle("is-active", isSelected);
    });
    renderEditorBoard();
}

function selectTool(tool) {
    setSelectedTool(tool);
    colorPalette.hidden = true;
    itemPalette.hidden = true;
    laserDirectionPalette.hidden = true;
    activeColorTool = null;
    updateStatus();
}

function positionColorPalette(tool) {
    activeColorTool = tool;
    itemPalette.hidden = true;
    laserDirectionPalette.hidden = true;
    const availableColors = COLOR_PALETTE.filter(
        (color) => !color.excludeFor?.includes(tool.type),
    );
    if (!availableColors.some((color) => color.hex === getSelectedColor())) {
        setSelectedColor(availableColors[0]?.hex ?? COLOR_PALETTE[0].hex);
    }
    colorPalette.classList.remove("is-collapsed");
    colorPaletteToggle.textContent = "⌃";
    colorPaletteToggle.setAttribute("aria-label", "色一覧を折りたたむ");
    colorPaletteToggle.setAttribute("aria-expanded", "true");
    updateColorPalettePosition();
}

function updateColorPalettePosition() {
    if (colorPalette.hidden) return;
    const panelWidth = colorPalette.offsetWidth || Math.min(360, window.innerWidth - 16);
    const anchor = activeColorTool
        ? document.getElementById(activeColorTool.id)?.getBoundingClientRect()
        : null;
    const hasVisibleAnchor = anchor && anchor.width > 0 && anchor.height > 0;
    let left = hasVisibleAnchor ? anchor.left : (window.innerWidth - panelWidth) / 2;
    const top = hasVisibleAnchor ? Math.max(12, anchor.bottom + 8) : 72;
    left = Math.max(8, Math.min(left, window.innerWidth - panelWidth - 8));
    colorPalette.style.position = "fixed";
    colorPalette.style.zIndex = "1000";
    colorPalette.style.left = left + "px";
    colorPalette.style.top = top + "px";
}


function positionItemPalette() {
    if (itemPalette.hidden) return;
    const anchor = document.querySelector("#item-btn")?.getBoundingClientRect();
    if (!anchor || anchor.width === 0 || anchor.height === 0) return;
    const panelWidth = itemPalette.offsetWidth || 360;
    const left = Math.max(8, Math.min(anchor.left, window.innerWidth - panelWidth - 8));
    const top = Math.max(12, Math.min(anchor.bottom + 8, window.innerHeight - itemPalette.offsetHeight - 8));
    itemPalette.style.position = "fixed";
    itemPalette.style.zIndex = "1000";
    itemPalette.style.left = left + "px";
    itemPalette.style.top = top + "px";
}

function positionDirectionPalette() {
    if (laserDirectionPalette.hidden) return;
    const anchor = document.querySelector("#laser-btn")?.getBoundingClientRect();
    if (!anchor || anchor.width === 0 || anchor.height === 0) return;
    const panelWidth = laserDirectionPalette.offsetWidth || 220;
    const left = Math.max(8, Math.min(anchor.left, window.innerWidth - panelWidth - 8));
    const top = Math.max(12, Math.min(anchor.bottom + 8, window.innerHeight - laserDirectionPalette.offsetHeight - 8));
    laserDirectionPalette.style.position = "fixed";
    laserDirectionPalette.style.zIndex = "1000";
    laserDirectionPalette.style.left = left + "px";
    laserDirectionPalette.style.top = top + "px";
}

function activateLaserTool(tool) {
    setSelectedTool(tool);
    colorPalette.hidden = true;
    itemPalette.hidden = true;
    activeColorTool = null;
    if (toolbox.classList.contains("is-collapsed")) {
        laserDirectionPalette.hidden = true;
    } else {
        laserDirectionPalette.hidden = false;
        positionDirectionPalette();
    }
    updateStatus();
}

function activateItemTool(tool) {
    setSelectedTool(tool);
    colorPalette.hidden = true;
    laserDirectionPalette.hidden = true;
    activeColorTool = null;
    if (toolbox.classList.contains("is-collapsed")) {
        itemPalette.hidden = true;
    } else {
        itemPalette.hidden = false;
        positionItemPalette();
    }
    updateStatus();
}

function activateTool(tool) {
    if (COLOR_TOOL_TYPES.includes(tool.type)) {
        setSelectedTool(tool);
        itemPalette.hidden = true;
        laserDirectionPalette.hidden = true;
        if (toolbox.classList.contains("is-collapsed")) {
            colorPalette.hidden = true;
            activeColorTool = null;
            updateStatus();
            return;
        }
        colorPalette.hidden = false;
        positionColorPalette(tool);
        updateStatus();
        return;
    }
    if (tool.type === "laser") {
        activateLaserTool(tool);
        return;
    }
    if (tool.type === "item") {
        activateItemTool(tool);
        return;
    }
    selectTool(tool);
}

function chooseTool(tool) {
    if (getSelectedTool()?.id === tool.id) {
        if (COLOR_TOOL_TYPES.includes(tool.type) && colorPalette.hidden) {
            activateTool(tool);
            return;
        }
        if (tool.type === "item" && itemPalette.hidden) {
            activateTool(tool);
            return;
        }
        setSelectedTool(null);
        colorPalette.hidden = true;
        itemPalette.hidden = true;
        laserDirectionPalette.hidden = true;
        activeColorTool = null;
        updateStatus();
        return;
    }
    activateTool(tool);
}

function createNewMap() {
    const hasPlacements = boardData.metadata !== null
        || boardData.entities.length > 0
        || boardData.start.x !== 2
        || boardData.start.y !== 7
        || boardData.goal.x !== 21
        || boardData.goal.y !== 7;

    if (hasPlacements && !window.confirm("現在の配置を消して、新しいマップを作成しますか？")) return;

    boardData.entities = [];
    boardData.metadata = null;
    document.dispatchEvent(new Event("stage-new-map"));
    refreshStageNameDisplay();
    boardData.start = { x: 2, y: 7 };
    boardData.goal = { x: 21, y: 7 };
    selectTool(tools[0]);
    status.textContent = "新しいマップを作成しました。";
}


function createDirectionButtons() {
    const directions = [
        { value: "up", label: "上", symbol: "↑" },
        { value: "right", label: "右", symbol: "→" },
        { value: "down", label: "下", symbol: "↓" },
        { value: "left", label: "左", symbol: "←" },
    ];
    for (const direction of directions) {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "direction-option";
        button.dataset.direction = direction.value;
        button.setAttribute("aria-label", direction.label + "向き");
        button.setAttribute("aria-pressed", "false");
        button.innerHTML = `<span class="direction-option-arrow" aria-hidden="true">${direction.symbol}</span><span>${direction.label}</span>`;
        button.addEventListener("click", () => {
            setSelectedLaserDirection(direction.value);
            updateStatus();
        });
        laserDirectionPalette.append(button);
        directionButtons.push(button);
    }
}

function createColorButtons() {
    for (const color of COLOR_PALETTE) {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "color-option";
        button.setAttribute("aria-label", color.name + " " + color.hex);
        button.setAttribute("aria-pressed", "false");
        button.title = color.name + " " + color.hex;

        const swatch = document.createElement("span");
        swatch.className = "color-option-swatch";
        swatch.style.backgroundColor = color.hex;
        const label = document.createElement("span");
        label.textContent = color.name + " " + color.hex;
        button.append(swatch, label);
        button.addEventListener("click", () => {
            setSelectedColor(color.hex);
            updateStatus();
        });
        colorPalette.append(button);
        colorButtons.push(button);
    }
}

function createItemButtons() {
    for (const item of ITEM_PALETTE) {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "item-option";
        button.setAttribute("aria-label", item.name);
        button.setAttribute("aria-pressed", "false");
        button.title = item.name;

        const swatch = document.createElement("span");
        swatch.className = "item-option-swatch";
        swatch.style.color = item.color;
        swatch.innerHTML = `<svg viewBox="0 0 64 64" focusable="false" aria-hidden="true">${item.icon}</svg>`;
        const label = document.createElement("span");
        label.textContent = item.name;
        button.append(swatch, label);
        button.addEventListener("click", () => {
            setSelectedItemType(item.type);
            updateStatus();
        });
        itemPalette.append(button);
        itemButtons.push(button);
    }
}

const colorPaletteToggle = document.createElement("button");
colorPaletteToggle.id = "color-palette-toggle";
colorPaletteToggle.type = "button";
colorPaletteToggle.className = "color-palette-toggle";
colorPaletteToggle.textContent = "⌃";
colorPaletteToggle.setAttribute("aria-label", "色一覧を折りたたむ");
colorPaletteToggle.setAttribute("aria-expanded", "true");
colorPalette?.append(colorPaletteToggle);

export function initEditorToolbar() {
    createColorButtons();
    createItemButtons();
    createDirectionButtons();

    colorPaletteToggle.addEventListener("click", () => {
        const isCollapsed = colorPalette.classList.toggle("is-collapsed");
        colorPaletteToggle.textContent = isCollapsed ? "⌄" : "⌃";
        colorPaletteToggle.setAttribute("aria-label", isCollapsed ? "色一覧を開く" : "色一覧を折りたたむ");
        colorPaletteToggle.setAttribute("aria-expanded", String(!isCollapsed));
        updateColorPalettePosition();
    });
    editorContainer?.addEventListener("wheel", (event) => {
        const selectedTool = getSelectedTool();
        if (event.deltaY === 0) return;

        if (selectedTool?.type === "laser") {
            const directions = ["up", "right", "down", "left"];
            const currentIndex = directions.indexOf(getSelectedLaserDirection());
            const direction = event.deltaY > 0 ? 1 : -1;
            const nextIndex = (currentIndex + direction + directions.length) % directions.length;
            event.preventDefault();
            setSelectedLaserDirection(directions[nextIndex]);
            updateStatus();
            return;
        }

        if (!COLOR_TOOL_TYPES.includes(selectedTool?.type)) return;
        const availableColors = COLOR_PALETTE.filter(
            (color) => !color.excludeFor?.includes(selectedTool.type),
        );
        if (availableColors.length === 0) return;
        event.preventDefault();
        const currentIndex = availableColors.findIndex((color) => color.hex === getSelectedColor());
        const startIndex = currentIndex >= 0 ? currentIndex : 0;
        const direction = event.deltaY > 0 ? 1 : -1;
        const nextIndex = (startIndex + direction + availableColors.length) % availableColors.length;
        setSelectedColor(availableColors[nextIndex].hex);
        updateStatus();
    }, { passive: false });

    buttons.forEach((button) => {
        const tool = tools.find((candidate) => candidate.id === button.id);
        if (!tool) return;
        if (tool.key) button.dataset.key = tool.key;
        button.addEventListener("click", () => chooseTool(tool));
    });

    newButton?.addEventListener("click", createNewMap);

    toolboxToggle?.addEventListener("click", () => {
        const isCollapsed = toolbox.classList.toggle("is-collapsed");
        if (isCollapsed) {
            colorPalette.hidden = true;
            itemPalette.hidden = true;
            laserDirectionPalette.hidden = true;
            activeColorTool = null;
        }
        toolboxToggle.setAttribute("aria-expanded", String(!isCollapsed));
        toolboxToggle.setAttribute("aria-label", isCollapsed ? "ツールボックスを開く" : "ツールボックスを閉じる");
        toolboxToggle.textContent = isCollapsed ? "⌄" : "⌃";
    });

    window.addEventListener("scroll", updateColorPalettePosition, { passive: true });
    window.addEventListener("resize", updateColorPalettePosition);
    window.addEventListener("scroll", positionItemPalette, { passive: true });
    window.addEventListener("resize", positionItemPalette);
    window.addEventListener("scroll", positionDirectionPalette, { passive: true });
    window.addEventListener("resize", positionDirectionPalette);

    document.addEventListener("keydown", (event) => {
        if (event.target instanceof HTMLElement
            && (event.target.isContentEditable
                || ["INPUT", "TEXTAREA", "SELECT"].includes(event.target.tagName))) return;
        const tool = tools.find((candidate) => candidate.key === event.key);
        if (tool) activateTool(tool);
    });

    updateStatus();
}
