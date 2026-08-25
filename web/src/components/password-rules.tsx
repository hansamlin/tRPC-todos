import { CheckIcon, CircleIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/** 與 shared 的 strongPasswordSchema 對齊：至少 8 碼 + 大寫 / 小寫 / 符號各 1（規格未要求數字） */
const RULES = [
  { label: "至少 8 碼", test: (value: string) => value.length >= 8 },
  { label: "包含大寫字母", test: (value: string) => /[A-Z]/.test(value) },
  { label: "包含小寫字母", test: (value: string) => /[a-z]/.test(value) },
  { label: "包含符號", test: (value: string) => /[^A-Za-z0-9]/.test(value) },
];

/** 即時顯示密碼還差哪一項，讓使用者一眼看出差在哪 */
export function PasswordRules({ password }: { password: string }) {
  return (
    <ul className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-muted-foreground">
      {RULES.map((rule) => {
        const passed = rule.test(password);
        return (
          <li
            key={rule.label}
            className={cn(
              "flex items-center gap-1.5",
              passed && "text-emerald-600 dark:text-emerald-400",
            )}
          >
            {passed ? <CheckIcon className="size-3" /> : <CircleIcon className="size-3" />}
            {rule.label}
          </li>
        );
      })}
    </ul>
  );
}
