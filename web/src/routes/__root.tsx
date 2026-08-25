import { createRootRoute, Link, Outlet } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Toaster } from "@/components/ui/sonner";

export const Route = createRootRoute({
  component: RootLayout,
  notFoundComponent: NotFound,
});

function RootLayout() {
  return (
    <div className="min-h-dvh bg-background text-foreground antialiased">
      <Outlet />
      <Toaster position="top-center" richColors closeButton />
    </div>
  );
}

function NotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 px-4 text-center">
      <p className="text-6xl font-semibold tracking-tight">404</p>
      <p className="text-muted-foreground">找不到這個頁面。</p>
      <Button asChild variant="outline">
        <Link to="/">回到首頁</Link>
      </Button>
    </main>
  );
}
