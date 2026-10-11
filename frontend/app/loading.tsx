export default function Loading() {
  return (
    <main className="mx-auto flex max-w-2xl flex-col items-center gap-3 px-4 pt-10">
      {[0, 1].map((i) => (
        <div key={i} className="h-36 w-full animate-pulse rounded-2xl bg-white shadow-sm dark:bg-slate-900" />
      ))}
    </main>
  );
}
