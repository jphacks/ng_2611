import { validateStage } from "../packages/stage-schema/index.js";
import { ITEM_TYPES } from "../packages/stage-schema/constants.js";
import { boardData } from "./edit.js";
import { getInitialSelectAllPotions, getInitialSkillPotions } from "./editor-state.js";
import { updateStageMetadata } from "./stage-title.js";

const saveButton = document.querySelector("#save-btn");
const BLOCK_COLOR = "#b57d50";
const SWITCH_COLOR = "#ff5e68";
const STAGE_ID_PATTERN = /^[a-z0-9][a-z0-9-]{2,63}$/;

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
    const status = document.querySelector("#tool-status");
    if (status) status.textContent = message;
}

function diagnosticsText(diagnostics) {
    return diagnostics
        .map(({ path, message }) => (path ? path + ": " : "") + message)
        .join("\n");
}


function downloadJson(stage) {
    const blob = new Blob([JSON.stringify(stage, null, 2) + "\n"], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = makeSafeFilename(stage.id);
    link.style.display = "none";
    document.body.append(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 60000);
}

async function saveStage() {
    const metadata = boardData.metadata ?? {};
    const existingId = typeof metadata.id === "string" && STAGE_ID_PATTERN.test(metadata.id)
        ? metadata.id
        : null;
    const suggestedId = existingId ?? `stage-${Date.now()}`;
    const enteredId = existingId ?? window.prompt(
        "ステージIDを入力してください（英小文字・数字・ハイフン）。出力ファイル名にも使います。",
        suggestedId,
    );
    if (enteredId === null) return;
    const id = enteredId.trim();
    if (!STAGE_ID_PATTERN.test(id)) {
        window.alert("ステージIDは英小文字・数字・ハイフンで3〜64文字にしてください。");
        setSaveStatus("ステージIDを確認してください。");
        return;
    }

    const existingNumber = Number.isInteger(metadata.number) && metadata.number >= 1
        ? metadata.number
        : null;
    const enteredNumber = existingNumber ?? window.prompt(
        "ステージ番号を入力してください（既存のステージと重複しない1以上の整数）。",
        "",
    );
    if (enteredNumber === null) return;
    const number = Number(enteredNumber);
    if (!Number.isInteger(number) || number < 1) {
        window.alert("ステージ番号は1以上の整数にしてください。");
        setSaveStatus("ステージ番号を確認してください。");
        return;
    }

    const details = {
        id,
        name: typeof metadata.name === "string" && metadata.name.trim()
            ? metadata.name.trim()
            : "新しいステージ",
        number,
        hint: typeof metadata.hint === "string" ? metadata.hint : "",
    };

    let stage;
    try {
        stage = makeStage(details.id, details.name, details.number, details.hint);
    } catch (error) {
        window.alert("ステージを保存できません。\n" + error.message);
        setSaveStatus("保存できませんでした。");
        return;
    }

    const validation = validateStage(stage);
    if (!validation.ok) {
        window.alert("ステージを保存できません。\n\n" + diagnosticsText(validation.errors));
        setSaveStatus("保存できませんでした。エラー内容を確認してください。");
        return;
    }

    try {
        downloadJson(stage);
        updateStageMetadata(details);
        setSaveStatus("JSONをダウンロードしました: " + makeSafeFilename(details.id));
        window.alert("ステージを保存しました。ダウンロードフォルダーを確認してください。\nファイル名: " + makeSafeFilename(details.id));
    } catch (error) {
        setSaveStatus("保存に失敗しました。");
        window.alert("JSONをダウンロードできませんでした。\n原因: " + error.name + "\n" + error.message);
    }
}

saveButton?.addEventListener("click", saveStage);
