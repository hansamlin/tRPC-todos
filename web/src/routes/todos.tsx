import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { todoTitleSchema, type Todo } from "@todos/shared";
import { LoaderCircleIcon, LogOutIcon, PlusIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { DeleteTodoDialog } from "@/components/delete-todo-dialog";
import { ThemeToggle } from "@/components/theme-toggle";
import { TodoItem } from "@/components/todo-item";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toErrorMessage, trpc } from "@/lib/trpc";
import { useAuthStore } from "@/stores/auth";

type LoadStatus = "loading" | "ready" | "error";

export const Route = createFileRoute("/todos")({
  beforeLoad: () => {
    // 未登入不得進入清單
    if (!useAuthStore.getState().isAuthenticated) {
      throw redirect({ to: "/login" });
    }
  },
  component: TodosPage,
});

function TodosPage() {
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const setUser = useAuthStore((state) => state.setUser);
  const logout = useAuthStore((state) => state.logout);

  const [todos, setTodos] = useState<Todo[]>([]);
  const [status, setStatus] = useState<LoadStatus>("loading");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  const [newTitle, setNewTitle] = useState("");
  const [creating, setCreating] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Todo | null>(null);
  const [deleting, setDeleting] = useState(false);

  // 載入清單
  useEffect(() => {
    let active = true;
    setStatus("loading");
    setLoadError(null);

    trpc.todo.list.query().then(
      (list) => {
        if (!active) return;
        setTodos(list);
        setStatus("ready");
      },
      (error: unknown) => {
        if (!active) return;
        setLoadError(toErrorMessage(error, "載入待辦清單失敗"));
        setStatus("error");
      },
    );

    return () => {
      active = false;
    };
  }, [reloadToken]);

  // 補齊使用者資訊（重新整理後 store 只剩 cookie 判定的登入狀態）
  useEffect(() => {
    let active = true;
    trpc.auth.me.query().then(
      (me) => {
        if (active) setUser(me);
      },
      () => {
        // 這裡失敗不影響清單本身，authLink 會處理換發 / 導回登入
      },
    );
    return () => {
      active = false;
    };
  }, [setUser]);

  const trimmedTitle = newTitle.trim();
  const canCreate = todoTitleSchema.safeParse(newTitle).success && !creating;

  const handleCreate = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canCreate) return;
    setCreating(true);
    try {
      const created = await trpc.todo.create.mutate({ title: trimmedTitle });
      setTodos((current) => [created, ...current]);
      setNewTitle("");
    } catch (error) {
      toast.error(toErrorMessage(error, "新增待辦失敗"));
    }
    setCreating(false);
  };

  const handleUpdate = async (id: string, patch: { title?: string; completed?: boolean }) => {
    setBusyId(id);
    try {
      const updated = await trpc.todo.update.mutate({ id, ...patch });
      setTodos((current) => current.map((todo) => (todo.id === id ? updated : todo)));
    } catch (error) {
      toast.error(toErrorMessage(error, "更新待辦失敗"));
    }
    setBusyId(null);
  };

  const handleDelete = async () => {
    if (pendingDelete === null) return;
    const { id } = pendingDelete;
    setDeleting(true);
    try {
      await trpc.todo.delete.mutate({ id });
      setTodos((current) => current.filter((todo) => todo.id !== id));
      setPendingDelete(null);
      toast.success("已刪除待辦");
    } catch (error) {
      toast.error(toErrorMessage(error, "刪除待辦失敗"));
    }
    setDeleting(false);
  };

  const handleLogout = async () => {
    // 清掉 access + refresh cookie 並重設 store
    logout();
    await navigate({ to: "/login" });
  };

  const remaining = todos.filter((todo) => !todo.completed).length;

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-2xl flex-col px-4 py-8 sm:py-12">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight">我的待辦</h1>
          <p className="truncate text-sm text-muted-foreground">
            {user === null ? "　" : user.email}
          </p>
        </div>
        <div className="flex items-center gap-1">
          <ThemeToggle />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              void handleLogout();
            }}
          >
            <LogOutIcon />
            登出
          </Button>
        </div>
      </header>

      <form className="mb-6 flex gap-2" onSubmit={(event) => void handleCreate(event)}>
        <Input
          value={newTitle}
          maxLength={200}
          placeholder="想做什麼？"
          aria-label="新增待辦內容"
          onChange={(event) => {
            setNewTitle(event.target.value);
          }}
        />
        <Button type="submit" disabled={!canCreate}>
          <PlusIcon />
          新增
        </Button>
      </form>

      <main>
        {status === "loading" && (
          <div className="flex items-center justify-center gap-2 rounded-lg border border-dashed py-14 text-sm text-muted-foreground">
            <LoaderCircleIcon className="size-4 animate-spin" />
            載入中…
          </div>
        )}

        {status === "error" && (
          <div className="flex flex-col items-center gap-3 rounded-lg border border-destructive/40 bg-destructive/5 py-12 text-center">
            <p className="px-4 text-sm text-destructive">{loadError}</p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setReloadToken((token) => token + 1);
              }}
            >
              重新載入
            </Button>
          </div>
        )}

        {status === "ready" && todos.length === 0 && (
          <div className="rounded-lg border border-dashed py-14 text-center text-sm text-muted-foreground">
            還沒有任何待辦，從上面的輸入框開始新增吧。
          </div>
        )}

        {status === "ready" && todos.length > 0 && (
          <ul className="grid gap-2">
            {todos.map((todo) => (
              <TodoItem
                key={todo.id}
                todo={todo}
                busy={busyId === todo.id}
                onToggle={(completed) => {
                  void handleUpdate(todo.id, { completed });
                }}
                onRename={(title) => {
                  void handleUpdate(todo.id, { title });
                }}
                onRequestDelete={() => {
                  setPendingDelete(todo);
                }}
              />
            ))}
          </ul>
        )}
      </main>

      {status === "ready" && todos.length > 0 && (
        <footer className="mt-6 text-sm text-muted-foreground">
          共 {todos.length} 筆，尚有 {remaining} 筆未完成。
        </footer>
      )}

      <DeleteTodoDialog
        title={pendingDelete?.title ?? null}
        pending={deleting}
        onCancel={() => {
          setPendingDelete(null);
        }}
        onConfirm={() => {
          void handleDelete();
        }}
      />
    </div>
  );
}
