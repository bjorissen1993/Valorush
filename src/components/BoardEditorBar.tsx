import {
  EDGE_COLOR_PRESETS,
  type ButtonActions,
  type ButtonLinkConfig,
  type TileType,
} from "../game/boardLayout";
import type { UltimateDefinition } from "../../shared/ultimates";

export type BoardEditorTool =
  | "select"
  | "move"
  | "add"
  | "link"
  | "unlink"
  | "assign-button"
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
  buttonControlledLinks: ButtonLinkConfig[];
  buttonIsOn: boolean | null;
  buttonStartsOn: boolean | null;
  buttonActions: ButtonActions;
  buttonSoftLockWarning: string | null;
  onClearButtonLinks: () => void;
  onRemoveButtonLink: (a: string, b: string) => void;
  onToggleButtonPreview: () => void;
  onButtonStartsOnChange: (startsOn: boolean) => void;
  onSetButtonLinkOpenWhenOn: (a: string, b: string, openWhenOn: boolean) => void;
  onSetButtonLinkFlipDirection: (
    a: string,
    b: string,
    flipDirection: boolean
  ) => void;
  onSetButtonActions: (actions: ButtonActions) => void;
  selectedEdge: { from: string; to: string } | null;
  selectedEdgeColor: string | null;
  onSelectedEdgeColorChange: (color: string | null) => void;
  onChangeSelectedType: (type: TileType) => void;
  onFlipDirections: () => void;
  onCycleDirections: () => void;
  onDeleteSelection: () => void;
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
    id: "assign-button",
    label: "Assign link",
    hint: "Select a button, then click edges/tiles to bind controlled links",
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
  buttonControlledLinks,
  buttonIsOn,
  buttonStartsOn,
  buttonActions,
  buttonSoftLockWarning,
  onClearButtonLinks,
  onRemoveButtonLink,
  onToggleButtonPreview,
  onButtonStartsOnChange,
  onSetButtonLinkOpenWhenOn,
  onSetButtonLinkFlipDirection,
  onSetButtonActions,
  selectedEdge,
  selectedEdgeColor,
  onSelectedEdgeColorChange,
  onChangeSelectedType,
  onFlipDirections,
  onCycleDirections,
  onDeleteSelection,
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
  const isButtonSelected =
    selectedNodeType === "button" && selectedNodeIds.length === 1;
  const selectionCount = selectedNodeIds.length;
  const multiSelected = selectionCount > 1;

  const status =
    tool === "assign-button"
      ? !primaryId || selectedNodeType !== "button"
        ? "Select a button tile, then pick paths it controls"
        : linkFromId
          ? `Button ${primaryId}: from ${linkFromId} — click target tile or edge`
          : buttonControlledLinks.length > 0
            ? `Button ${primaryId}: ${buttonControlledLinks.length} link(s) — click edge/tiles to add`
            : `Button ${primaryId}: click an edge or two tiles to assign`
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

      {multiSelected && (
        <div className="board-editor-bar__selection-menu">
          <p className="board-editor-bar__door-title">
            Selection ({selectionCount} tiles)
          </p>
          <div className="board-editor-bar__row">
            <label className="board-editor-bar__label">
              Change type
              <select
                value=""
                onChange={(e) => {
                  if (!e.target.value) return;
                  onChangeSelectedType(e.target.value as TileType);
                }}
                className="board-editor-bar__select"
              >
                <option value="" disabled>
                  Set type…
                </option>
                {TILE_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              className="board-editor-bar__btn"
              onClick={onFlipDirections}
              title="Reverse one-way links among the selection"
            >
              Flip directions
            </button>
            <button
              type="button"
              className="board-editor-bar__btn"
              onClick={onCycleDirections}
              title="Cycle one-way ↔ reverse ↔ two-way among selection"
            >
              Cycle directions
            </button>
            <button
              type="button"
              className="board-editor-bar__btn board-editor-bar__btn--danger"
              onClick={onDeleteSelection}
            >
              Delete selected
            </button>
          </div>
        </div>
      )}

      {!multiSelected && (
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
        </div>
      )}

      <div className="board-editor-bar__row">
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

      {isButtonSelected && primaryId && (
        <div className="board-editor-bar__door">
          <p className="board-editor-bar__door-title">Button / gate control</p>
          <p className="board-editor-bar__door-meta">
            {buttonControlledLinks.length > 0
              ? `Controls ${buttonControlledLinks.length} link(s) — ON/OFF toggles open/closed per mapping`
              : "No links assigned — use Assign link, then click an edge or two tiles."}
          </p>
          {buttonControlledLinks.length > 0 && (
            <ul className="board-editor-bar__link-list">
              {buttonControlledLinks.map((link) => {
                const openWhenOn = link.openWhenOn !== false;
                const flipDir = link.flipDirection === true;
                return (
                  <li key={`${link.a}|${link.b}`}>
                    <div className="board-editor-bar__link-row">
                      <span>
                        {link.a} ↔ {link.b}
                      </span>
                      <button
                        type="button"
                        className="board-editor-bar__btn"
                        onClick={() => onRemoveButtonLink(link.a, link.b)}
                      >
                        Remove
                      </button>
                    </div>
                    <div className="board-editor-bar__link-opts">
                      <label className="board-editor-bar__check">
                        <input
                          type="checkbox"
                          checked={openWhenOn}
                          onChange={(e) =>
                            onSetButtonLinkOpenWhenOn(
                              link.a,
                              link.b,
                              e.target.checked
                            )
                          }
                        />
                        Open when ON
                      </label>
                      <label className="board-editor-bar__check">
                        <input
                          type="checkbox"
                          checked={flipDir}
                          onChange={(e) =>
                            onSetButtonLinkFlipDirection(
                              link.a,
                              link.b,
                              e.target.checked
                            )
                          }
                        />
                        Flip direction
                      </label>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
          <div className="board-editor-bar__row">
            <span className="board-editor-bar__door-state">
              State: {buttonIsOn == null ? "—" : buttonIsOn ? "ON" : "OFF"}
            </span>
            <button
              type="button"
              className="board-editor-bar__btn"
              onClick={onToggleButtonPreview}
              disabled={buttonControlledLinks.length === 0}
            >
              Toggle preview
            </button>
            <button
              type="button"
              className="board-editor-bar__btn"
              onClick={onClearButtonLinks}
              disabled={buttonControlledLinks.length === 0}
            >
              Clear all links
            </button>
            <label className="board-editor-bar__check">
              <input
                type="checkbox"
                checked={buttonStartsOn !== false}
                onChange={(e) => onButtonStartsOnChange(e.target.checked)}
              />
              Starts ON
            </label>
          </div>
          <div className="board-editor-bar__row">
            <label className="board-editor-bar__check">
              <input
                type="checkbox"
                checked={
                  buttonActions.toggleLinks !== false &&
                  buttonControlledLinks.length > 0
                }
                disabled={buttonControlledLinks.length === 0}
                onChange={(e) =>
                  onSetButtonActions({
                    ...buttonActions,
                    toggleLinks: e.target.checked,
                  })
                }
              />
              Toggle links (doors)
            </label>
            <label className="board-editor-bar__check">
              <input
                type="checkbox"
                checked={buttonActions.flipDirections === true}
                onChange={(e) =>
                  onSetButtonActions({
                    ...buttonActions,
                    flipDirections: e.target.checked,
                  })
                }
              />
              Flip directions
            </label>
            <label className="board-editor-bar__check">
              <input
                type="checkbox"
                checked={buttonActions.toggleGate === true}
                onChange={(e) =>
                  onSetButtonActions({
                    ...buttonActions,
                    toggleGate: e.target.checked,
                  })
                }
              />
              Toggle Y-gate
            </label>
          </div>
          {buttonSoftLockWarning && (
            <p className="board-editor-bar__door-warn">{buttonSoftLockWarning}</p>
          )}
        </div>
      )}

      <p className="board-editor-bar__hint">
        <strong>Select</strong> tiles (Shift-click or marquee). Buttons open/close
        links or flip directions — set per-link <strong>Open when ON</strong> so one
        door opens while another closes. Arrows show walk direction on tiles and paths.
        Alt+drag to pan.
      </p>
    </div>
  );
}
