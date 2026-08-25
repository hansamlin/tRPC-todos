import type { Todo } from "@todos/shared";
import { Trash2Icon } from "lucide-react";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface TodoItemProps {
  todo: Todo;
  onToggle: (completed: boolean) => void;
  onRename: (title: string) => void;
  onRequestDelete: () => void;
}

/** 單筆待辦：點標題可就地編輯，Enter / blur 儲存，Esc 取消 */
export function TodoItem({ todo, onToggle, onRename, onRequestDelete }: TodoItemProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(todo.title);
  // 用來避免「Enter 儲存 / Esc 取消」之後 blur 再觸發一次儲存
  const skipBlur = useRef(false);

  const startEditing = () => {
    setDraft(todo.title);
    // 上一輪的 Enter / Esc 會把 skipBlur 設為 true 後直接卸載 input，
    // onBlur 沒有機會把它清掉，所以每次進入編輯都要重置，否則這一輪的 blur 儲存會被吞掉。
    skipBlur.current = false;
    setEditing(true);
  };

  const commit = () => {
    skipBlur.current = true;
    setEditing(false);
    const nextTitle = draft.trim();
    if (nextTitle === "" || nextTitle === todo.title) return;
    onRename(nextTitle);
  };

  const cancel = () => {
    skipBlur.current = true;
    setDraft(todo.title);
    setEditing(false);
  };

  return (
    <li className="flex items-center gap-3 rounded-lg border bg-card px-3 py-2.5 text-card-foreground transition-colors hover:bg-accent/40">
      <Checkbox
        checked={todo.completed}
        aria-label={todo.completed ? "標記為未完成" : "標記為已完成"}
        onCheckedChange={(checked) => {
          onToggle(checked === true);
        }}
      />

      {editing ? (
        <Input
          autoFocus
          value={draft}
          maxLength={200}
          className="h-8"
          aria-label="編輯待辦內容"
          onChange={(event) => {
            setDraft(event.target.value);
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              commit();
            } else if (event.key === "Escape") {
              event.preventDefault();
              cancel();
            }
          }}
          onBlur={() => {
            if (skipBlur.current) {
              skipBlur.current = false;
              return;
            }
            commit();
          }}
        />
      ) : (
        <button
          type="button"
          className={cn(
            "min-w-0 flex-1 cursor-text truncate rounded px-1 py-1 text-left text-sm outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
            todo.completed && "text-muted-foreground line-through",
          )}
          title="點擊以編輯"
          onClick={startEditing}
        >
          {todo.title}
        </button>
      )}

      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label={`刪除「${todo.title}」`}
        className="text-muted-foreground hover:text-destructive"
        onClick={onRequestDelete}
      >
        <Trash2Icon />
      </Button>
    </li>
  );
}
