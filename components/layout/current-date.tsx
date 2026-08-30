"use client";

import { useSyncExternalStore } from "react";

/*
  The masthead date must reflect the reader's "now", not the build time. A
  Server Component would freeze `new Date()` into the static prerender, so the
  value is read on the client via `useSyncExternalStore`: the server snapshot is
  `null` (an empty, width-reserved slot) and the client snapshot is the formatted
  date. Server and first client render agree on `null`, so there is no hydration
  mismatch and no `setState`-in-effect. The formatted string is stable across a
  day, so the snapshot compares equal between renders.
*/
const FORMATTER = new Intl.DateTimeFormat("en-US", {
  weekday: "long",
  month: "long",
  day: "numeric",
  year: "numeric",
});

// The date only changes at a day boundary, well outside a page view — nothing
// to subscribe to, so the store never notifies.
const subscribe = () => () => {};
const getSnapshot = () => FORMATTER.format(new Date());
const getServerSnapshot = () => null;

export function CurrentDate() {
  const date = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  return (
    <span className="inline-block min-w-[10.5rem] text-right">
      {date ?? " "}
    </span>
  );
}
