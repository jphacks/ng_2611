import { validateStage } from "../packages/stage-schema/index.js";
import { ITEM_TYPES } from "../packages/stage-schema/constants.js";
import { boardData } from "./edit.js";
import { getInitialSelectAllPotions, getInitialSkillPotions } from "./editor-state.js";
import { updateStageMetadata } from "./stage-title.js";

const saveButton = document.querySelector("#save-btn");
const saveDialog = document.querySelector("#save-dialog");
const saveForm = document.querySelector("#save-form");
const idInput = document.querySelector("#save-id");
const numberInput = document.querySelector("#save-number");
const nameInput = document.querySelector("#save-name");
const hintInput = document.querySelector("#save-hint");
const errorText = document.querySelector("#save-error");
const noticeText = document.querySelector("#save-existing");
const statusText = document.querySelector("#save-status");
const cancelButton = document.querySelector("#save-cancel");
const submitButton = document.querySelector("#save-submit");

const BLOCK_COLOR = "#b57d50";
const SWITCH_COLOR = "#ff5e68";
const STAGE_ID_PATTERN = /^[a-z0-9][a-z0-9-]{2,63}$/;
const PICKER_TYPE = [
    { description: "ステージJSON", accept: { "application/json": [".json"] } },
];
const SAVE_ENDPOINT = "/__stage-editor/save";
const LIST_ENDPOINT = "/__stage-editor/stages";
const LIST_TIMEOUT_MS = 1500;

let existingStageIds = new Set();
let nextStageNumber = 1;
let existingStagesPromise = null;

function makeSafeFilename(id) {
    return `${id}.json`;
}

function makeStage(id, name, number, hint) {
    const entities = boardData.entities;
    const stage = {
        schemaVersion: 1,
        id,
        number,
        name,
        start: {
            x: boardData.start.x,
            y: boardData.start.y,
            facing: boardData.start.facing ?? "right",
        },
        obstacles: entities
            .filter((item) => item.type === "wall")
            .map(({ x, y }) => ({ x, y, width: 1, height: 1 })),
        items: entities
            .filter((item) => ITEM_TYPES.includes(item.type) || ITEM_TYPES.includes(item.itemType))
            .map(({ x, y, type, itemType }) => ({ type: itemType ?? type, x, y })),
        blocks: entities
            .filter((item) => item.type === "block")
            .map(({ x, y, id: blockId, name: blockName, kind, color }, index) => ({
                id: blockId ?? "crate-" + (index + 1),
                name: blockName ?? "木箱",
                kind: kind ?? "normal",
                x,
                y,
                color: color ?? BLOCK_COLOR,
            })),
        colorSwitches: entities
            .filter((item) => item.type === "switch")
            .map(({ x, y, color }) => ({ x, y, color: color ?? SWITCH_COLOR })),
        colorWalls: entities
            .filter((item) => item.type === "colorWall")
            .map(({ x, y, color, mode }) => ({ x, y, width: 1, height: 1, color: color ?? "#ff5e68", mode: mode ?? "open" })),
        lasers: entities
            .filter((item) => item.type === "laser")
            .map(({ x, y, direction }) => ({
                x,
                y,
                direction: direction ?? (x === boardData.columns - 2 ? "left" : "right"),
            })),
        water: entities
            .filter((item) => item.type === "water")
            .map(({ x, y }) => ({ x, y })),
        goal: { ...boardData.goal },
        hint,
    };

    stage.initialPasteEnergy = getInitialSkillPotions();
    stage.initialSelectAllEnergy = getInitialSelectAllPotions();
    return stage;
}

function setSaveStatus(message) {
    if (!statusText) return;
    statusText.textContent = message;
}

function showError(message) {
    if (!errorText) return;
    errorText.textContent = message;
    errorText.hidden = !message;
}

function diagnosticsText(diagnostics) {
    return diagnostics
        .map(({ path, message }) => (path ? path + ": " : "") + message)
        .join("\n");
}

function isJsonResponse(response) {
    return String(response.headers.get("content-type") ?? "").toLowerCase().includes("application/json");
}

