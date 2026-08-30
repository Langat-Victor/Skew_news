import { ChevronRight } from "lucide-react";
import { Chip } from "@/components/ui/chip";

/*
  Horizontally scrollable topic rail. The right edge is an `aria-hidden`
  fade + chevron that signals overflow without pretending to be a button.
  The reference is drawn mid-scroll, so its first chip is clipped to a bare `+`;
  `US Politics` is an inferred label for that slot. Every other label is
  transcribed from the reference.
const TOPICS = [
  "US Politics",
  "World Cup",
  "IPL",
  "Social Media",
  "Business & Markets",
  "Health & Medicine",
  "Soccer",
  "Artificial Intelligence",
  "Arsenal FC",
  "Extreme Weather and Disasters",
];

export function TopicRail({ currentTopic }: { currentTopic?: string }) {
  return (
    <div className="border-b border-border bg-bg-primary">
      <div className="mx-auto max-w-page px-6 py-3">
        <div className="relative">
            {TOPICS.map((topic) => {
              const isActive = currentTopic === topic;
              return (
                <Link
                  key={topic}
                  href={isActive ? "/" : `/?topic=${encodeURIComponent(topic)}`}
                  className="shrink-0 outline-hidden"
                >
              strokeWidth={2}
              className="text-text-secondary"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
