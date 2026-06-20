export function PlaceholderPage({ title }: { title: string }) {
  return (
    <section>
      <h1 className="text-xl font-semibold">{title}</h1>
      <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">
        En construccion.
      </p>
    </section>
  );
}
