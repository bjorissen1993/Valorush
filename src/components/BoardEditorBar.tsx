import type { ControlledEdge, TileType } from "../game/boardLayout";

export type BoardEditorTool =
  | "select"
  | "add"
  | "link"
  | "unlink"
  | "assign-door"
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
  "door",
  "start",
  "empty",
];

type Props = {
  tool: BoardEditorTool;
  onToolChange: (tool: BoardEditorTool) => void;
  addTileType: TileType;
  onAddTileTypeChange: (type: TileType) => void;
  selectedNodeId: string | null;
  selectedNodeType: TileType | null;
  linkFromId: string | null;
  bidirectionalLinks: boolean;
  onBidirectionalLinksChange: (value: boolean) => void;
  doorControlledEdge: ControlledEdge | null;
  doorIsOpen: boolean | null;
  doorStartsOpen: boolean | null;
  doorSoftLockWarning: string | null;
  onClearDoorLink: () => void;
  onToggleDoorPreview: () => void;
  onDoorStartsOpenChange: (startsOpen: boolean) => void;
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
  {
    id: "assign-door",
    label: "Assign link",
    hint: "Select a door, then click an edge or two tiles it should open/close",
  },
  { id: "delete", label: "Delete", hint: "Click a tile to remove it" },
];

export default function BoardEditorBar({
  tool,
  onToolChange,
  addTileType,
  onAddTileTypeChange,
  selectedNodeId,
  selectedNodeType,
  linkFromId,
  bidirectionalLinks,
  onBidirectionalLinksChange,
  doorControlledEdge,
  doorIsOpen,
  doorStartsOpen,
  doorSoftLockWarning,
  onClearDoorLink,
  onToggleDoorPreview,
  onDoorStartsOpenChange,
  onExportJson,
  onExportTs,
  onResetDefault,
  onClose,
}: Props) {
  const isDoorSelected = selectedNodeType === "door";

  const status =
    tool === "assign-door"
      ? !selectedNodeId || selectedNodeType !== "door"
        ? "Select a door tile, then pick the path it controls"
        : linkFromId
          ? `Door ${selectedNodeId}: from ${linkFromId} — click target tile or edge`
          : doorControlledEdge
            ? `Door ${selectedNodeId} → ${doorControlledEdge.a} ↔ ${doorControlledEdge.b} — click edge/tiles to reassign`
            : `Door ${selectedNodeId}: click an edge or two tiles to assign`
      : tool === "link" || tool === "unlink"
        ? linkFromId
          ? `From: ${linkFromId} — click target tile`
          : "Click first tile"
        : selectedNodeId
          ? `Selected: ${selectedNodeId}${
              selectedNodeType ? ` (${selectedNodeType})` : ""
            }`
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
                {type === "door" ? "door (gate switch)" : type}
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

      {isDoorSelected && selectedNodeId && (
        <div className="board-editor-bar__door">
          <p className="board-editor-bar__door-title">Door / gate control</p>
          <p className="board-editor-bar__door-meta">
            {doorControlledEdge
              ? `Controls link: ${doorControlledEdge.a} ↔ ${doorControlledEdge.b}`
              : "No link assigned — use Assign link, then click an edge or two tiles."}
          </p>
          <div className="board-editor-bar__row">
            <span className="board-editor-bar__door-state">
              Preview:{" "}
              {doorIsOpen == null ? "—" : doorIsOpen ? "Open" : "Closed"}
            </span>
            <button
              type="button"
              className="board-editor-bar__btn"
              onClick={onToggleDoorPreview}
              disabled={!doorControlledEdge}
            >
              Toggle preview
            </button>
            <button
              type="button"
              className="board-editor-bar__btn"
              onClick={onClearDoorLink}
              disabled={!doorControlledEdge}
            >
              Clear link
            </button>
            <label className="board-editor-bar__check">
              <input
                type="checkbox"
                checked={doorStartsOpen !== false}
                onChange={(e) => onDoorStartsOpenChange(e.target.checked)}
              />
              Starts open
            </label>
          </div>
          {doorSoftLockWarning && (
            <p className="board-editor-bar__door-warn">{doorSoftLockWarning}</p>
          )}
        </div>
      )}

      <p className="board-editor-bar__hint">
        Add type <strong>door</strong>, place it, then <strong>Assign link</strong> to bind a
        path. Landing on the door toggles that link open/closed. Keep an alternate route so
        players are not soft-locked. Saves to localStorage; export JSON/TS for snippets.
        Full-board camera; Alt+drag empty space to pan.
      </p>
    </div>
  );
}
