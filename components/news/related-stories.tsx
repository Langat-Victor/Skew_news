import { RelatedStoryCard } from "@/components/ui/related-story-card";
import type { RelatedStory } from "@/lib/news/types";
import { cn } from "@/lib/utils";

export interface RelatedStoriesProps {
  stories: RelatedStory[];
  className?: string;
}

export function RelatedStories({ stories, className }: RelatedStoriesProps) {
  if (stories.length === 0) return null;

  return (
    <section className={cn("border-t border-divider pt-6", className)}>
      <h2 className="text-h4 font-semibold text-text-primary">
        Related Stories
      </h2>

      <div className="mt-4 grid gap-x-6 gap-y-4 sm:grid-cols-2">
        {stories.map((story) => (
          <RelatedStoryCard
            key={story.slug ?? story.title}
            story={story}
            imageUrl={story.imageUrl}
          />
        ))}
      </div>
    </section>
  );
}
