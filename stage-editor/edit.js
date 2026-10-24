import { renderBoard } from "./render.js";

const boardData = {
    columns: 24,
    rows: 16,
    start: { x: 2, y: 7 },
    goal: { x: 21, y: 7 },
    entities: [
        { type: "wall", x: 5, y: 5 },
        { type: "wall", x: 6, y: 5 },
        { type: "block", x: 8, y: 7 },
    ],
};

const canvas = document.querySelector("#board");
const newButton = document.querySelector("#new-btn");
const status = document.createElement("p");
const buttons = [...document.querySelectorAll("#detail .btn-selected")];
const tools = [
    { id: "wall-btn", key: "1", type: "wall", label: "壁" },
    { id: "box-btn", key: "2", type: "block", label: "木箱" },
    { id: "water-btn", key: "3", type: "water", label: "水" },
    { id: "switch-btn", key: "4", type: "switch", label: "スイッチ" },
    { id: "door-btn", key: "5", type: "door", label: "ドア" },
    { id: "raser-btn", key: "6", type: "laser", label: "レーザー" },
    { id: "start-btn", key: "7", type: "start", label: "スタート位置" },
    { id: "goal-btn", key: "8", type: "goal", label: "ゴール" },
    { id: "eraser-btn", key: "9", type: "eraser", label: "消しゴム" },
];

let selectedTool = tools[0];
let isPainting = false;

status.id = "tool-status";
status.setAttribute("role", "status");
status.setAttribute("aria-live", "polite");
document.querySelector("#detail")?.append(status);

function updateStatus() {
    status.textContent = `選択中: ${selectedTool.label}（キー ${selectedTool.key}）`;
    buttons.forEach((button) => {
        const isSelected = button.id === selectedTool.id;
        button.setAttribute("aria-pressed", String(isSelected));
        button.classList.toggle("is-active", isSelected);
    });
}

function createNewMap() {
    const hasPlacements = boardData.entities.length > 0
        || boardData.start.x !== 2
        || boardData.start.y !== 7
        || boardData.goal.x !== 21
        || boardData.goal.y !== 7;

    if (hasPlacements && !window.confirm("現在の配置を消して、新しいマップを作成しますか？")) {
        return;
    }

    boardData.entities = [];
    boardData.start = { x: 2, y: 7 };
    boardData.goal = { x: 21, y: 7 };

    selectTool(tools[0]);
    renderBoard(boardData);
    status.textContent = "新しいマップを作成しました。";
}
function selectTool(tool) {
    selectedTool = tool;
    updateStatus();
}

function isPlayableTile(x, y) {
    return x >= 1 && x < boardData.columns - 1
        && y >= 1 && y < boardData.rows - 1;
}

function entityAt(x, y) {
    return boardData.entities.find((entity) => entity.x === x && entity.y === y);
}

function applyTool(x, y) {
    if (!isPlayableTile(x, y)) return;

    if (selectedTool.type === "eraser") {
        boardData.entities = boardData.entities.filter(
            (entity) => entity.x !== x || entity.y !== y
        );
        renderBoard(boardData);
        return;
    }

    if (selectedTool.type === "start" || selectedTool.type === "goal") {
        if (entityAt(x, y)) return;
        boardData[selectedTool.type] = { x, y };
        renderBoard(boardData);
        return;
    }

    if ((boardData.start.x === x && boardData.start.y === y)
        || (boardData.goal.x === x && boardData.goal.y === y)) {
        return;
    }

    const current = entityAt(x, y);
    if (current) {
        if (current.type === selectedTool.type) return;
        boardData.entities = boardData.entities.filter((entity) => entity !== current);
    }

    boardData.entities.push({ type: selectedTool.type, x, y });
    renderBoard(boardData);
}

function tileFromPointer(event) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
        x: Math.floor(((event.clientX - rect.left) * scaleX) / 40),
        y: Math.floor(((event.clientY - rect.top) * scaleY) / 40),
    };
}

function paintFromPointer(event) {
    const tile = tileFromPointer(event);
    applyTool(tile.x, tile.y);
}

buttons.forEach((button) => {
    const tool = tools.find((candidate) => candidate.id === button.id);
    if (tool) button.addEventListener("click", () => selectTool(tool));
});

newButton?.addEventListener("click", createNewMap);

canvas.addEventListener("pointerdown", (event) => {
    if (event.button !== 0) return;
    isPainting = true;
    canvas.setPointerCapture(event.pointerId);
    paintFromPointer(event);
});

canvas.addEventListener("pointermove", (event) => {
    if (isPainting && event.buttons === 1) paintFromPointer(event);
});

canvas.addEventListener("pointerup", () => {
    isPainting = false;
});

canvas.addEventListener("pointercancel", () => {
    isPainting = false;
});

document.addEventListener("keydown", (event) => {
    if (event.target instanceof HTMLElement
        && (event.target.isContentEditable
            || ["INPUT", "TEXTAREA", "SELECT"].includes(event.target.tagName))) {
        return;
    }

    const tool = tools.find((candidate) => candidate.key === event.key);
    if (tool) selectTool(tool);
});

renderBoard(boardData);
updateStatus();


