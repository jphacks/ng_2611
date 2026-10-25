import { renderBoard } from "./render.js";
import {
    boardData,
    getHoveredTile,
    getSelectedColor,
    getSelectedItemType,
    getSelectedLaserDirection,
    getSelectedTool,
    setHoveredTile,
} from "./editor-state.js";

const TILE_SIZE = 40;
const COLOR_TOOL_TYPES = ["block", "switch", "colorWall"];
const canvas = document.querySelector("#board");
let newBlockSequence = 1;
let isPainting = false;

export function renderEditorBoard() {
    const tool = getSelectedTool();
    const hoveredTile = getHoveredTile();
    const preview = hoveredTile && tool
        ? {
            ...hoveredTile,
            type: tool.type === "item" ? getSelectedItemType() : tool.type,
            color: COLOR_TOOL_TYPES.includes(tool.type) ? getSelectedColor() : null,
            direction: tool.type === "laser" ? getSelectedLaserDirection() : undefined,
        }
        : null;
    renderBoard(boardData, preview);
}

function isPlayableTile(x, y) {
    return x >= 1 && x < boardData.columns - 1
        && y >= 1 && y < boardData.rows - 1;
}

function entityAt(x, y) {
    return boardData.entities.find((entity) => entity.x === x && entity.y === y);
}

function applyTool(x, y) {
    const selectedTool = getSelectedTool();
    if (!selectedTool || !isPlayableTile(x, y)) return;

    const toolType = selectedTool.type === "item" ? getSelectedItemType() : selectedTool.type;

    if (toolType === "eraser") {
        boardData.entities = boardData.entities.filter(
            (entity) => entity.x !== x || entity.y !== y,
        );
        renderEditorBoard();
        return;
    }

    if (toolType === "start" || toolType === "goal") {
        if (entityAt(x, y)) return;
        boardData[toolType] = { ...boardData[toolType], x, y };
        renderEditorBoard();
        return;
    }

    if ((boardData.start.x === x && boardData.start.y === y)
        || (boardData.goal.x === x && boardData.goal.y === y)) {
        return;
    }

    const current = entityAt(x, y);
    if (current) {
        if (current.type === toolType) {
            if (current.type === "laser"
                && current.direction !== getSelectedLaserDirection()) {
                current.direction = getSelectedLaserDirection();
                renderEditorBoard();
            }
            if (COLOR_TOOL_TYPES.includes(current.type)
                && current.color !== getSelectedColor()) {
                current.color = getSelectedColor();
                if (current.type === "block") current.kind = "colored";
                renderEditorBoard();
            }
            return;
        }
        boardData.entities = boardData.entities.filter((entity) => entity !== current);
    }

    const entity = { type: toolType, x, y };
    if (toolType === "block") {
        let blockId;
        do {
            blockId = "editor-crate-" + newBlockSequence++;
        } while (boardData.entities.some((item) => item.id === blockId));
        Object.assign(entity, {
            id: blockId,
            name: "色付き箱",
            kind: "colored",
            color: getSelectedColor(),
        });
    } else if (["switch", "colorWall"].includes(toolType)) {
        entity.color = getSelectedColor();
    } else if (toolType === "laser") {
        entity.direction = getSelectedLaserDirection();
        entity.length = 1;
    } else if (selectedTool.type === "item") {
        entity.itemType = toolType;
    }

    boardData.entities.push(entity);
    renderEditorBoard();
}

function tileFromPointer(event) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
        x: Math.floor(((event.clientX - rect.left) * scaleX) / TILE_SIZE),
        y: Math.floor(((event.clientY - rect.top) * scaleY) / TILE_SIZE),
    };
}

function paintFromPointer(event) {
    const tile = tileFromPointer(event);
    setHoveredTile(tile);
    applyTool(tile.x, tile.y);
    renderEditorBoard();
}

export function initCanvasEditor() {
    canvas.addEventListener("pointerdown", (event) => {
        if (event.button !== 0) return;
        isPainting = true;
        canvas.setPointerCapture(event.pointerId);
        paintFromPointer(event);
    });

    canvas.addEventListener("pointermove", (event) => {
        const tile = tileFromPointer(event);
        setHoveredTile(tile);
        if (isPainting && event.buttons === 1) applyTool(tile.x, tile.y);
        renderEditorBoard();
    });

    canvas.addEventListener("pointerleave", () => {
        if (isPainting) return;
        setHoveredTile(null);
        renderEditorBoard();
    });

    canvas.addEventListener("pointerup", () => {
        isPainting = false;
        renderEditorBoard();
    });

    canvas.addEventListener("pointercancel", () => {
        isPainting = false;
        setHoveredTile(null);
        renderEditorBoard();
    });
}
