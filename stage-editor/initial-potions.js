import {
    boardData,
    getInitialSelectAllPotions,
    getInitialSkillPotions,
    setInitialSelectAllPotions,
    setInitialSkillPotions,
} from "./editor-state.js";

const pasteCountDisplay = document.querySelector("#initial-paste-count");
const pasteDecreaseButton = document.querySelector("#initial-paste-decrease");
const pasteIncreaseButton = document.querySelector("#initial-paste-increase");
const selectAllCountDisplay = document.querySelector("#initial-select-all-count");
const selectAllDecreaseButton = document.querySelector("#initial-select-all-decrease");
const selectAllIncreaseButton = document.querySelector("#initial-select-all-increase");

function refreshInitialPotionDisplay() {
    const pasteCount = getInitialSkillPotions();
    const selectAllCount = getInitialSelectAllPotions();
    if (pasteCountDisplay) pasteCountDisplay.textContent = String(pasteCount);
    if (pasteDecreaseButton) pasteDecreaseButton.disabled = pasteCount <= 0;
    if (selectAllCountDisplay) selectAllCountDisplay.textContent = String(selectAllCount);
    if (selectAllDecreaseButton) selectAllDecreaseButton.disabled = selectAllCount <= 0;
}

function changePastePotions(delta) {
    setInitialSkillPotions(getInitialSkillPotions() + delta);
    refreshInitialPotionDisplay();
}

function changeSelectAllPotions(delta) {
    setInitialSelectAllPotions(getInitialSelectAllPotions() + delta);
    refreshInitialPotionDisplay();
}

function syncInitialPotionsFromBoard() {
    const pasteCount = boardData.metadata?.initialSkillPotions;
    const selectAllCount = boardData.metadata?.initialSelectAllPotions;
    setInitialSkillPotions(Number.isInteger(pasteCount) && pasteCount >= 0 ? pasteCount : 0);
    setInitialSelectAllPotions(Number.isInteger(selectAllCount) && selectAllCount >= 0 ? selectAllCount : 0);
    refreshInitialPotionDisplay();
}

export function initInitialPotionControl() {
    pasteDecreaseButton?.addEventListener("click", () => changePastePotions(-1));
    pasteIncreaseButton?.addEventListener("click", () => changePastePotions(1));
    selectAllDecreaseButton?.addEventListener("click", () => changeSelectAllPotions(-1));
    selectAllIncreaseButton?.addEventListener("click", () => changeSelectAllPotions(1));
    document.addEventListener("stage-file-loaded", syncInitialPotionsFromBoard);
    document.addEventListener("stage-new-map", syncInitialPotionsFromBoard);
    syncInitialPotionsFromBoard();
}

initInitialPotionControl();
