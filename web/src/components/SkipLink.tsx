export function SkipLink({
  href = "#main-content",
  label = "Skip to main content",
}: {
  href?: string;
  label?: string;
}) {
  return (
    <a
      href={href}
      className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[100] focus:rounded-md focus:bg-surface focus:px-3 focus:py-2 focus:text-sm focus:shadow-lg"
    >
      {label}
    </a>
  );
}
