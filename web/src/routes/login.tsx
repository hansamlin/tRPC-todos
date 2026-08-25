import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { loginInputSchema } from "@todos/shared";
import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import type { z } from "zod";
import { AuthShell } from "@/components/auth-shell";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { toErrorMessage } from "@/lib/trpc";
import { useTRPC } from "@/lib/trpc-react";
import { useAuthStore } from "@/stores/auth";

type LoginValues = z.input<typeof loginInputSchema>;

export const Route = createFileRoute("/login")({
  beforeLoad: () => {
    // 已登入就不需要再看登入頁
    if (useAuthStore.getState().isAuthenticated) {
      throw redirect({ to: "/todos" });
    }
  },
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const setAuth = useAuthStore((state) => state.setAuth);
  const [formError, setFormError] = useState<string | null>(null);
  const loginMutation = useMutation(trpc.auth.login.mutationOptions());

  // 登入只驗「兩欄都有填」（loginInputSchema），不可套用強密碼規則
  const form = useForm<LoginValues, unknown, z.output<typeof loginInputSchema>>({
    resolver: zodResolver(loginInputSchema),
    defaultValues: { email: "", password: "" },
  });

  // 用 useWatch 而非 form.watch()，後者無法被 React Compiler 安全記憶化
  const email = useWatch({ control: form.control, name: "email" });
  const password = useWatch({ control: form.control, name: "password" });
  const canSubmit = email.trim() !== "" && password !== "";

  const onSubmit = form.handleSubmit(async (values) => {
    setFormError(null);
    try {
      const payload = await loginMutation.mutateAsync(values);
      setAuth(payload);
      // 換帳號時不要讓上一個使用者的快取殘留到 /todos
      queryClient.clear();
      await navigate({ to: "/todos" });
    } catch (error) {
      setFormError(toErrorMessage(error, "登入失敗，請稍後再試"));
    }
  });

  return (
    <AuthShell title="登入" description="輸入 Email 與密碼以繼續使用待辦清單。">
      <Form {...form}>
        <form className="grid gap-4" onSubmit={onSubmit} noValidate>
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Email</FormLabel>
                <FormControl>
                  <Input
                    type="email"
                    autoComplete="email"
                    placeholder="you@example.com"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem>
                <FormLabel>密碼</FormLabel>
                <FormControl>
                  <Input
                    type="password"
                    autoComplete="current-password"
                    placeholder="請輸入密碼"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {formError !== null && (
            <p
              role="alert"
              className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
            >
              {formError}
            </p>
          )}

          <Button type="submit" disabled={!canSubmit || form.formState.isSubmitting}>
            {form.formState.isSubmitting ? "登入中…" : "登入"}
          </Button>

          <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <span>還沒有帳號？</span>
            <Button
              type="button"
              variant="link"
              className="h-auto p-0"
              onClick={() => {
                void navigate({ to: "/register" });
              }}
            >
              註冊
            </Button>
          </div>
        </form>
      </Form>
    </AuthShell>
  );
}
