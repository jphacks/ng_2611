const TILE_SIZE = 40;
const DIRECTIONS = {
    up: { x: 0, y: -1 },
    down: { x: 0, y: 1 },
    left: { x: -1, y: 0 },
    right: { x: 1, y: 0 },
};

function initiallyOpenColorWalls(boardData) {
    const openColors = new Set();
    const switches = boardData.entities.filter((entity) => entity.type === "switch");
    const coloredBlocks = boardData.entities.filter(
        (entity) => entity.type === "block" && entity.kind === "colored",
    );

    for (const switchTile of switches) {
        const blockOnSwitch = coloredBlocks.find((block) => (
            block.x === switchTile.x
            && block.y === switchTile.y
            && block.color?.toLowerCase() === switchTile.color?.toLowerCase()
        ));
        if (blockOnSwitch) openColors.add(switchTile.color?.toLowerCase());
    }
    return openColors;
}

function blocksLaser(boardData, x, y, openColors, source) {
    return boardData.entities.some((entity) => {
        if (entity.x !== x || entity.y !== y || entity === source) return false;
        if (["wall", "door", "laser"].includes(entity.type)) return true;
        if (entity.type === "colorWall") {
            return !openColors.has(entity.color?.toLowerCase());
        }
        return entity.type === "block" && entity.kind !== "colored";
    });
}

function facePoint(tileX, tileY, direction) {
    return {
        x: (tileX + 0.5) * TILE_SIZE - direction.x * TILE_SIZE / 2,
        y: (tileY + 0.5) * TILE_SIZE - direction.y * TILE_SIZE / 2,
    };
}

export function traceLaserPath(boardData, laser) {
    const direction = DIRECTIONS[laser.direction] ?? DIRECTIONS.right;
    const tiles = [];
    const openColors = initiallyOpenColorWalls(boardData);
    let length = 0;
    let endPoint = {
        x: (laser.x + 0.5) * TILE_SIZE + direction.x * 12,
        y: (laser.y + 0.5) * TILE_SIZE + direction.y * 12,
    };

    for (let step = 1; step <= Math.max(boardData.columns, boardData.rows); step += 1) {
        const x = laser.x + direction.x * step;
        const y = laser.y + direction.y * step;
        length = step;

        if (x <= 0 || y <= 0 || x >= boardData.columns - 1 || y >= boardData.rows - 1) {
            endPoint = facePoint(x, y, direction);
            length = step - 1;
            break;
        }

        if (blocksLaser(boardData, x, y, openColors, laser)) {
            endPoint = facePoint(x, y, direction);
            break;
        }

        tiles.push({ x, y });
        endPoint = { x: (x + 0.5) * TILE_SIZE, y: (y + 0.5) * TILE_SIZE };
    }

    return { tiles, length: Math.max(1, length), endPoint };
}
