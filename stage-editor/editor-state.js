export const boardData = {
    columns: 24,
    rows: 16,
    start: { x: 2, y: 7 },
    goal: { x: 21, y: 7 },
    metadata: null,
    entities: [
        { type: "wall", x: 5, y: 5 },
        { type: "wall", x: 6, y: 5 },
        { type: "block", x: 8, y: 7 },
    ],
};

export const tools = [
    { id: "wall-btn", key: "q", type: "wall", label: "壁" },
    { id: "box-btn", key: "w", type: "block", label: "木箱類" },
    { id: "water-btn", key: "e", type: "water", label: "水" },
    { id: "switch-btn", key: "r", type: "switch", label: "スイッチ" },
    { id: "item-btn", key: "t", type: "item", label: "アイテム" },
    { id: "color-wall-btn", key: "a", type: "colorWall", label: "色連動ドア" },
    { id: "laser-btn", key: "s", type: "laser", label: "レーザー" },
    { id: "start-btn", key: "d", type: "start", label: "スタート位置" },
    { id: "goal-btn", key: "f", type: "goal", label: "ゴール" },
    { id: "eraser-btn", key: "g", type: "eraser", label: "消しゴム" },
];

let selectedTool = tools[0];
let selectedColor = "#ff5e68";
let selectedItemType = "pastePotion";
let initialSkillPotions = 0;
let initialSelectAllPotions = 0;
let selectedLaserDirection = "right";
let hoveredTile = null;

export function getSelectedTool() {
    return selectedTool;
}

export function setSelectedTool(tool) {
    selectedTool = tool;
}

export function getSelectedColor() {
    return selectedColor;
}

export function setSelectedColor(color) {
    selectedColor = color;
}

export function getSelectedItemType() {
    return selectedItemType;
}

export function setSelectedItemType(itemType) {
    selectedItemType = itemType;
}

export function getInitialSkillPotions() {
    return initialSkillPotions;
}

export function setInitialSkillPotions(value) {
    initialSkillPotions = Math.max(0, Math.trunc(Number(value) || 0));
}

export function getInitialSelectAllPotions() {
    return initialSelectAllPotions;
}

export function setInitialSelectAllPotions(value) {
    initialSelectAllPotions = Math.max(0, Math.trunc(Number(value) || 0));
}

export function getSelectedLaserDirection() {
    return selectedLaserDirection;
}

export function setSelectedLaserDirection(direction) {
    selectedLaserDirection = direction;
}

export function getHoveredTile() {
    return hoveredTile;
}

export function setHoveredTile(tile) {
    hoveredTile = tile;
}
