const instruction = document.querySelector("#instruction");
const menuToggle = document.querySelector("#menu-toggle");
const nameChangeButton = document.querySelector("#name-change-btn");
const nameDisplay = document.querySelector("#stage-name-display");
const nameEditor = document.querySelector("#stage-name-editor");
const nameInput = document.querySelector("#stage-name-input");
const nameConfirmButton = document.querySelector("#stage-name-confirm");
const nameCancelButton = document.querySelector("#stage-name-cancel");
const nameError = document.querySelector("#stage-name-error");

menuToggle?.addEventListener("click", () => {
    const isOpen = instruction.classList.toggle("menu-open");
    menuToggle.setAttribute("aria-expanded", String(isOpen));
});

function openNameEditor() {
    if (!nameEditor || !nameInput || !nameDisplay) return;
    nameInput.value = nameDisplay.textContent.trim();
    nameError.hidden = true;
    nameEditor.hidden = false;
    nameInput.focus();
    nameInput.select();
}

function closeNameEditor() {
    if (!nameEditor) return;
    nameEditor.hidden = true;
    if (nameError) nameError.hidden = true;
}

function saveStageName() {
    if (!nameInput || !nameDisplay) return;
    const name = nameInput.value.trim();
    if (!name || [...name].length > 40) {
        nameError.textContent = "ステージ名を1〜40文字で入力してください。";
        nameError.hidden = false;
        nameInput.focus();
        return;
    }

    nameDisplay.textContent = name;
    closeNameEditor();
    document.dispatchEvent(new CustomEvent("stage-name-change", { detail: { name } }));
}

nameChangeButton?.addEventListener("click", openNameEditor);
nameConfirmButton?.addEventListener("click", saveStageName);
nameCancelButton?.addEventListener("click", closeNameEditor);
nameInput?.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
        event.preventDefault();
        saveStageName();
    } else if (event.key === "Escape") {
        closeNameEditor();
    }
});