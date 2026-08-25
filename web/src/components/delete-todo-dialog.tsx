import { DELETE_CONFIRMATION_WORD } from "@todos/shared";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface DeleteTodoDialogProps {
  /** 要刪除的待辦標題；null 代表彈窗關閉 */
  title: string | null;
  pending: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

/**
 * 刪除二次確認彈窗：必須輸入「完全等於」DELETE_CONFIRMATION_WORD 的字串才能送出，
 * 不做 trim、不做大小寫轉換。
 */
export function DeleteTodoDialog({ title, pending, onCancel, onConfirm }: DeleteTodoDialogProps) {
  const [confirmation, setConfirmation] = useState("");
  const canConfirm = confirmation === DELETE_CONFIRMATION_WORD;
  const open = title !== null;

  const close = () => {
    setConfirmation("");
    onCancel();
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) close();
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>刪除待辦</DialogTitle>
          <DialogDescription>這個動作無法復原。確定要刪除「{title ?? ""}」嗎？</DialogDescription>
        </DialogHeader>

        <div className="grid gap-2">
          <Label htmlFor="delete-confirmation">
            請輸入{" "}
            <code className="rounded bg-muted px-1 py-0.5 font-mono text-foreground">
              {DELETE_CONFIRMATION_WORD}
            </code>{" "}
            以確認
          </Label>
          <Input
            id="delete-confirmation"
            value={confirmation}
            autoComplete="off"
            placeholder={DELETE_CONFIRMATION_WORD}
            onChange={(event) => {
              setConfirmation(event.target.value);
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter" && canConfirm && !pending) {
                event.preventDefault();
                setConfirmation("");
                onConfirm();
              }
            }}
          />
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={close} disabled={pending}>
            取消
          </Button>
          <Button
            type="button"
            variant="destructive"
            disabled={!canConfirm || pending}
            onClick={() => {
              setConfirmation("");
              onConfirm();
            }}
          >
            {pending ? "刪除中…" : "確認刪除"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
