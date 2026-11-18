export function Notice({ children }: { children: string }) {
  return <p className="border border-danger/30 bg-card px-3 py-2 text-sm text-danger">{children}</p>
}

export function PageHeader({ kicker, title, text }: { kicker?: string; title: string; text?: string }) {
  return (
    <header className="mb-8">
      {kicker ? <p className="text-xs uppercase tracking-[0.16em] text-muted">{kicker}</p> : null}
      <h1 className="mt-2 font-serif text-4xl leading-tight sm:text-5xl">{title}</h1>
      {text ? <p className="mt-3 max-w-2xl text-muted">{text}</p> : null}
    </header>
  )
}
