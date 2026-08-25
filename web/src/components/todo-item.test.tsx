import type { Todo } from "@todos/shared";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vite-plus/test";
import { TodoItem } from "@/components/todo-item";

const EDIT_INPUT_LABEL = "編輯待辦內容";
const ORIGINAL_TITLE = "原始標題";

function makeTodo(overrides: Partial<Todo> = {}): Todo {
  return {
    id: "todo-1",
    title: ORIGINAL_TITLE,
    completed: false,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function renderTodoItem(todo: Todo = makeTodo()) {
  const onRename = vi.fn();
  const onToggle = vi.fn();
  const onRequestDelete = vi.fn();

  render(
    <TodoItem
      todo={todo}
      onToggle={onToggle}
      onRename={onRename}
      onRequestDelete={onRequestDelete}
    />,
  );

  return { onRename, onToggle, onRequestDelete, todo };
}

/** 未編輯時顯示標題的那顆按鈕（點它會進入編輯） */
const getTitleButton = () => screen.getByRole("button", { name: ORIGINAL_TITLE });
const getEditInput = () => screen.getByLabelText(EDIT_INPUT_LABEL);
const queryEditInput = () => screen.queryByLabelText(EDIT_INPUT_LABEL);

describe("TodoItem 行內編輯", () => {
  it("點擊標題會進入編輯狀態", async () => {
    const user = userEvent.setup();
    renderTodoItem();

    expect(queryEditInput()).not.toBeInTheDocument();

    await user.click(getTitleButton());

    expect(getEditInput()).toBeInTheDocument();
    expect(getEditInput()).toHaveValue(ORIGINAL_TITLE);
  });

  it("Enter 會用新標題呼叫 onRename 並離開編輯狀態", async () => {
    const user = userEvent.setup();
    const { onRename } = renderTodoItem();

    await user.click(getTitleButton());
    await user.clear(getEditInput());
    await user.type(getEditInput(), "改過的標題{Enter}");

    expect(onRename).toHaveBeenCalledTimes(1);
    expect(onRename).toHaveBeenCalledWith("改過的標題");
    expect(queryEditInput()).not.toBeInTheDocument();
  });

  it("Esc 不會呼叫 onRename，且草稿還原成原標題", async () => {
    const user = userEvent.setup();
    const { onRename } = renderTodoItem();

    await user.click(getTitleButton());
    await user.clear(getEditInput());
    await user.type(getEditInput(), "不該被儲存{Escape}");

    expect(onRename).not.toHaveBeenCalled();
    expect(queryEditInput()).not.toBeInTheDocument();
    expect(getTitleButton()).toBeInTheDocument();

    // 再次進入編輯時，input 應該顯示原標題（草稿已被 cancel() 還原）
    await user.click(getTitleButton());
    expect(getEditInput()).toHaveValue(ORIGINAL_TITLE);
  });

  it("blur 會儲存", async () => {
    const user = userEvent.setup();
    const { onRename } = renderTodoItem();

    await user.click(getTitleButton());
    await user.clear(getEditInput());
    await user.type(getEditInput(), "用 blur 存的標題");
    await user.tab();

    expect(onRename).toHaveBeenCalledTimes(1);
    expect(onRename).toHaveBeenCalledWith("用 blur 存的標題");
    expect(queryEditInput()).not.toBeInTheDocument();
  });

  // ── 回歸測試：skipBlur 旗標必須在每次進入編輯時重置 ──────────────────
  // 舊 bug：commit()/cancel() 設 skipBlur=true 後直接卸載 input，onBlur 沒機會清旗標，
  // 導致「下一輪」的 blur 儲存被吞掉（不呼叫 onRename，且停在編輯狀態）。

  it("回歸：Enter 儲存後再次進入編輯，blur 仍然會儲存", async () => {
    const user = userEvent.setup();
    const { onRename } = renderTodoItem();

    // 第一輪：Enter 儲存
    await user.click(getTitleButton());
    await user.clear(getEditInput());
    await user.type(getEditInput(), "第一次改名{Enter}");
    expect(onRename).toHaveBeenNthCalledWith(1, "第一次改名");
    expect(queryEditInput()).not.toBeInTheDocument();

    // 第二輪：改用 blur 儲存
    await user.click(getTitleButton());
    await user.clear(getEditInput());
    await user.type(getEditInput(), "第二次改名");
    await user.tab();

    expect(onRename).toHaveBeenCalledTimes(2);
    expect(onRename).toHaveBeenNthCalledWith(2, "第二次改名");
    expect(queryEditInput()).not.toBeInTheDocument();
  });

  it("回歸：Esc 取消後再次進入編輯，blur 仍然會儲存", async () => {
    const user = userEvent.setup();
    const { onRename } = renderTodoItem();

    // 第一輪：Esc 取消
    await user.click(getTitleButton());
    await user.clear(getEditInput());
    await user.type(getEditInput(), "取消掉的標題{Escape}");
    expect(onRename).not.toHaveBeenCalled();
    expect(queryEditInput()).not.toBeInTheDocument();

    // 第二輪：改用 blur 儲存
    await user.click(getTitleButton());
    await user.clear(getEditInput());
    await user.type(getEditInput(), "取消後才存的標題");
    await user.tab();

    expect(onRename).toHaveBeenCalledTimes(1);
    expect(onRename).toHaveBeenCalledWith("取消後才存的標題");
    expect(queryEditInput()).not.toBeInTheDocument();
  });

  // ── 既有行為：commit() 會先離開編輯狀態，再判斷要不要呼叫 onRename ──
  it("標題沒有變更時不呼叫 onRename，但仍離開編輯狀態", async () => {
    const user = userEvent.setup();
    const { onRename } = renderTodoItem();

    await user.click(getTitleButton());
    await user.type(getEditInput(), "{Enter}");

    expect(onRename).not.toHaveBeenCalled();
    expect(queryEditInput()).not.toBeInTheDocument();
  });

  it("標題為空白時不呼叫 onRename，但仍離開編輯狀態", async () => {
    const user = userEvent.setup();
    const { onRename } = renderTodoItem();

    await user.click(getTitleButton());
    await user.clear(getEditInput());
    await user.type(getEditInput(), "   ");
    await user.tab();

    expect(onRename).not.toHaveBeenCalled();
    expect(queryEditInput()).not.toBeInTheDocument();
  });
});
