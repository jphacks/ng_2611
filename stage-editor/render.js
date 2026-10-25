import { traceLaserPath } from "./laser-path.js";

const GRID_COLUMNS = 24;
const GRID_ROWS = 16;
const TILE_SIZE = 40;
const COLORS = {
    background: "#101923",
    floorLight: "#223844",
    floorDark: "#1c2e3a",
    grid: "rgba(157, 190, 196, 0.3)",
    wall: "#A6A6A6",
    block: "#b57d50",
    water: "#3889ad",
    switch: "#e6bd50",
    door: "#845b9e",
    laser: "#d94b57",
    colorWall: "#ab6d78",
    skillPotion: "#78c477",
    pastePotion: "#4aa8ff",
    selectAllPotion: "#a855f7",
    start: "#70e1c1",
    goal: "#f3c969",
    text: "#ffffff",
};

const LABELS = {
    block: "箱",
    water: "水",
    switch: "S",
    door: "扉",
    colorWall: "色",
    skillPotion: "P",
    pastePotion: "V",
    selectAllPotion: "A",
};

export function renderBoard(boardData, cursorPreview = null) {
    const canvas = document.querySelector("#board");
    const ctx = canvas?.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = COLORS.background;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // 外周の壁と内側の市松模様の床
    ctx.fillStyle = COLORS.wall;
    ctx.fillRect(0, 0, GRID_COLUMNS * TILE_SIZE, GRID_ROWS * TILE_SIZE);

    for (let y = 1; y < GRID_ROWS - 1; y++) {
        for (let x = 1; x < GRID_COLUMNS - 1; x++) {
            ctx.fillStyle = (x + y) % 2 === 0 ? COLORS.floorLight : COLORS.floorDark;
            ctx.fillRect(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
        }
    }

    // マス目の線
    ctx.beginPath();
    for (let x = 1; x < GRID_COLUMNS; x++) {
        ctx.moveTo(x * TILE_SIZE, TILE_SIZE);
        ctx.lineTo(x * TILE_SIZE, (GRID_ROWS - 1) * TILE_SIZE);
    }
    for (let y = 1; y < GRID_ROWS; y++) {
        ctx.moveTo(TILE_SIZE, y * TILE_SIZE);
        ctx.lineTo((GRID_COLUMNS - 1) * TILE_SIZE, y * TILE_SIZE);
    }
    ctx.strokeStyle = COLORS.grid;
    ctx.lineWidth = 1;
    ctx.stroke();

    // 配置したギミック
    boardData.entities.forEach(({ type, x, y, direction }) => {
        const px = x * TILE_SIZE;
        const py = y * TILE_SIZE;
        ctx.fillStyle = boardData.entities.find((entity) => entity.x === x && entity.y === y)?.color ?? COLORS[type] ?? COLORS.wall;
        ctx.fillRect(px + 4, py + 4, TILE_SIZE - 8, TILE_SIZE - 8);

        if (type === "laser") {
            drawDirectionTriangle(ctx, x, y, direction ?? (x === GRID_COLUMNS - 2 ? "left" : "right"));
        } else {
            const label = LABELS[type];
            if (label) {
                ctx.fillStyle = COLORS.text;
                ctx.font = "bold 14px sans-serif";
                ctx.textAlign = "center";
                ctx.textBaseline = "middle";
                ctx.fillText(label, px + TILE_SIZE / 2, py + TILE_SIZE / 2);
            }
        }
    });

    // スタート位置とゴール
    drawMarker(ctx, boardData.start, COLORS.start, "S");
    drawMarker(ctx, boardData.goal, COLORS.goal, "G");

    if (cursorPreview) drawPlacementPreview(ctx, cursorPreview);

    // レーザーの線は、マス上のすべての表示より前面に描く。
    boardData.entities
        .filter((entity) => entity.type === "laser")
        .forEach((laser) => drawLaserPath(ctx, boardData, laser));
    if (cursorPreview?.type === "laser") {
        drawLaserPath(ctx, boardData, cursorPreview);
    }
}

function drawLaserPath(ctx, boardData, laser) {
    const trace = traceLaserPath(boardData, laser);
    const direction = {
        up: { x: 0, y: -1 },
        down: { x: 0, y: 1 },
        left: { x: -1, y: 0 },
        right: { x: 1, y: 0 },
    }[laser.direction] ?? { x: 1, y: 0 };
    const start = {
        x: (laser.x + 0.5) * TILE_SIZE + direction.x * 12,
        y: (laser.y + 0.5) * TILE_SIZE + direction.y * 12,
    };

    ctx.save();
    for (const tile of trace.tiles) {
        const x = tile.x * TILE_SIZE;
        const y = tile.y * TILE_SIZE;
        ctx.fillStyle = "rgba(235, 55, 70, 0.08)";
        ctx.fillRect(x + 3, y + 3, TILE_SIZE - 6, TILE_SIZE - 6);
        ctx.strokeStyle = "rgba(255, 105, 115, 0.48)";
        ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 4]);
        ctx.strokeRect(x + 3, y + 3, TILE_SIZE - 6, TILE_SIZE - 6);
    }

    ctx.beginPath();
    ctx.moveTo(start.x, start.y);
    ctx.lineTo(trace.endPoint.x, trace.endPoint.y);
    ctx.strokeStyle = "rgba(255, 115, 125, 0.8)";
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 5]);
    ctx.stroke();
    ctx.restore();
}

