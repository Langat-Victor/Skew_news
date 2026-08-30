import { ChevronDown, Globe } from "lucide-react";
import { CurrentDate } from "@/components/layout/current-date";

/*
  Top dark strip. Everything here is presentational: the theme switcher, edition
  selector, `Set Location`, and `Browser Extension` are inert `<span>`s because
  their backing features do not exist yet, and the token layer is light-only so
  a working theme toggle would visibly do nothing.
  TODO(theme): wire the switcher once a dark token layer exists.
  TODO(edition/location): wire once localisation / geolocation ship.
*/
export function UtilityBar() {
  return (
    <div className="bg-text-primary text-caption text-white/70">
      <div className="mx-auto flex max-w-page items-center justify-between px-6 py-2.5">
        <div className="flex items-center gap-6">
          <span className="hidden sm:inline">Browser Extension</span>
          <span className="hidden items-center gap-2 md:flex">
            <span>Theme:</span>
            <span className="font-medium text-white">Light</span>
            <span className="text-white/50">Dark</span>
            <span className="text-white/50">Auto</span>
          </span>
        </div>

        <div className="flex items-center gap-5">
          <CurrentDate />
          <span className="hidden sm:inline">Set Location</span>
          <span className="flex items-center gap-1.5">
            <Globe size={12} strokeWidth={2} aria-hidden />
            International Edition
            <ChevronDown size={12} strokeWidth={2} aria-hidden />
          </span>
        </div>
      </div>
    </div>
  );
}
