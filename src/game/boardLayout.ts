export type TileType =
    | "start"
    | "empty"
    | "spike"
    | "shop"
    | "event"
    | "minigame"
    | "split"
    | "merge";

export type BoardNode = {
    id: string;
    type: TileType;
    x: number;
    y: number;
    next: string[];
};

export const boardLayout: BoardNode[] = [
    // TOP ROW
    { id: "start", type: "start", x: 10, y: 15, next: ["top-1"] },
    { id: "top-1", type: "event", x: 25, y: 15, next: ["top-2"] },
    { id: "top-2", type: "spike", x: 40, y: 15, next: ["top-split"] },
    { id: "top-split", type: "split", x: 55, y: 15, next: ["top-outer-1", "top-inner-1"]},
    { id: "top-outer-1", type: "minigame", x: 70, y: 15, next: ["right-1"] },

    // RIGHT SIDE OUTER
    { id: "right-1", type: "event", x: 85, y: 15, next: ["right-2"] },
    { id: "right-2", type: "shop", x: 85, y: 32, next: ["right-merge"] },
    { id: "right-merge", type: "merge", x: 85, y: 49, next: ["right-3"] },
    { id: "right-3", type: "spike", x: 85, y: 66, next: ["bottom-1"] },

    // BOTTOM ROW
    { id: "bottom-1", type: "event", x: 85, y: 83, next: ["bottom-2"] },
    { id: "bottom-2", type: "shop", x: 70, y: 83, next: ["bottom-3"] },
    { id: "bottom-3", type: "event", x: 55, y: 83, next: ["bottom-split"] },
    { id: "bottom-split", type: "split", x: 40, y: 83, next: ["bottom-outer-1", "bottom-inner-1"] },
    { id: "bottom-outer-1", type: "event", x: 25, y: 83, next: ["left-3"] },

    // LEFT SIDE OUTER
    { id: "left-3", type: "minigame", x: 10, y: 83, next: ["left-2"] },
    { id: "left-2", type: "event", x: 10, y: 66, next: ["left-merge"] },
    { id: "left-merge", type: "merge", x: 10, y: 49, next: ["left-1"] },
    { id: "left-1", type: "event", x: 10, y: 32, next: ["start"] },

    // TOP INNER SHORTCUT
    { id: "top-inner-1", type: "event", x: 55, y: 32, next: ["top-inner-2"] },
    { id: "top-inner-2", type: "event", x: 70, y: 49, next: ["right-merge"] },

    // BOTTOM INNER SHORTCUT
    { id: "bottom-inner-1", type: "spike", x: 40, y: 66, next: ["bottom-inner-2"] },
    { id: "bottom-inner-2", type: "event", x: 25, y: 49, next: ["left-merge"] },
];

export function getNodeById(nodeId: string): BoardNode | undefined {
    return boardLayout.find((node) => node.id === nodeId);
}

export function movePlayerBySteps(
    startNodeId: string,
    steps: number,
    preferredPath?: string[]
): string {
    let currentId = startNodeId;

    for (let i = 0; i < steps; i++) {
        const currentNode = getNodeById(currentId);
        if (!currentNode || currentNode.next.length === 0) break;

        if (currentNode.next.length === 1) {
            currentId = currentNode.next[0];
            continue;
        }

        const preferredNext = preferredPath?.find((id) =>
            currentNode.next.includes(id)
        );

        currentId = preferredNext ?? currentNode.next[0];
    }

    return currentId;
}