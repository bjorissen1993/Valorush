import type { TileType } from "../game/boardLayout";

export type BoardEditorTool =
  | "select"
  | "add"
  | "link"
  | "unlink"
  | "delete";

const TILE_TYPES: TileType[] = [
  "normal",
  "event",
  "shop",
  "spike",
  "minigame",
  "lucky",
  "risk",
  "ult-orb",
  "special",
  "portal",
  "button",
  "start",
  "empty",
];

type Props = {
  tool: BoardEditorTool;
  onToolChange: (tool: BoardEditorTool) => void;
  addTileType: TileType;
  onAddTileTypeChange: (type: TileType) => void;
  selectedNodeId: string | null;
  linkFromId: string | null;
  bidirectionalLinks: boolean;
  onBidirectionalLinksChange: (value: boolean) => void;
  onExportJson: () => void;
  onExportTs: () => void;
  onResetDefault: () => void;
  onClose: () => void;
};

const TOOLS: { id: BoardEditorTool; label: string; hint: string }[] = [
  { id: "select", label: "Move", hint: "Select a tile, then drag to reposition" },
  { id: "add", label: "Add", hint: "Click empty board space to place a tile" },
  { id: "link", label: "Link", hint: "Click two tiles to connect a path" },
  { id: "unlink", label: "Unlink", hint: "Click a path or two tiles to remove the edge" },
  { id: "delete", label: "Delete", hint: "Click a tile to remove it" },
];

export default function BoardEditorBar({
  tool,
  onToolChange,
  addTileType,
  onAddTileTypeChange,
  selectedNodeId,
  linkFromId,
  bidirectionalLinks,
  onBidirectionalLinksChange,
  onExportJson,
  onExportTs,
  onResetDefault,
  onClose,
}: Props) {
  const status =
    tool === "link" || tool === "unlink"
      ? linkFromId
        ? `From: ${linkFromId} — click target tile`
        : "Click first tile"
      : selectedNodeId
        ? `Selected: ${selectedNodeId}`
        : "No tile selected";

  return (
    <div className="board-editor-bar" role="toolbar" aria-label="Board editor">
      <div className="board-editor-bar__row">
        <p className="board-editor-bar__title">Board editor</p>
        <p className="board-editor-bar__status">{status}</p>
        <button
          type="button"
          className="board-editor-bar__btn board-editor-bar__btn--ghost"
          onClick={onClose}
        >
          Exit editor
        </button>
      </div>

      <div className="board-editor-bar__row">
        {TOOLS.map((t) => (
          <button
            key={t.id}
            type="button"
            title={t.hint}
            className={`board-editor-bar__btn ${
              tool === t.id ? "board-editor-bar__btn--active" : ""
            }`}
            onClick={() => onToolChange(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="board-editor-bar__row">
        <label className="board-editor-bar__label">
          Add type
          <select
            value={addTileType}
            onChange={(e) => onAddTileTypeChange(e.target.value as TileType)}
            className="board-editor-bar__select"
            disabled={tool !== "add"}
          >
            {TILE_TYPES.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </label>
        <label className="board-editor-bar__check">
          <input
            type="checkbox"
            checked={bidirectionalLinks}
            onChange={(e) => onBidirectionalLinksChange(e.target.checked)}
          />
          Two-way links
        </label>
        <button type="button" className="board-editor-bar__btn" onClick={onExportJson}>
          Export JSON
        </button>
        <button type="button" className="board-editor-bar__btn" onClick={onExportTs}>
          Export TS
        </button>
        <button
          type="button"
          className="board-editor-bar__btn board-editor-bar__btn--danger"
          onClick={onResetDefault}
        >
          Reset default
        </button>
      </div>

      <p className="board-editor-bar__hint">
        Saves to localStorage. Export JSON/TS for a layout snippet. Full-board camera; Alt+drag
        empty space to pan; minimap still jumps.
      </p>
    </div>
  );
}
