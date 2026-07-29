import {
  EDGE_COLOR_PRESETS,
  type ControlledEdge,
  type TileType,
} from "../game/boardLayout";
import type { UltimateDefinition } from "../../shared/ultimates";

export type BoardEditorTool =
  | "select"
  | "move"
  | "add"
  | "link"
  | "unlink"
  | "assign-door"
  | "color-link"
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
  selectedNodeIds: string[];
  selectedNodeType: TileType | null;
  linkFromId: string | null;
  bidirectionalLinks: boolean;
  onBidirectionalLinksChange: (value: boolean) => void;
  doorControlledEdges: ControlledEdge[];
  doorIsOpen: boolean | null;
  doorStartsOpen: boolean | null;
  doorSoftLockWarning: string | null;
  onClearDoorLinks: () => void;
  onRemoveDoorLink: (a: string, b: string) => void;
  onToggleDoorPreview: () => void;
  onDoorStartsOpenChange: (startsOpen: boolean) => void;
  selectedEdge: { from: string; to: string } | null;
  selectedEdgeColor: string | null;
  onSelectedEdgeColorChange: (color: string | null) => void;
  onChangeSelectedType: (type: TileType) => void;
  onFlipDirections: () => void;
  onCycleDirections: () => void;
  ultimatePreviewOptions: UltimateDefinition[];
  ultimatePreviewId: string | null;
  onUltimatePreviewIdChange: (id: string | null) => void;
  ultimatePreviewCount: number;
  onExportJson: () => void;
  onExportTs: () => void;
  onResetDefault: () => void;
  onClose: () => void;
};

const TOOLS: { id: BoardEditorTool; label: string; hint: string }[] = [
  {
    id: "select",
    label: "Select",
    hint: "Click tiles to toggle selection; drag a box to marquee-select",
  },
  {
    id: "move",
    label: "Move",
    hint: "Drag a tile (or the selection) to reposition",
  },
  { id: "add", label: "Add", hint: "Click empty board space to place a tile" },
  { id: "link", label: "Link", hint: "Click two tiles to connect a path" },
  {
    id: "unlink",
    label: "Unlink",
    hint: "Click a path or two tiles to remove the edge",
  },
  {
    id: "assign-door",
    label: "Assign link",
    hint: "Select a door, then click edges/tiles to add controlled links",
  },
  {
    id: "color-link",
    label: "Color link",
    hint: "Click a path to select it, then pick a color",
  },
  { id: "delete", label: "Delete", hint: "Click a tile to remove it" },
];

