import { Menu } from "lucide-react";
import { AuthControls } from "@/components/layout/auth-controls";
import { SiteNav } from "@/components/layout/site-nav";
import { Logo } from "@/components/ui/logo";

export function SiteHeader() {
  return (
    <header className="border-b border-border bg-bg-primary">
      <div className="mx-auto flex max-w-page items-center justify-between px-6 py-4">
        <div className="flex items-center gap-6">
          {/* TODO(nav): open a mobile drawer once section routes exist. */}
          <Menu
            size={24}
            strokeWidth={2}
            aria-hidden
            className="text-text-primary"
          />
          <Logo size="sm" />

          <SiteNav />
        </div>

        <AuthControls />
      </div>
    </header>
  );
}
