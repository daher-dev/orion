import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { KanbanBoard } from "@/components/inventory/KanbanBoard";

type Item = { id: string; col: string; label: string };

const items: Item[] = [
  { id: "a", col: "todo", label: "Card A" },
  { id: "b", col: "done", label: "Card B" },
];

function renderBoard(onMove = vi.fn()) {
  render(
    <KanbanBoard<Item>
      testidPrefix="kb"
      columns={[
        { id: "todo", label: <span>To do</span> },
        { id: "done", label: <span>Done</span> },
      ]}
      items={items}
      getColumnId={(i) => i.col}
      getItemId={(i) => i.id}
      onMove={onMove}
      renderCard={(i) => <div>{i.label}</div>}
    />,
  );
  return onMove;
}

describe("KanbanBoard", () => {
  it("renders cards in the column matching getColumnId", () => {
    renderBoard();
    const todoCol = screen.getByTestId("kb-col-todo");
    const doneCol = screen.getByTestId("kb-col-done");
    expect(todoCol.textContent).toContain("Card A");
    expect(doneCol.textContent).toContain("Card B");
    expect(screen.getAllByTestId("kb-card")).toHaveLength(2);
  });

  it("fires onMove with the dragged item + target column on drop", () => {
    const onMove = renderBoard();
    const cards = screen.getAllByTestId("kb-card");
    // Drag card A (todo) onto the Done column.
    fireEvent.dragStart(cards[0]);
    const doneCol = screen.getByTestId("kb-col-done");
    fireEvent.dragOver(doneCol);
    fireEvent.drop(doneCol);

    expect(onMove).toHaveBeenCalledTimes(1);
    const [movedItem, targetCol] = onMove.mock.calls[0];
    expect(movedItem.id).toBe("a");
    expect(targetCol).toBe("done");
  });

  it("does not fire onMove when dropped on the same column", () => {
    const onMove = renderBoard();
    const cards = screen.getAllByTestId("kb-card");
    fireEvent.dragStart(cards[0]);
    const todoCol = screen.getByTestId("kb-col-todo");
    fireEvent.drop(todoCol);
    expect(onMove).not.toHaveBeenCalled();
  });

  it("omits drag affordance when canMove is false", () => {
    render(
      <KanbanBoard<Item>
        testidPrefix="kb-ro"
        columns={[{ id: "todo", label: <span>To do</span> }]}
        items={[items[0]]}
        getColumnId={(i) => i.col}
        getItemId={(i) => i.id}
        onMove={vi.fn()}
        renderCard={(i) => <div>{i.label}</div>}
        canMove={false}
      />,
    );
    const card = screen.getByTestId("kb-ro-card");
    expect(card.getAttribute("draggable")).toBe("false");
  });
});
