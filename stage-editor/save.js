import { validateStage } from "../packages/stage-schema/index.js";
import { ITEM_TYPES } from "../packages/stage-schema/constants.js";
import { boardData } from "./edit.js";
import { getInitialSelectAllPotions, getInitialSkillPotions } from "./editor-state.js";
import { traceLaserPath } from "./laser-path.js";
import { updateStageMetadata } from "./stage-title.js";

const saveButton = document.querySelector("#save-btn");
const BLOCK_COLOR = "#b57d50";
const SWITCH_COLOR = "#ff5e68";
const STAGE_ID_PATTERN = /^[a-z0-9][a-z0-9-]{2,63}$/;

function makeSafeFilename(name) {
  const safeName = name
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, "_")
    .trim()
    .replace(/[. ]+$/, "");

  return (safeName || "新しいステージ") + ".json";
}


function makeStage(id, name, number, hint) {
    const entities = boardData.entities;
    const doors = entities.filter((item) => item.type === "door");
    if (doors.length > 1) throw new Error("ドアは1つまでしか保存できません。");

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
            .map(({ x, y, color }) => ({ x, y, width: 1, height: 1, color: color ?? "#ff5e68" })),
        lasers: entities
            .filter((item) => item.type === "laser")
            .map(({ x, y, direction }) => {
                const laserDirection = direction ?? (x === boardData.columns - 2 ? "left" : "right");
                const trace = traceLaserPath(boardData, { x, y, direction: laserDirection });
                return { x, y, direction: laserDirection, length: trace.length };
            }),
        water: entities
            .filter((item) => item.type === "water")
            .map(({ x, y }) => ({ x, y })),
        goal: { ...boardData.goal },
        shortcutGate: doors.length ? { x: doors[0].x, y: doors[0].y } : null,
        hint,
    };

    stage.initialSkillPotions = getInitialSkillPotions();
    stage.initialSelectAllPotions = getInitialSelectAllPotions();
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


async function chooseSaveFile(suggestedName) {
    if (
        typeof window.showSaveFilePicker !== "function" ||
        !window.isSecureContext
    ) {
        return { fileHandle: null, cancelled: false };
    }

    try {
        const fileHandle = await window.showSaveFilePicker({
            suggestedName: makeSafeFilename(suggestedName),
            types: [{
                description: "ステージJSON",
                accept: { "application/json": [".json"] },
            }],
        });

        return { fileHandle, cancelled: false };
    } catch (error) {
        if (error.name === "AbortError") {
            return { fileHandle: null, cancelled: true };
        }

        window.alert(
            "保存先を選べなかったため、JSONのダウンロード保存に切り替えます。\n" +
            error.message
        );

        return { fileHandle: null, cancelled: false };
    }
}



function downloadJson(stage) {
    const blob = new Blob([JSON.stringify(stage, null, 2) + "\n"], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = makeSafeFilename(stage.name);
    link.style.display = "none";
    document.body.append(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 60000);
}

async function writeToFile(fileHandle, stage) {
    const writable = await fileHandle.createWritable();
    try {
        await writable.write(JSON.stringify(stage, null, 2) + "\n");
        await writable.close();
    } catch (error) {
        await writable.abort?.();
        throw error;
    }
}

async function saveStage() {
    const metadata = boardData.metadata ?? {};
    const suggestedId = typeof metadata.id === "string" && STAGE_ID_PATTERN.test(metadata.id)
        ? metadata.id
        : "new-stage";
    const details = {
        id: suggestedId,
        name: typeof metadata.name === "string" && metadata.name.trim()
            ? metadata.name.trim()
            : "新しいステージ",
        number: Number.isInteger(metadata.number) && metadata.number >= 1
            ? metadata.number
            : 6,
        hint: typeof metadata.hint === "string" ? metadata.hint : "",
    };

    setSaveStatus("フォルダーを選択してください。");
    const target = await chooseSaveFile(details.name);
    if (target.cancelled) {
        if (target.invalidName) {
            setSaveStatus("ファイル名を確認してください。");
        } else {
            setSaveStatus("フォルダーを選択してください。");
            window.alert("フォルダーを選択してください。");
        }
        return;
    }

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
        if (target.fileHandle) {
            const finalValidation = validateStage(stage);
            if (!finalValidation.ok) {
                window.alert("選択したファイル名では保存できません。\n\n" + diagnosticsText(finalValidation.errors));
                setSaveStatus("保存できませんでした。");
                return;
            }
            await writeToFile(target.fileHandle, stage);
            updateStageMetadata(details);
            setSaveStatus("保存しました: " + target.fileHandle.name);
            window.alert("保存しました: " + target.fileHandle.name);
        } else {
            downloadJson(stage);
            updateStageMetadata(details);
            setSaveStatus("ダウンロードしました: " + details.id + ".json");
            window.alert("ブラウザーがフォルダー選択に対応していないため、JSONをダウンロードしました。");
        }
    } catch (error) {
        try {
            downloadJson(stage);
            updateStageMetadata(details);
            setSaveStatus("選択先への保存に失敗したため、ダウンロードしました: " + stage.id + ".json");
            window.alert("選択した場所への保存に失敗したため、JSONをダウンロードしました。ダウンロード一覧を確認してください。\n原因: " + error.name + "\n" + error.message);
        } catch (downloadError) {
            setSaveStatus("保存に失敗しました。");
            window.alert("保存とダウンロードの両方に失敗しました。\n原因: " + downloadError.name + "\n" + downloadError.message);
        }
    }
}

saveButton?.addEventListener("click", saveStage);