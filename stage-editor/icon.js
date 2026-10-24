const instruction = document.querySelector("#instruction");
const menuToggle = document.querySelector("#menu-toggle");

menuToggle.addEventListener("click", () => {
    const isOpen = instruction.classList.toggle("menu-open");
    menuToggle.setAttribute("aria-expanded", isOpen);
});