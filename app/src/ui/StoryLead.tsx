/** A finding at the top of a page, and the question that leads to the next one. */
export function StoryLead({ text }: { text: string }) {
  return (
    <p className="tj-lead" data-testid="story-lead">
      {text}
    </p>
  );
}

export function StoryNext({
  question,
  action,
  onGo,
}: {
  question: string;
  action: string;
  onGo: () => void;
}) {
  return (
    <aside className="tj-next" aria-label="Next in the story">
      <p>{question}</p>
      <button type="button" className="tj-next-btn" aria-label={`Next: ${action}`} onClick={onGo}>
        {action}
        <span aria-hidden="true"> &rarr;</span>
      </button>
    </aside>
  );
}
