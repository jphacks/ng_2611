import { boardData } from "./editor-state.js";

const stageNameDisplay = document.querySelector("#stage-name-display");

export function refreshStageNameDisplay() {
    if (!stageNameDisplay) return;
    stageNameDisplay.textContent = boardData.metadata?.name || "新しいステージ";
}

export function updateStageMetadata(metadata) {
    boardData.metadata = { ...(boardData.metadata ?? {}), ...metadata };
    refreshStageNameDisplay();
}

document.addEventListener("stage-name-change", (event) => {
    const name = event.detail?.name;
    if (typeof name === "string" && name.trim()) {
        updateStageMetadata({ name: name.trim() });
    }
});

refreshStageNameDisplay();