function drawPlacementPreview(ctx, preview) {
    const { x, y, type, color } = preview;
    if (x < 1 || x >= GRID_COLUMNS - 1 || y < 1 || y >= GRID_ROWS - 1) return;

    const px = x * TILE_SIZE;
    const py = y * TILE_SIZE;
    const isColorTool = ["block", "switch", "colorWall"].includes(type);
    const previewColor = color ?? COLORS[type] ?? "#ffffff";
    const label = type === "start" ? "S"
        : type === "goal" ? "G"
            : type === "eraser" ? "×"
                : LABELS[type] ?? "";

    ctx.save();
    ctx.globalAlpha = isColorTool ? 0.72 : 0.38;
    ctx.fillStyle = type === "eraser" ? "#ff5e68" : previewColor;
    if (type === "start" || type === "goal") {
        ctx.beginPath();
        ctx.arc(px + TILE_SIZE / 2, py + TILE_SIZE / 2, 14, 0, Math.PI * 2);
        ctx.fill();
    } else {
        ctx.fillRect(px + 5, py + 5, TILE_SIZE - 10, TILE_SIZE - 10);
    }

    ctx.globalAlpha = 1;
    ctx.strokeStyle = isColorTool ? previewColor : (type === "eraser" ? "#ff5e68" : "#ffffff");
    ctx.lineWidth = isColorTool ? 4 : 2;
    if (isColorTool) {
        ctx.shadowColor = previewColor;
        ctx.shadowBlur = 12;
    }
    if (type === "start" || type === "goal") {
        ctx.beginPath();
        ctx.arc(px + TILE_SIZE / 2, py + TILE_SIZE / 2, 16, 0, Math.PI * 2);
        ctx.stroke();
    } else {
        ctx.strokeRect(px + 3, py + 3, TILE_SIZE - 6, TILE_SIZE - 6);
    }

    if (type === "laser") {
        drawDirectionTriangle(ctx, x, y, preview.direction ?? "right");
    }

    if (label) {
        ctx.shadowBlur = 0;
        ctx.fillStyle = type === "start" || type === "goal" ? "#101923" : "#ffffff";
        ctx.font = "bold 14px sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(label, px + TILE_SIZE / 2, py + TILE_SIZE / 2);
    }
    ctx.restore();
}

function drawDirectionTriangle(ctx, x, y, direction) {
    const px = x * TILE_SIZE;
    const py = y * TILE_SIZE;
    const points = {
        up: [[20, 8], [10, 28], [30, 28]],
        down: [[20, 32], [10, 12], [30, 12]],
        left: [[8, 20], [28, 10], [28, 30]],
        right: [[32, 20], [12, 10], [12, 30]],
    }[direction] ?? [[32, 20], [12, 10], [12, 30]];

    ctx.beginPath();
    ctx.moveTo(px + points[0][0], py + points[0][1]);
    ctx.lineTo(px + points[1][0], py + points[1][1]);
    ctx.lineTo(px + points[2][0], py + points[2][1]);
    ctx.closePath();
    ctx.fillStyle = "#ffffff";
    ctx.strokeStyle = "#5a1d25";
    ctx.lineWidth = 2;
    ctx.fill();
    ctx.stroke();
}

function drawMarker(ctx, tile, color, label) {
    const centerX = (tile.x + 0.5) * TILE_SIZE;
    const centerY = (tile.y + 0.5) * TILE_SIZE;
    ctx.beginPath();
    ctx.arc(centerX, centerY, 14, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.fillStyle = "#101923";
    ctx.font = "bold 12px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(label, centerX, centerY);
}



