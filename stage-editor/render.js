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
    start: "#70e1c1",
    goal: "#f3c969",
    text: "#ffffff",
};

const LABELS = {
    block: "箱",
    water: "水",
    switch: "S",
    door: "扉",
    laser: "L",
};

export function renderBoard(boardData) {
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
    boardData.entities.forEach(({ type, x, y }) => {
        const px = x * TILE_SIZE;
        const py = y * TILE_SIZE;
        ctx.fillStyle = COLORS[type] ?? COLORS.wall;
        ctx.fillRect(px + 4, py + 4, TILE_SIZE - 8, TILE_SIZE - 8);

        const label = LABELS[type];
        if (label) {
            ctx.fillStyle = COLORS.text;
            ctx.font = "bold 14px sans-serif";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText(label, px + TILE_SIZE / 2, py + TILE_SIZE / 2);
        }
    });

    // スタート位置とゴール
    drawMarker(ctx, boardData.start, COLORS.start, "S");
    drawMarker(ctx, boardData.goal, COLORS.goal, "G");
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