export default function BoardEditorBar({
  tool,
  onToolChange,
  addTileType,
  onAddTileTypeChange,
  selectedNodeIds,
  selectedNodeType,
  linkFromId,
  bidirectionalLinks,
  onBidirectionalLinksChange,
  doorControlledEdges,
  doorIsOpen,
  doorStartsOpen,
  doorSoftLockWarning,
  onClearDoorLinks,
  onRemoveDoorLink,
  onToggleDoorPreview,
  onDoorStartsOpenChange,
  selectedEdge,
  selectedEdgeColor,
  onSelectedEdgeColorChange,
  onChangeSelectedType,
  onFlipDirections,
  onCycleDirections,
  ultimatePreviewOptions,
  ultimatePreviewId,
  onUltimatePreviewIdChange,
  ultimatePreviewCount,
  onExportJson,
  onExportTs,
  onResetDefault,
  onClose,
}: Props) {
  const primaryId = selectedNodeIds[selectedNodeIds.length - 1] ?? null;
  const isDoorSelected = selectedNodeType === "door" && selectedNodeIds.length === 1;
  const selectionCount = selectedNodeIds.length;

  const status =
    tool === "assign-door"
      ? !primaryId || selectedNodeType !== "door"
        ? "Select a door tile, then pick paths it controls"
        : linkFromId
          ? `Door ${primaryId}: from ${linkFromId} — click target tile or edge`
          : doorControlledEdges.length > 0
            ? `Door ${primaryId}: ${doorControlledEdges.length} link(s) — click edge/tiles to add`
            : `Door ${primaryId}: click an edge or two tiles to assign`
      : tool === "link" || tool === "unlink"
        ? linkFromId
          ? `From: ${linkFromId} — click target tile`
          : "Click first tile"
        : tool === "color-link"
          ? selectedEdge
            ? `Link ${selectedEdge.from} ↔ ${selectedEdge.to} — pick a color`
            : "Click a path to color it"
          : tool === "select"
            ? selectionCount > 0
              ? `Selected ${selectionCount} tile(s)`
              : "Click tiles or drag a box to select"
            : selectionCount > 1
              ? `Selected ${selectionCount} tiles`
              : primaryId
                ? `Selected: ${primaryId}${
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
        <label className="board-editor-bar__label">
          Change type
          <select
            value={selectedNodeType ?? ""}
            onChange={(e) => {
              if (!e.target.value) return;
              onChangeSelectedType(e.target.value as TileType);
            }}
            className="board-editor-bar__select"
            disabled={selectionCount === 0}
          >
            <option value="" disabled>
              {selectionCount === 0 ? "Select tiles…" : "Set type…"}
            </option>
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
        <button
          type="button"
          className="board-editor-bar__btn"
          onClick={onFlipDirections}
          disabled={selectionCount < 2 && !selectedEdge}
          title="Reverse one-way links among the selection"
        >
          Flip directions
        </button>
        <button
          type="button"
          className="board-editor-bar__btn"
          onClick={onCycleDirections}
          disabled={selectionCount < 2 && !selectedEdge}
          title="Cycle one-way ↔ reverse ↔ two-way among selection"
        >
          Cycle directions
        </button>
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

      {(tool === "color-link" || selectedEdge) && (
        <div className="board-editor-bar__door">
          <p className="board-editor-bar__door-title">Link color</p>
          <p className="board-editor-bar__door-meta">
            {selectedEdge
              ? `${selectedEdge.from} ↔ ${selectedEdge.to}`
              : "No link selected"}
          </p>
          <div className="board-editor-bar__row">
            {EDGE_COLOR_PRESETS.map((color) => (
              <button
                key={color}
                type="button"
                className={`board-editor-bar__swatch ${
                  selectedEdgeColor === color
                    ? "board-editor-bar__swatch--active"
                    : ""
                }`}
                style={{ background: color }}
                disabled={!selectedEdge}
                title={color}
                onClick={() => onSelectedEdgeColorChange(color)}
              />
            ))}
            <label className="board-editor-bar__label">
              Custom
              <input
                type="color"
                className="board-editor-bar__color"
                disabled={!selectedEdge}
                value={selectedEdgeColor ?? "#22d3ee"}
                onChange={(e) => onSelectedEdgeColorChange(e.target.value)}
              />
            </label>
            <button
              type="button"
              className="board-editor-bar__btn"
              disabled={!selectedEdge || !selectedEdgeColor}
              onClick={() => onSelectedEdgeColorChange(null)}
            >
              Clear color
            </button>
          </div>
        </div>
      )}

      <div className="board-editor-bar__door">
        <p className="board-editor-bar__door-title">Ultimate range preview</p>
        <div className="board-editor-bar__row">
          <label className="board-editor-bar__label">
            Ultimate
            <select
              value={ultimatePreviewId ?? ""}
              onChange={(e) =>
                onUltimatePreviewIdChange(e.target.value || null)
              }
              className="board-editor-bar__select"
            >
              <option value="">Off</option>
              {ultimatePreviewOptions.map((ult) => (
                <option key={ult.id} value={ult.id}>
                  {ult.agentName} — {ult.name}
                </option>
              ))}
            </select>
          </label>
          {ultimatePreviewId && (
            <span className="board-editor-bar__badge" title="Tiles in range">
              {ultimatePreviewCount} tiles
            </span>
          )}
        </div>
        <p className="board-editor-bar__door-meta">
          Select an origin tile to highlight range. Editor-only — does not cast.
        </p>
      </div>

      {isDoorSelected && primaryId && (
        <div className="board-editor-bar__door">
          <p className="board-editor-bar__door-title">Door / gate control</p>
          <p className="board-editor-bar__door-meta">
            {doorControlledEdges.length > 0
              ? `Controls ${doorControlledEdges.length} link(s)`
              : "No links assigned — use Assign link, then click an edge or two tiles."}
          </p>
          {doorControlledEdges.length > 0 && (
            <ul className="board-editor-bar__link-list">
              {doorControlledEdges.map((edge) => (
                <li key={`${edge.a}|${edge.b}`}>
                  <span>
                    {edge.a} ↔ {edge.b}
                  </span>
                  <button
                    type="button"
                    className="board-editor-bar__btn"
                    onClick={() => onRemoveDoorLink(edge.a, edge.b)}
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div className="board-editor-bar__row">
            <span className="board-editor-bar__door-state">
              Preview:{" "}
              {doorIsOpen == null ? "—" : doorIsOpen ? "Open" : "Closed"}
            </span>
            <button
              type="button"
              className="board-editor-bar__btn"
              onClick={onToggleDoorPreview}
              disabled={doorControlledEdges.length === 0}
            >
              Toggle preview
            </button>
            <button
              type="button"
              className="board-editor-bar__btn"
              onClick={onClearDoorLinks}
              disabled={doorControlledEdges.length === 0}
            >
              Clear all links
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
        <strong>Select</strong> tiles (Shift-click or marquee), change type, flip
        walk directions, or <strong>Move</strong> the group. Add type{" "}
        <strong>door</strong>, then <strong>Assign link</strong> to bind one or
        more paths — landing toggles all bound links together. Color links and
        preview ultimate ranges without casting. Saves to localStorage; export
        JSON/TS for snippets. Alt+drag empty space to pan.
      </p>
    </div>
  );
}
