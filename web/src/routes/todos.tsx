import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { todoTitleSchema, type Todo } from "@todos/shared";
import { LoaderCircleIcon, LogOutIcon, PlusIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { DeleteTodoDialog } from "@/components/delete-todo-dialog";
import { ThemeToggle } from "@/components/theme-toggle";
import { TodoItem } from "@/components/todo-item";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toErrorMessage } from "@/lib/trpc";
import { useTRPC } from "@/lib/trpc-react";
import { useAuthStore } from "@/stores/auth";

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
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);

  const [newTitle, setNewTitle] = useState("");
  const [pendingDelete, setPendingDelete] = useState<Todo | null>(null);

  const todosKey = trpc.todo.list.queryKey();
  const listQuery = useQuery(trpc.todo.list.queryOptions());

  // 重新整理後 store 只剩「cookie 判定的登入狀態」，靠 auth.me 補齊 Email。
  // 這條失敗不需要顯示在 UI：換發 / 導回登入由 authRefreshLink 處理。
  const meQuery = useQuery(trpc.auth.me.queryOptions());
  const email = user?.email ?? meQuery.data?.email;

  /** 三個 mutation 共用：飛完（成功或失敗）都跟 server 對一次帳 */
  const syncTodos = async () => {
    await queryClient.invalidateQueries({ queryKey: todosKey });
  };

  const createMutation = useMutation(
    trpc.todo.create.mutationOptions({
      onMutate: async (variables) => {
        // 先擋掉在飛的 list refetch，否則它會蓋掉下面的樂觀寫入
        await queryClient.cancelQueries({ queryKey: todosKey });
        const now = new Date().toISOString();
        const optimistic: Todo = {
          id: crypto.randomUUID(),
          title: variables.title,
          completed: false,
          createdAt: now,
          updatedAt: now,
        };
        queryClient.setQueryData(todosKey, (current) => [optimistic, ...(current ?? [])]);
        return { optimisticId: optimistic.id };
      },
      onSuccess: (created, _variables, onMutateResult) => {
        // 用 server 回傳的真資料換掉樂觀那一筆（id / 時間戳才會正確）
        queryClient.setQueryData(todosKey, (current) =>
          current?.map((todo) => (todo.id === onMutateResult.optimisticId ? created : todo)),
        );
      },
      onError: (error, _variables, onMutateResult) => {
        // rollback：把樂觀插入的那一筆移除
        const optimisticId = onMutateResult?.optimisticId;
        if (optimisticId !== undefined) {
          queryClient.setQueryData(todosKey, (current) =>
            current?.filter((todo) => todo.id !== optimisticId),
          );
        }
        toast.error(toErrorMessage(error, "新增待辦失敗"));
      },
      onSettled: syncTodos,
    }),
  );

  const updateMutation = useMutation(
    trpc.todo.update.mutationOptions({
      onMutate: async (variables) => {
        await queryClient.cancelQueries({ queryKey: todosKey });
        const previous = queryClient
          .getQueryData(todosKey)
          ?.find((todo) => todo.id === variables.id);
        queryClient.setQueryData(todosKey, (current) =>
          current?.map((todo) =>
            todo.id === variables.id
              ? {
                  ...todo,
                  title: variables.title ?? todo.title,
                  completed: variables.completed ?? todo.completed,
                }
              : todo,
          ),
        );
        return { previous };
      },
      onSuccess: (updated) => {
        queryClient.setQueryData(todosKey, (current) =>
          current?.map((todo) => (todo.id === updated.id ? updated : todo)),
        );
      },
      onError: (error, variables, onMutateResult) => {
        // rollback：把那一筆換回改動前的內容
        const previous = onMutateResult?.previous;
        if (previous !== undefined) {
          queryClient.setQueryData(todosKey, (current) =>
            current?.map((todo) => (todo.id === variables.id ? previous : todo)),
          );
        }
        toast.error(toErrorMessage(error, "更新待辦失敗"));
      },
      onSettled: syncTodos,
    }),
  );

  const deleteMutation = useMutation(
    trpc.todo.delete.mutationOptions({
      onMutate: async (variables) => {
        await queryClient.cancelQueries({ queryKey: todosKey });
        const current = queryClient.getQueryData(todosKey);
        const index = current?.findIndex((todo) => todo.id === variables.id) ?? -1;
        queryClient.setQueryData(todosKey, (list) =>
          list?.filter((todo) => todo.id !== variables.id),
        );
        return { index, removed: index < 0 ? undefined : current?.[index] };
      },
      onSuccess: () => {
        toast.success("已刪除待辦");
      },
      onError: (error, _variables, onMutateResult) => {
        // rollback：把刪掉的那一筆插回原本的位置
        const removed = onMutateResult?.removed;
        const index = onMutateResult?.index ?? 0;
        if (removed !== undefined) {
          queryClient.setQueryData(todosKey, (list) => {
            const next = [...(list ?? [])];
            next.splice(index, 0, removed);
            return next;
          });
        }
        toast.error(toErrorMessage(error, "刪除待辦失敗"));
      },
      onSettled: syncTodos,
    }),
  );

  const trimmedTitle = newTitle.trim();
  const canCreate = todoTitleSchema.safeParse(newTitle).success;

  const handleCreate = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canCreate) return;
    // 樂觀更新會立刻把新待辦畫上去，輸入框同步清空
    setNewTitle("");
    createMutation.mutate({ title: trimmedTitle });
  };

  const handleDelete = () => {
    if (pendingDelete === null) return;
    deleteMutation.mutate({ id: pendingDelete.id });
    setPendingDelete(null);
  };

  const handleLogout = async () => {
    // 清掉 access + refresh cookie 並重設 store
    logout();
    await navigate({ to: "/login" });
    // 等離開 /todos 之後才清快取：清在導頁前會讓還掛著的 list observer
    // 立刻用「已被清掉的 token」重打一次 API
    queryClient.clear();
  };

  const todos = listQuery.data ?? [];
  const isLoading = listQuery.isPending;
  // 只有「完全沒有資料」時才算載入失敗；已經有清單時背景 refetch 失敗不該把畫面清空
  const loadFailed = listQuery.isError && listQuery.data === undefined;
  const isReady = !isLoading && !loadFailed;
  const remaining = todos.filter((todo) => !todo.completed).length;

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-2xl flex-col px-4 py-8 sm:py-12">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight">我的待辦</h1>
          <p className="truncate text-sm text-muted-foreground">{email ?? "　"}</p>
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

      <form className="mb-6 flex gap-2" onSubmit={handleCreate}>
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
        {isLoading && (
          <div className="flex items-center justify-center gap-2 rounded-lg border border-dashed py-14 text-sm text-muted-foreground">
            <LoaderCircleIcon className="size-4 animate-spin" />
            載入中…
          </div>
        )}

        {loadFailed && (
          <div className="flex flex-col items-center gap-3 rounded-lg border border-destructive/40 bg-destructive/5 py-12 text-center">
            <p className="px-4 text-sm text-destructive">
              {toErrorMessage(listQuery.error, "載入待辦清單失敗")}
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                void listQuery.refetch();
              }}
            >
              重新載入
            </Button>
          </div>
        )}

        {isReady && todos.length === 0 && (
          <div className="rounded-lg border border-dashed py-14 text-center text-sm text-muted-foreground">
            還沒有任何待辦，從上面的輸入框開始新增吧。
          </div>
        )}

        {isReady && todos.length > 0 && (
          <ul className="grid gap-2">
            {todos.map((todo) => (
              <TodoItem
                key={todo.id}
                todo={todo}
                onToggle={(completed) => {
                  updateMutation.mutate({ id: todo.id, completed });
                }}
                onRename={(title) => {
                  updateMutation.mutate({ id: todo.id, title });
                }}
                onRequestDelete={() => {
                  setPendingDelete(todo);
                }}
              />
            ))}
          </ul>
        )}
      </main>

      {isReady && todos.length > 0 && (
        <footer className="mt-6 text-sm text-muted-foreground">
          共 {todos.length} 筆，尚有 {remaining} 筆未完成。
        </footer>
      )}

      <DeleteTodoDialog
        title={pendingDelete?.title ?? null}
        // 刪除改成樂觀更新後，按下確認就立刻關窗，沒有「刪除中」的狀態要顯示。
        // 這裡不能綁 deleteMutation.isPending：invalidate 期間它仍為 true，
        // 會讓下一筆待辦剛開啟的彈窗一進來就是 disabled。
        pending={false}
        onCancel={() => {
          setPendingDelete(null);
        }}
        onConfirm={handleDelete}
      />
    </div>
  );
}