async function loadExistingStages() {
    if (existingStagesPromise) return existingStagesPromise;

    existingStagesPromise = (async () => {
        try {
            const response = await fetch(LIST_ENDPOINT, {
                headers: { Accept: "application/json" },
                signal: AbortSignal.timeout?.(LIST_TIMEOUT_MS),
            });
            if (!response.ok || !isJsonResponse(response)) return [];
            const data = await response.json();
            return Array.isArray(data?.stages) ? data.stages : [];
        } catch {
            // 開発サーバー以外では一覧を取得できないので、入力補助は行わない
            return [];
        }
    })();

    const stages = await existingStagesPromise;
    existingStageIds = new Set(
        stages
            .map((stage) => stage?.id)
            .filter((id) => typeof id === "string" && id),
    );
    const numbers = stages
        .map((stage) => stage?.number)
        .filter((number) => Number.isInteger(number) && number >= 1);
    nextStageNumber = numbers.length ? Math.max(...numbers) + 1 : 1;
    return stages;
}

function updateExistingNotice() {
    if (!noticeText) return;
    const id = (idInput?.value ?? "").trim();
    if (existingStageIds.has(id)) {
        noticeText.textContent = `既存ステージ「${id}」と同じIDです。保存すると同名ファイルとして上書きされます。`;
        noticeText.hidden = false;
    } else {
        noticeText.textContent = "";
        noticeText.hidden = true;
    }
}

function stageJsonText(stage) {
    return JSON.stringify(stage, null, 2) + "\n";
}

function downloadJson(stage) {
    const blob = new Blob([stageJsonText(stage)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = makeSafeFilename(stage.id);
    link.rel = "noopener";
    link.style.display = "none";
    document.body.append(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 60000);
}

async function saveToProject(stage) {
    let response;
    try {
        response = await fetch(SAVE_ENDPOINT, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ stage }),
        });
    } catch {
        return null;
    }

    // 静的ホスティングではエンドポイントが存在しない（HTMLが返る）
    if (!isJsonResponse(response)) return null;

    const data = await response.json().catch(() => null);
    if (!response.ok || !data?.ok) {
        const details = Array.isArray(data?.diagnostics) ? "\n\n" + diagnosticsText(data.diagnostics) : "";
        const error = new Error((data?.error ?? "開発サーバーへ保存できませんでした。") + details);
        error.name = "ProjectSaveError";
        throw error;
    }

    return { name: data.file ?? makeSafeFilename(stage.id), how: "project" };
}

async function pickSaveHandle(filename) {
    if (typeof window.showSaveFilePicker !== "function") return null;
    try {
        return await window.showSaveFilePicker({
            suggestedName: filename,
            types: PICKER_TYPE,
        });
    } catch (error) {
        if (error?.name === "AbortError") throw error;
        // 権限なし・未対応などはダウンロードへ切り替える
        console.warn("[stage-editor] 保存ダイアログを使えないためダウンロードします", error);
        return null;
    }
}

async function ensureWritePermission(handle) {
    if (typeof handle.queryPermission !== "function") return;
    const options = { mode: "readwrite" };
    let permission = await handle.queryPermission(options);
    if (permission === "granted") return;
    if (typeof handle.requestPermission === "function") {
        permission = await handle.requestPermission(options);
    }
    if (permission !== "granted") {
        throw Object.assign(new Error("ファイルへの書き込みが許可されませんでした。"), {
            name: "NotAllowedError",
        });
    }
}

async function writeJson(stage) {
    const filename = makeSafeFilename(stage.id);

    const project = await saveToProject(stage);
    if (project) return project;

    const pickerAvailable = typeof window.showSaveFilePicker === "function";
    let handle = null;
    try {
        handle = await pickSaveHandle(filename);
    } catch (error) {
        if (error?.name === "AbortError") throw error;
    }

    if (handle) {
        try {
            await ensureWritePermission(handle);
            const writable = await handle.createWritable();
            try {
                await writable.write(new Blob([stageJsonText(stage)], { type: "application/json" }));
            } finally {
                await writable.close();
            }
            return { name: handle.name || filename, how: "picker" };
        } catch (error) {
            if (error?.name === "AbortError") throw error;
            console.warn("[stage-editor] ファイルへ書き込めなかったため、ダウンロードに切り替えます", error);
        }
    }

    downloadJson(stage);
    return { name: filename, how: "download", pickerFailed: pickerAvailable };
}

