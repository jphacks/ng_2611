import { initCanvasEditor } from "./editor-canvas.js";
import { initEditorToolbar } from "./editor-toolbar.js";

export { boardData } from "./editor-state.js";
export { renderEditorBoard } from "./editor-canvas.js";

initCanvasEditor();
initEditorToolbar();
