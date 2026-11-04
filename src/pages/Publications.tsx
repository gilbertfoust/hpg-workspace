import { Link, useParams } from "react-router-dom";
import { ArrowLeft, BookOpen, CalendarDays, Globe2 } from "lucide-react";
import { usePublication, usePublications, type PublicContribution } from "@/hooks/usePublications";

const dateLabel = (date: string) => new Date(date).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });

function ReadableText({ text }: { text: string }) {
  return <div className="space-y-5 text-[1.02rem] leading-8 text-slate-800">
    {(text || "").split(/\n{2,}/).filter(Boolean).map((part, index) =>
      part.startsWith("## ") ? <h3 key={index} className="pt-5 font-serif text-2xl font-semibold">{part.slice(3)}</h3> :
      part.startsWith("# ") ? <h2 key={index} className="pt-5 font-serif text-3xl font-semibold">{part.slice(2)}</h2> :
      <p key={index} className="whitespace-pre-wrap">{part}</p>
    )}
  </div>;
}
function PublicationHeader() {
  return <header className="border-b border-amber-800/15 bg-white/95">
    <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-4 px-5 py-5">
      <Link to="/publications" className="flex items-center gap-3 text-slate-900">
        <Globe2 className="h-8 w-8 text-amber-700" />
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-800">Humanity Pathways Global</p>
          <p className="font-serif text-xl font-semibold">Publications</p>
        </div>
      </Link>
      <nav className="flex items-center gap-4 text-sm"><Link className="hover:underline" to="/publications">All editions</Link>
        <Link className="text-slate-500 hover:underline" to="/auth">Staff sign-in</Link></nav>
    </div>
  </header>;
}
const formatKind = (kind: string) => kind.replaceAll("_", " ");

function PublicationContents({ contributions }: { contributions: PublicContribution[] }) {
  return <div className="space-y-14">
    <section className="rounded-lg border border-amber-200 bg-amber-50/50 p-6">
      <h2 className="mb-4 font-serif text-2xl">In this issue</h2>
      <ol className="list-decimal space-y-2 pl-5">
        {contributions.map((item, index) => <li key={index}><a className="underline-offset-2 hover:underline" href={"#article-" + (index + 1)}>{item.title}</a></li>)}
      </ol>
    </section>
    {contributions.map((item, index) => <article key={index} id={"article-" + (index + 1)} className="scroll-mt-10 border-b border-slate-200 pb-14">
      <p className="mb-3 text-xs font-semibold uppercase tracking-[0.15em] text-amber-800">{formatKind(item.kind)}</p>
      <h2 className="mb-3 font-serif text-3xl font-semibold tracking-tight">{item.title}</h2>
      {item.summary && <p className="mb-6 text-lg italic text-slate-600">{item.summary}</p>}
      <ReadableText text={item.body_markdown} />
    </article>)}
  </div>;
}

export default function Publications() {
  const { slug } = useParams<{ slug?: string }>();
  const list = usePublications();
  const detail = usePublication(slug);
  const loading = slug ? detail.isLoading : list.isLoading;
  const error = slug ? detail.error : list.error;
  const publication = detail.data;
  return <div className="min-h-screen bg-[#f9f7f3] font-sans text-slate-900">
    <PublicationHeader />
    <main className="mx-auto max-w-5xl px-5 py-10">
      {loading ? <p className="text-slate-600">Loading HPG publications…</p> :
        error ? <div role="alert" className="rounded-md border border-red-200 p-6">The publication catalog could not be loaded. Please try again.</div> :
        slug ? publication ? (
          <div className="mx-auto max-w-3xl">
            <Link to="/publications" className="mb-8 inline-flex items-center gap-2 text-sm text-amber-800 hover:underline"><ArrowLeft className="h-4 w-4" /> All publications</Link>
            <div className="mb-10 border-b border-slate-300 pb-9">
              <p className="mb-4 text-xs font-semibold uppercase tracking-[0.2em] text-amber-800">{formatKind(publication.kind)}</p>
              <h1 className="font-serif text-4xl font-semibold tracking-tight md:text-5xl">{publication.title}</h1>
              {publication.summary && <p className="mt-5 text-xl leading-8 text-slate-600">{publication.summary}</p>}
              <div className="mt-6 flex items-center gap-2 text-sm text-slate-500"><CalendarDays className="h-4 w-4" /> Published {dateLabel(publication.published_at)}</div>
            </div>
            {publication.kind === "issue" ? <PublicationContents contributions={Array.isArray(publication.contributions) ? publication.contributions : []} /> :
              <ReadableText text={publication.body_markdown} />}
            <p className="mt-12 border-t pt-6 text-sm text-slate-500">This edition was published by Humanity Pathways Global. It is a public snapshot of approved editorial content.</p>
          </div>
        ) : <div className="rounded-lg border p-8 text-center">
          <h1 className="font-serif text-2xl">Publication unavailable</h1>
          <p className="mt-2 text-sm text-slate-600">This item was not found, is not yet released, or has been withdrawn.</p>
          <Link to="/publications" className="mt-4 inline-block font-medium text-amber-800 underline">Browse published editions</Link>
        </div> :
        <div>
          <div className="mb-10 max-w-3xl">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-800">Perspectives · Reports · Magazine Editions</p>
            <h1 className="mt-3 font-serif text-5xl font-semibold tracking-tight">HPG Publications</h1>
            <p className="mt-5 text-lg leading-8 text-slate-600">Research, interviews, stories, and publications released by Humanity Pathways Global. Only approved public editions appear here.</p>
          </div>
          {(list.data || []).length === 0 ? <div className="rounded-xl border bg-white p-10 text-center">
            <BookOpen className="mx-auto mb-4 h-9 w-9 text-amber-700" />
            <p className="text-lg font-medium">No editions have been released yet.</p>
            <p className="mt-2 text-sm text-slate-600">New issues and articles will appear here after editorial approval and publication.</p>
          </div> : <div className="grid gap-5 md:grid-cols-2">
            {(list.data || []).map(item => <Link to={"/publications/" + item.slug} key={item.id}
              className="group rounded-xl border border-slate-200 bg-white p-7 transition-shadow hover:shadow-lg">
              <p className="text-xs font-semibold uppercase tracking-[0.17em] text-amber-800">{formatKind(item.kind)}</p>
              <h2 className="mt-3 font-serif text-2xl font-semibold group-hover:text-amber-900">{item.title}</h2>
              {item.summary && <p className="mt-3 line-clamp-3 text-sm leading-7 text-slate-600">{item.summary}</p>}
              <p className="mt-6 text-xs text-slate-500">{dateLabel(item.published_at)}</p>
            </Link>)}
          </div>}
        </div>}
    </main>
    <footer className="mt-16 border-t border-amber-900/10 px-5 py-8 text-center text-xs text-slate-500">Humanity Pathways Global · Public editorial archive</footer>
  </div>;
}