function savedMessage(result) {
    if (result.how === "project") {
        return `保存しました。${result.name} に書き込みました。npm run build でゲームに反映されます。`;
    }
    if (result.how === "picker") {
        return `保存しました。${result.name} に書き込みました。src/data/stages/ に置いて npm run build してください。`;
    }
    const reason = result.pickerFailed ? "保存ダイアログを使えなかったため、" : "";
    return `保存しました。${reason}${result.name} をダウンロードしました。src/data/stages/ に置いて npm run build してください。`;
}

function setBusy(busy) {
    if (submitButton) {
        submitButton.disabled = busy;
        submitButton.textContent = busy ? "保存中…" : "JSONを保存";
    }
    if (cancelButton) cancelButton.disabled = busy;
    if (idInput) idInput.disabled = busy;
    if (numberInput) numberInput.disabled = busy;
    if (nameInput) nameInput.disabled = busy;
    if (hintInput) hintInput.disabled = busy;
}

async function openSaveDialog() {
    if (!saveDialog || !saveForm) {
        window.alert("保存ダイアログを読み込めませんでした。ページを再読み込みしてください。");
        return;
    }

    await loadExistingStages();

    const metadata = boardData.metadata ?? {};
    if (idInput) {
        idInput.value = typeof metadata.id === "string" && STAGE_ID_PATTERN.test(metadata.id)
            ? metadata.id
            : `stage-${Date.now()}`;
    }
    if (numberInput) {
        numberInput.value = Number.isInteger(metadata.number) && metadata.number >= 1
            ? String(metadata.number)
            : String(nextStageNumber);
    }
    if (nameInput) {
        nameInput.value = typeof metadata.name === "string" && metadata.name.trim()
            ? metadata.name.trim()
            : "新しいステージ";
    }
    if (hintInput) {
        hintInput.value = typeof metadata.hint === "string" ? metadata.hint : "";
    }

    showError("");
    setBusy(false);
    updateExistingNotice();

    if (typeof saveDialog.showModal === "function") {
        if (!saveDialog.open) saveDialog.showModal();
    } else {
        saveDialog.setAttribute("open", "");
    }

    idInput?.focus();
    idInput?.select();
}

function closeSaveDialog() {
    if (!saveDialog) return;
    if (typeof saveDialog.close === "function" && saveDialog.open) {
        saveDialog.close();
    } else {
        saveDialog.removeAttribute("open");
    }
}

function readDetails() {
    return {
        id: (idInput?.value ?? "").trim(),
        number: Number(numberInput?.value),
        name: (nameInput?.value ?? "").trim() || "新しいステージ",
        hint: hintInput?.value ?? "",
    };
}

async function saveStageFromDialog(event) {
    event.preventDefault();
    showError("");

    const details = readDetails();
    if (!STAGE_ID_PATTERN.test(details.id)) {
        showError("ステージIDは英小文字・数字・ハイフンで3〜64文字にしてください。先頭は英小文字か数字です。");
        idInput?.focus();
        return;
    }
    if (!Number.isInteger(details.number) || details.number < 1) {
        showError("ステージ番号は1以上の整数にしてください。");
        numberInput?.focus();
        return;
    }

    let stage;
    try {
        stage = makeStage(details.id, details.name, details.number, details.hint);
    } catch (error) {
        showError("ステージを保存できません。\n" + error.message);
        return;
    }

    const validation = validateStage(stage);
    if (!validation.ok) {
        showError("ステージを保存できません。\n\n" + diagnosticsText(validation.errors));
        return;
    }

    setBusy(true);
    try {
        const result = await writeJson(stage);
        updateStageMetadata(details);
        if (result.how === "project") {
            // 次回の入力補助に新しいステージを反映する
            existingStagesPromise = null;
        }
        closeSaveDialog();
        setSaveStatus(savedMessage(result));
    } catch (error) {
        if (error?.name === "AbortError") {
            setBusy(false);
            setSaveStatus("保存をキャンセルしました。");
            return;
        }
        showError("保存に失敗しました。\n原因: " + (error?.name ?? "Error") + " " + (error?.message ?? ""));
        setSaveStatus("保存できませんでした。");
        setBusy(false);
    }
}

saveButton?.addEventListener("click", openSaveDialog);
saveForm?.addEventListener("submit", saveStageFromDialog);
idInput?.addEventListener("input", updateExistingNotice);
cancelButton?.addEventListener("click", () => closeSaveDialog());
