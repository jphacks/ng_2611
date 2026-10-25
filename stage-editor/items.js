export const ITEM_PALETTE = [
    {
        type: "pastePotion",
        name: "ペーストポーション",
        color: "#4aa8ff",
        icon: '<path d="M24 8h16v10l10 22a10 10 0 0 1-9 14H23a10 10 0 0 1-9-14l10-22V8Z" fill="currentColor" stroke="#ffffff" stroke-width="2"/><path d="M22 35h20v15H22z" fill="none" stroke="#ffffff" stroke-width="2.5"/><path d="M27 31h10" stroke="#ffffff" stroke-width="2.5"/>',
    },
    {
        type: "selectAllPotion",
        name: "全選択ポーション",
        color: "#a855f7",
        icon: '<path d="M24 8h16v10l10 22a10 10 0 0 1-9 14H23a10 10 0 0 1-9-14l10-22V8Z" fill="currentColor" stroke="#ffffff" stroke-width="2"/><path d="M22 33h20v17H22z" fill="none" stroke="#ffffff" stroke-width="2" stroke-dasharray="4 3"/>',
    },
];

export function getItemDefinition(type) {
    return ITEM_PALETTE.find((item) => item.type === type) ?? ITEM_PALETTE[0];
}

export function getItemName(type) {
    return getItemDefinition(type)?.name ?? "アイテム";
}
