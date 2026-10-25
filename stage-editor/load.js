import { validateStage } from "../packages/stage-schema/index.js";
import { boardData, renderEditorBoard } from "./edit.js";
import { refreshStageNameDisplay } from "./stage-title.js";

const stageFileInput = document.querySelector("#stage-json-input");
const loadButton = document.querySelector("#load-btn");
const stageManagerDialog = document.querySelector("#stage-manager-dialog");
const stageManagerList = document.querySelector("#stage-manager-list");
const stageManagerStatus = document.querySelector("#stage-manager-status");
const stageManagerClose = document.querySelector("#stage-manager-close");
const stageManagerRefresh = document.querySelector("#stage-manager-refresh");
const openFileButton = document.querySelector("#open-file-btn");
const LIST_ENDPOINT = "/__stage-editor/stages";

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

function setManagerStatus(message = "") {
    if (!stageManagerStatus) return;
    stageManagerStatus.textContent = message;
    stageManagerStatus.hidden = !message;
}

function closeStageManager() {
    if (!stageManagerDialog) return;
    if (typeof stageManagerDialog.close === "function" && stageManagerDialog.open) {
        stageManagerDialog.close();
    } else {
        stageManagerDialog.removeAttribute("open");
    }
}

function stageUrl(id) {
    return `${LIST_ENDPOINT}/${encodeURIComponent(id)}`;
}

async function loadProjectStage(id) {
    const response = await fetch(stageUrl(id), { headers: { Accept: "application/json" } });
    const data = await response.json().catch(() => null);
    if (!response.ok || !data?.stage) throw new Error(data?.error ?? "ステージを読み込めませんでした。");

    const file = new File([JSON.stringify(data.stage)], `${id}.json`, { type: "application/json" });
    await loadStageFile(file);
    closeStageManager();
}

async function deleteProjectStage(stage) {
    const label = `ステージ${stage.number}: ${stage.name}（${stage.id}）`;
    if (!window.confirm(`${label} を削除します。\n\nこの操作は src/data/stages/${stage.id}.json を削除します。Gitで管理している場合は履歴から復元できます。`)) return;

    const response = await fetch(stageUrl(stage.id), { method: "DELETE", headers: { Accept: "application/json" } });
    const data = await response.json().catch(() => null);
    if (!response.ok || !data?.ok) throw new Error(data?.error ?? "削除できませんでした。");
    await renderProjectStages();
    const status = document.querySelector("#tool-status");
    if (status) status.textContent = `削除しました: ${stage.name}`;
}

function makeStageRow(stage) {
    const row = document.createElement("article");
    row.className = "stage-manager-row";
    const details = document.createElement("div");
    details.className = "stage-manager-row-main";
    const title = document.createElement("strong");
    title.textContent = `ステージ${stage.number}: ${stage.name}`;
    const id = document.createElement("span");
    id.textContent = stage.id;
    details.append(title, id);

    const actions = document.createElement("div");
    actions.className = "stage-manager-row-actions";
    const edit = document.createElement("button");
    edit.className = "btn";
    edit.type = "button";
    edit.textContent = "編集";
    edit.addEventListener("click", () => loadProjectStage(stage.id).catch((error) => setManagerStatus(error.message)));
    const remove = document.createElement("button");
    remove.className = "btn stage-delete-button";
    remove.type = "button";
    remove.textContent = "削除";
    remove.addEventListener("click", () => deleteProjectStage(stage).catch((error) => setManagerStatus(error.message)));
    actions.append(edit, remove);
    row.append(details, actions);
    return row;
}

async function renderProjectStages() {
    if (!stageManagerList) return;
    setManagerStatus("");
    stageManagerList.replaceChildren();
    const loading = document.createElement("p");
    loading.textContent = "ステージ一覧を読み込み中…";
    stageManagerList.append(loading);
    try {
        const response = await fetch(LIST_ENDPOINT, { headers: { Accept: "application/json" } });
        const data = await response.json().catch(() => null);
        if (!response.ok || !Array.isArray(data?.stages)) throw new Error("開発サーバーから一覧を取得できませんでした。JSONファイルを選んで開くことはできます。");
        stageManagerList.replaceChildren();
        if (data.stages.length === 0) {
            const empty = document.createElement("p");
            empty.textContent = "保存済みステージはありません。";
            stageManagerList.append(empty);
            return;
        }
        data.stages.forEach((stage) => stageManagerList.append(makeStageRow(stage)));
    } catch (error) {
        stageManagerList.replaceChildren();
        setManagerStatus(error.message);
    }
}

async function openStageManager() {
    if (!stageManagerDialog) {
        stageFileInput?.click();
        return;
    }
    if (typeof stageManagerDialog.showModal === "function") {
        if (!stageManagerDialog.open) stageManagerDialog.showModal();
    } else {
        stageManagerDialog.setAttribute("open", "");
    }
    await renderProjectStages();
}

async function openStageFilePicker() {
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
}

loadButton?.addEventListener("click", openStageManager);
openFileButton?.addEventListener("click", openStageFilePicker);
stageManagerClose?.addEventListener("click", closeStageManager);
stageManagerRefresh?.addEventListener("click", () => renderProjectStages());

stageFileInput?.addEventListener("change", async () => {
    const file = stageFileInput.files?.[0];
    if (file) await loadStageFile(file);
    stageFileInput.value = "";
});
