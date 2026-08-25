import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { registerInputSchema } from "@todos/shared";
import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import type { z } from "zod";
import { AuthShell } from "@/components/auth-shell";
import { PasswordRules } from "@/components/password-rules";
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

type RegisterValues = z.input<typeof registerInputSchema>;

export const Route = createFileRoute("/register")({
  beforeLoad: () => {
    if (useAuthStore.getState().isAuthenticated) {
      throw redirect({ to: "/todos" });
    }
  },
  component: RegisterPage,
});

function RegisterPage() {
  const navigate = useNavigate();
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const setAuth = useAuthStore((state) => state.setAuth);
  const [formError, setFormError] = useState<string | null>(null);
  const registerMutation = useMutation(trpc.auth.register.mutationOptions());

  // 註冊採用強密碼規則（至少 8 碼 + 大寫 / 小寫 / 符號各 1）
  const form = useForm<RegisterValues, unknown, z.output<typeof registerInputSchema>>({
    resolver: zodResolver(registerInputSchema),
    defaultValues: { email: "", password: "" },
    mode: "onTouched",
  });

  // 用 useWatch 而非 form.watch()，後者無法被 React Compiler 安全記憶化
  const email = useWatch({ control: form.control, name: "email" });
  const password = useWatch({ control: form.control, name: "password" });
  const canSubmit = email.trim() !== "" && password !== "";

  const onSubmit = form.handleSubmit(async (values) => {
    setFormError(null);
    try {
      // 註冊成功直接視為登入，不再回到登入頁
      const payload = await registerMutation.mutateAsync(values);
      setAuth(payload);
      // 換帳號時不要讓上一個使用者的快取殘留到 /todos
      queryClient.clear();
      await navigate({ to: "/todos" });
    } catch (error) {
      setFormError(toErrorMessage(error, "註冊失敗，請稍後再試"));
    }
  });

  return (
    <AuthShell title="註冊" description="建立新帳號，馬上開始管理你的待辦事項。">
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
                    autoComplete="new-password"
                    placeholder="請設定密碼"
                    {...field}
                  />
                </FormControl>
                <PasswordRules password={field.value} />
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
            {form.formState.isSubmitting ? "註冊中…" : "註冊並登入"}
          </Button>

          <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <span>已經有帳號？</span>
            <Button
              type="button"
              variant="link"
              className="h-auto p-0"
              onClick={() => {
                void navigate({ to: "/login" });
              }}
            >
              返回登入
            </Button>
          </div>
        </form>
      </Form>
    </AuthShell>
  );
}
