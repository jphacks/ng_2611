import { validateStage } from "../packages/stage-schema/index.js";
import { boardData, renderEditorBoard } from "./edit.js";
import { refreshStageNameDisplay } from "./stage-title.js";

const stageFileInput = document.querySelector("#stage-json-input");
const loadButton = document.querySelector("#load-btn");

function stageToBoard(stage) {
    const entities = [];

    for (const obstacle of stage.obstacles) {
        for (let y = obstacle.y; y < obstacle.y + obstacle.height; y += 1) {
            for (let x = obstacle.x; x < obstacle.x + obstacle.width; x += 1) {
                entities.push({ type: "wall", x, y });
            }
        }
    }

    for (const block of stage.blocks) {
        entities.push({
            type: "block",
            x: block.x,
            y: block.y,
            id: block.id,
            name: block.name,
            kind: block.kind ?? "normal",
            color: block.color,
        });
    }

    for (const item of stage.items) {
        entities.push({ type: item.type, x: item.x, y: item.y, itemType: item.type });
    }

    for (const colorSwitch of stage.colorSwitches) {
        entities.push({
            type: "switch",
            x: colorSwitch.x,
            y: colorSwitch.y,
            color: colorSwitch.color,
        });
    }

    for (const colorWall of stage.colorWalls) {
        for (let y = colorWall.y; y < colorWall.y + colorWall.height; y += 1) {
            for (let x = colorWall.x; x < colorWall.x + colorWall.width; x += 1) {
                entities.push({ type: "colorWall", x, y, color: colorWall.color, mode: colorWall.mode ?? "open" });
            }
        }
    }

    for (const laser of stage.lasers) {
        entities.push({
            type: "laser",
            x: laser.x,
            y: laser.y,
            direction: laser.direction,
        });
    }

    for (const tile of stage.water) {
        entities.push({ type: "water", x: tile.x, y: tile.y });
    }


    return {
        columns: 24,
        rows: 16,
        start: { ...stage.start },
        goal: { ...stage.goal },
        entities,
        metadata: {
            id: stage.id,
            number: stage.number,
            name: stage.name,
            hint: stage.hint,
            initialSkillPotions: stage.initialPasteEnergy ?? stage.initialSkillPotions,
            initialSelectAllPotions: stage.initialSelectAllEnergy ?? stage.initialSelectAllPotions,
        },
    };
}

function diagnosticsText(diagnostics) {
    return diagnostics
        .map(({ path, message }) => (path ? path + ": " : "") + message)
        .join("\n");
}

async function loadStageFile(file, sourceHandle = null) {
    try {
        let stage;
        try {
            stage = JSON.parse(await file.text());
        } catch (error) {
            window.alert("JSONを読み取れませんでした。ファイルの内容を確認してください。\n" + error.message);
            return;
        }

        const validation = validateStage(stage);
        if (!validation.ok) {
            window.alert("このJSONはステージ形式に合っていません。\n\n"
                + diagnosticsText(validation.errors));
            return;
        }

        if (validation.warnings.length && !window.confirm(
            "次の警告があります。読み込みますか？\n\n"
            + diagnosticsText(validation.warnings),
        )) return;

        const loadedBoard = stageToBoard(stage);
        boardData.start = loadedBoard.start;
        boardData.goal = loadedBoard.goal;
        boardData.entities = loadedBoard.entities;
        boardData.metadata = loadedBoard.metadata;
        document.dispatchEvent(new CustomEvent("stage-file-loaded", { detail: { handle: sourceHandle } }));
        refreshStageNameDisplay();

        renderEditorBoard();
        const status = document.querySelector("#tool-status");
        if (status) status.textContent = "読み込みました: " + stage.name;
    } catch (error) {
        const status = document.querySelector("#tool-status");
        if (status) status.textContent = "読み込みに失敗しました。";
        window.alert("読み込みに失敗しました: " + error.message);
    }
}

loadButton?.addEventListener("click", async () => {
    if (typeof window.showOpenFilePicker !== "function" || !window.isSecureContext) {
        stageFileInput?.click();
        return;
    }

    try {
        const [handle] = await window.showOpenFilePicker({
            multiple: false,
            mode: "readwrite",
            types: [{
                description: "ステージJSON",
                accept: { "application/json": [".json"] },
            }],
        });
        const file = await handle.getFile();
        await loadStageFile(file, handle);
    } catch (error) {
        if (error.name !== "AbortError") {
            window.alert("JSONファイルを開けませんでした。\n" + error.message);
        }
    }
});

stageFileInput?.addEventListener("change", async () => {
    const file = stageFileInput.files?.[0];
    if (file) await loadStageFile(file);
    stageFileInput.value = "";
});
