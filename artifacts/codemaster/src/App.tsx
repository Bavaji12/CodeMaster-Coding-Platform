import { useState, type ButtonHTMLAttributes, type ChangeEvent, type FormEvent, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import {
  Activity, ArrowRight, ArrowUpRight, BookOpen, Check, CheckCircle2,
  ChevronLeft, ChevronRight, Code2, Command, Flame, Gauge,
  Globe2, LayoutDashboard, ListFilter, LoaderCircle, LogOut, Menu, Play,
  Plus, Search, Settings2, Shield, Sparkles, Terminal, Trophy, UserRound, Users,
  X, Zap,
} from 'lucide-react';
import {
  getGetAdminStatsQueryKey, getGetCurrentUserQueryKey, getGetDashboardQueryKey,
  getGetLeaderboardQueryKey, getGetMyProfileQueryKey, getGetPublicProfileQueryKey,
  getGetProblemQueryKey, getGetSubmissionQueryKey, getListAdminProblemsQueryKey, getListProblemsQueryKey, getListSubmissionsQueryKey,
  useCreateProblem, useDeleteProblem, useGetAdminStats, useGetCurrentUser,
  useGetDashboard, useGetLeaderboard, useGetMyProfile, useGetProblem,
  useGetPublicProfile, useGetSubmission, useHealthCheck, useListAdminProblems,
  useListProblems, useListSubmissions, useLogin, useLogout, useRegister,
  useRunCode, useSetProblemActive, useSubmitCode, useUpdateMyProfile, useUpdateProblem,
} from '@workspace/api-client-react';
import type {
  AdminProblem, Dashboard, ProblemSummary, ProblemWriteInput, Profile, Submission, SubmissionSummary,
  User,
} from '@workspace/api-client-react';
import { Link, Route, Switch, useLocation, useParams } from 'wouter';
import Editor from '@monaco-editor/react';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import './index.css';

const queryClient = new QueryClient();
const navItems = [
  { href: '/', label: 'Overview', icon: LayoutDashboard },
  { href: '/problems', label: 'Problem set', icon: Code2 },
  { href: '/dashboard', label: 'My progress', icon: Activity },
  { href: '/leaderboard', label: 'Leaderboard', icon: Trophy },
];

function cx(...items: (string | false | undefined | null)[]) { return items.filter(Boolean).join(' '); }
function initials(name?: string) { return (name || 'CM').split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase(); }
function pct(value?: number) { return `${Number(value || 0).toFixed(1)}%`; }
function dateLabel(value?: string) { return value ? new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : '—'; }
function difficultyClass(value?: string) { return value === 'Easy' ? 'text-emerald-300 bg-emerald-300/10' : value === 'Hard' ? 'text-rose-300 bg-rose-300/10' : 'text-amber-200 bg-amber-200/10'; }
function apiErrorMessage(error: unknown, fallback: string) {
  const data = error && typeof error === 'object' && 'data' in error
    ? (error as { data?: { error?: unknown } }).data
    : undefined;
  if (typeof data?.error === 'string') return data.error;
  return error instanceof Error ? error.message : fallback;
}

function Button({ children, className = '', variant = 'primary', ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'quiet' | 'outline' | 'danger' }) {
  const styles = {
    primary: 'bg-primary text-primary-foreground border border-primary/80 hover:brightness-110 shadow-[0_8px_28px_rgba(74,212,163,.11)]',
    quiet: 'bg-transparent text-muted-foreground border border-transparent hover:bg-secondary hover:text-foreground',
    outline: 'bg-secondary/70 text-foreground border border-border hover:border-primary/40 hover:bg-secondary',
    danger: 'bg-rose-500/10 text-rose-300 border border-rose-400/20 hover:bg-rose-500/20',
  };
  return <button {...props} className={cx('shine inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-50', styles[variant], className)}>{children}</button>;
}

function Panel({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <section className={cx('surface rounded-2xl', className)}>{children}</section>;
}

function SectionTitle({ eyebrow, title, detail, action }: { eyebrow?: string; title: string; detail?: string; action?: ReactNode }) {
  return <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
    <div>{eyebrow && <p className="mono mb-2 text-[10px] uppercase tracking-[.2em] text-primary">{eyebrow}</p>}<h1 className="text-2xl font-extrabold tracking-tight sm:text-[30px]">{title}</h1>{detail && <p className="mt-2 text-sm text-muted-foreground">{detail}</p>}</div>
    {action}
  </div>;
}

function Loading({ rows = 4 }: { rows?: number }) {
  return <div className="space-y-3" aria-label="Loading"><div className="skeleton h-10 w-1/3 rounded-xl" />{Array.from({ length: rows }, (_, i) => <div key={i} className="skeleton h-[62px] rounded-xl" />)}</div>;
}

function DataState({ loading, error, retry, children, empty, emptyTitle = 'Nothing here yet' }: { loading: boolean; error?: boolean; retry?: () => void; children?: ReactNode; empty?: boolean; emptyTitle?: string }) {
  if (loading) return <Loading />;
  if (error) return <div className="rounded-2xl border border-rose-300/20 bg-rose-300/[.04] p-8 text-center" data-testid="status-load-error"><p className="font-bold">Could not load this view</p><p className="mt-1 text-sm text-muted-foreground">The service may be taking a moment.</p>{retry && <Button variant="outline" onClick={retry} className="mt-4" data-testid="button-retry">Try again</Button>}</div>;
  if (empty) return <div className="grid min-h-52 place-items-center rounded-2xl border border-dashed border-border p-8 text-center" data-testid="status-empty"><div><div className="mx-auto mb-3 grid h-11 w-11 place-items-center rounded-xl bg-secondary text-primary"><Code2 size={19} /></div><p className="font-bold">{emptyTitle}</p><p className="mt-1 text-sm text-muted-foreground">Your next milestone is one problem away.</p></div></div>;
  return <>{children}</>;
}

function Avatar({ user, size = 'md' }: { user: Pick<User, 'name' | 'avatar'> | Pick<Profile, 'name' | 'avatar'> | { name: string; avatar?: string | null }; size?: 'sm' | 'md' | 'lg' }) {
  const dimensions = size === 'lg' ? 'h-16 w-16 text-lg' : size === 'sm' ? 'h-8 w-8 text-[10px]' : 'h-10 w-10 text-xs';
  return user.avatar
    ? <img src={user.avatar} alt={`${user.name} avatar`} data-testid="img-avatar" className={cx('rounded-xl border border-border object-cover', dimensions)} />
    : <div data-testid="img-avatar" className={cx('grid shrink-0 place-items-center rounded-xl border border-primary/20 bg-primary/10 font-extrabold text-primary', dimensions)}>{initials(user.name)}</div>;
}

function AppShell({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const userQuery = useGetCurrentUser({ query: { queryKey: getGetCurrentUserQueryKey(), retry: false } });
  const health = useHealthCheck();
  const logout = useLogout();
  const qc = useQueryClient();
  const user = userQuery.data;
  const [mobileOpen, setMobileOpen] = useState(false);
  const doLogout = () => logout.mutate(undefined, { onSuccess: () => { qc.setQueryData(getGetCurrentUserQueryKey(), undefined); qc.invalidateQueries({ queryKey: getGetCurrentUserQueryKey() }); } });
  const navLink = (item: typeof navItems[number]) => <Link key={item.href} href={item.href} onClick={() => setMobileOpen(false)} data-testid={`link-nav-${item.label.toLowerCase().replaceAll(' ', '-')}`} className={cx('flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors', location === item.href ? 'bg-primary/[.11] text-primary' : 'text-muted-foreground hover:bg-secondary hover:text-foreground')}><item.icon size={17} strokeWidth={1.8} />{item.label}</Link>;
  return <div className="min-h-[100dvh]">
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-[244px] flex-col border-r border-border bg-[hsl(225_27%_7%/.92)] px-4 py-5 backdrop-blur-xl lg:flex">
      <Link href="/" className="mb-9 flex items-center gap-3 px-2" data-testid="link-brand"><div className="grid h-9 w-9 place-items-center rounded-xl bg-primary text-primary-foreground shadow-[0_0_28px_rgba(74,212,163,.18)]"><Code2 size={20} strokeWidth={2.4} /></div><div><span className="text-[15px] font-extrabold tracking-tight">code<span className="text-primary">master</span></span><p className="mono mt-0.5 text-[9px] uppercase tracking-[.18em] text-muted-foreground">practice with purpose</p></div></Link>
      <p className="mono mb-3 px-3 text-[9px] uppercase tracking-[.2em] text-muted-foreground/70">Workspace</p>
      <nav className="space-y-1">{navItems.map(navLink)}</nav>
      <p className="mono mb-3 mt-8 px-3 text-[9px] uppercase tracking-[.2em] text-muted-foreground/70">Account</p>
      <nav className="space-y-1">
        {user ? <><Link href="/profile" className={cx('flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold', location === '/profile' ? 'bg-primary/[.11] text-primary' : 'text-muted-foreground hover:bg-secondary hover:text-foreground')} data-testid="link-profile"><UserRound size={17} />My profile</Link>{user.role === 'admin' && <><Link href="/admin" className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-muted-foreground hover:bg-secondary hover:text-foreground" data-testid="link-admin"><Shield size={17} />Platform</Link><Link href="/admin/problems" className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-muted-foreground hover:bg-secondary hover:text-foreground" data-testid="link-admin-problems"><Settings2 size={17} />Problem manager</Link></>}</> :
          <><Link href="/login" className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-muted-foreground hover:bg-secondary hover:text-foreground" data-testid="link-login"><UserRound size={17} />Sign in</Link><Link href="/register" className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-muted-foreground hover:bg-secondary hover:text-foreground" data-testid="link-register"><Plus size={17} />Create account</Link></>}
      </nav>
      <div className="mt-auto rounded-2xl border border-primary/15 bg-primary/[.045] p-4">
        <div className="mb-3 flex items-center justify-between"><span className="mono text-[10px] uppercase tracking-[.15em] text-muted-foreground">System pulse</span><span className={cx('h-2 w-2 rounded-full', health.isError ? 'bg-rose-400' : 'bg-primary')} /></div>
        <p className="text-sm font-bold">{health.isError ? 'Reconnecting' : 'All systems ready'}</p><p className="mt-1 text-xs text-muted-foreground">{health.isLoading ? 'Checking services…' : 'Code runner operational'}</p>
      </div>
      {user && <div className="mt-4 flex items-center gap-3 border-t border-border pt-4"><Avatar user={user} size="sm" /><Link href="/profile" className="min-w-0 flex-1" data-testid="link-account-profile"><p className="truncate text-xs font-bold">{user.name}</p><p className="truncate text-[10px] text-muted-foreground">@{user.username}</p></Link><button onClick={doLogout} aria-label="Sign out" className="rounded-lg p-2 text-muted-foreground hover:bg-secondary hover:text-foreground" data-testid="button-logout"><LogOut size={15} /></button></div>}
    </aside>
    <header className="sticky top-0 z-20 border-b border-border bg-[hsl(224_26%_8%/.9)] px-4 py-3 backdrop-blur-xl lg:hidden">
      <div className="flex items-center justify-between"><Link href="/" className="flex items-center gap-2.5" data-testid="link-brand-mobile"><span className="grid h-8 w-8 place-items-center rounded-lg bg-primary text-primary-foreground"><Code2 size={17} /></span><span className="text-sm font-extrabold">code<span className="text-primary">master</span></span></Link><button onClick={() => setMobileOpen(!mobileOpen)} className="rounded-lg border border-border p-2 text-muted-foreground" aria-label="Toggle navigation" data-testid="button-mobile-menu">{mobileOpen ? <X size={18} /> : <Menu size={18} />}</button></div>
      {mobileOpen && <nav className="mt-3 grid grid-cols-2 gap-1">{navItems.map(navLink)}<Link href="/profile" className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm text-muted-foreground" data-testid="link-profile-mobile"><UserRound size={16} />Profile</Link>{user?.role === 'admin' && <Link href="/admin" className="px-3 py-2 text-sm text-muted-foreground" data-testid="link-admin-mobile">Platform admin</Link>}{!user && <><Link href="/login" className="px-3 py-2 text-sm text-muted-foreground" data-testid="link-login-mobile">Sign in</Link><Link href="/register" className="px-3 py-2 text-sm text-muted-foreground" data-testid="link-register-mobile">Register</Link></>}{user && <button onClick={doLogout} className="px-3 py-2 text-left text-sm text-muted-foreground" data-testid="button-logout-mobile">Sign out</button>}</nav>}
    </header>
    <main className="mx-auto max-w-[1440px] px-4 pb-16 pt-7 sm:px-7 lg:ml-[244px] lg:px-10 lg:pt-10">{children}</main>
    <div className="fixed bottom-4 right-4 z-10 hidden items-center gap-2 rounded-full border border-border bg-card/80 px-3 py-2 text-[10px] text-muted-foreground backdrop-blur lg:flex"><Command size={12} /><span className="mono">DAILY PRACTICE / DAILY PROGRESS</span></div>
  </div>;
}

function HomePage() {
  const { data, isLoading, isError, refetch } = useListProblems({ page: 1, limit: 4 });
  const { data: board } = useGetLeaderboard({ page: 1 });
  return <div className="page-enter">
    <section className="grid-texture relative overflow-hidden rounded-[28px] border border-border bg-[linear-gradient(115deg,rgba(23,34,46,.95),rgba(16,23,35,.86))] px-6 py-10 sm:px-10 sm:py-14">
      <div className="pointer-events-none absolute -right-10 top-0 h-72 w-72 rounded-full border border-primary/10 after:absolute after:inset-8 after:rounded-full after:border after:border-primary/10 before:absolute before:inset-16 before:rounded-full before:border before:border-primary/10" />
      <div className="relative max-w-3xl"><p className="mono mb-5 flex items-center gap-2 text-[10px] uppercase tracking-[.22em] text-primary"><span className="h-px w-8 bg-primary" />The deliberate practice space</p><h1 className="max-w-2xl text-4xl font-extrabold leading-[1.07] tracking-[-.045em] sm:text-6xl">Get better at the<br className="hidden sm:block" /> problems that matter<span className="text-primary">.</span></h1><p className="mt-5 max-w-lg text-sm leading-7 text-muted-foreground sm:text-base">A sharper daily practice loop. Choose a challenge, write the solution, and watch your skills compound.</p><div className="mt-8 flex flex-wrap gap-3"><Link href="/problems" className="shine inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-extrabold text-primary-foreground shadow-[0_8px_28px_rgba(74,212,163,.14)]" data-testid="link-start-practicing">Start practicing <ArrowRight size={16} /></Link><Link href="/dashboard" className="inline-flex items-center gap-2 rounded-xl border border-border bg-card/60 px-5 py-3 text-sm font-bold hover:border-primary/40" data-testid="link-view-progress">View your progress <ArrowUpRight size={15} /></Link></div></div>
      <div className="relative mt-10 grid max-w-2xl grid-cols-3 gap-3 sm:mt-12"><div className="rounded-xl border border-border bg-background/60 p-3 sm:p-4"><p className="mono text-[9px] uppercase tracking-wider text-muted-foreground">Curated problems</p><p className="mt-2 text-xl font-extrabold">{isLoading ? '—' : data?.total ?? '—'}</p></div><div className="rounded-xl border border-border bg-background/60 p-3 sm:p-4"><p className="mono text-[9px] uppercase tracking-wider text-muted-foreground">Active solvers</p><p className="mt-2 text-xl font-extrabold">{board?.total ?? '—'}</p></div><div className="rounded-xl border border-border bg-background/60 p-3 sm:p-4"><p className="mono text-[9px] uppercase tracking-wider text-muted-foreground">Your next step</p><p className="mt-2 flex items-center gap-1.5 text-sm font-bold"><Zap size={14} className="text-accent" /> One problem</p></div></div>
    </section>
    <div className="mt-10 grid gap-8 xl:grid-cols-[1.4fr_.8fr]">
      <section><SectionTitle eyebrow="Start here" title="Pick up a challenge" detail="A few well-loved problems to get your momentum going." action={<Link href="/problems" className="text-sm font-bold text-primary hover:text-primary/80" data-testid="link-browse-all">Browse all <ArrowRight className="ml-1 inline" size={14} /></Link>} />
        <DataState loading={isLoading} error={isError} retry={() => refetch()} empty={!isLoading && !isError && !data?.items?.length} emptyTitle="Problem set is quiet">
          <div className="space-y-2">{data?.items?.map((problem) => <ProblemRow key={problem.id} problem={problem} />)}</div>
        </DataState>
      </section>
      <Panel className="grid-texture p-6 sm:p-7"><p className="mono text-[10px] uppercase tracking-[.2em] text-primary">Consistency compounds</p><h2 className="mt-3 max-w-sm text-2xl font-extrabold leading-tight">A small solve today is a bigger leap tomorrow.</h2><div className="my-6 flex items-center gap-4 border-y border-border py-5"><div className="grid h-11 w-11 place-items-center rounded-xl bg-accent/10 text-accent"><Flame size={20} /></div><div><p className="text-sm font-bold">Build your streak</p><p className="mt-1 text-xs text-muted-foreground">Come back daily. Progress likes a rhythm.</p></div></div><div className="flex items-center justify-between text-xs text-muted-foreground"><span>Practice paths</span><span className="mono text-foreground">ARRAYS · GRAPHS · DP</span></div><Link href="/dashboard" className="mt-6 inline-flex items-center gap-2 text-sm font-bold text-primary" data-testid="link-track-growth">Track your growth <ArrowRight size={14} /></Link></Panel>
    </div>
    <section className="mt-12"><SectionTitle eyebrow="Community signal" title="The weekly climb" detail="People showing up, one accepted submission at a time." action={<Link href="/leaderboard" className="text-sm font-bold text-primary" data-testid="link-full-leaderboard">See leaderboard <ArrowRight className="ml-1 inline" size={14} /></Link>} />
      <Panel className="overflow-hidden">{board?.items?.slice(0, 3).map((entry) => <Link href={`/u/${entry.username}`} key={entry.id} className="flex items-center gap-4 border-b border-border px-5 py-4 last:border-0 hover:bg-secondary/40" data-testid={`row-home-leader-${entry.id}`}><span className="mono w-7 text-sm text-muted-foreground">#{entry.rank}</span><Avatar user={entry} size="sm" /><span className="min-w-0 flex-1"><span className="block truncate text-sm font-bold">{entry.name}</span><span className="text-xs text-muted-foreground">@{entry.username}</span></span><span className="mono text-xs text-primary">{entry.solvedCount} solved</span><ChevronRight size={15} className="text-muted-foreground" /></Link>) ?? <p className="p-6 text-sm text-muted-foreground">Leaderboard will appear here once the community is active.</p>}</Panel>
    </section>
  </div>;
}

function ProblemRow({ problem }: { problem: ProblemSummary }) {
  return <Link href={`/problems/${problem.slug}`} className="group flex flex-wrap items-center gap-3 rounded-xl border border-border/80 bg-card/60 px-4 py-4 transition hover:border-primary/30 hover:bg-card sm:flex-nowrap" data-testid={`row-problem-${problem.id}`}>
    <span className={cx('grid h-8 w-8 place-items-center rounded-lg', problem.solved ? 'bg-primary/10 text-primary' : 'bg-secondary text-muted-foreground')}>{problem.solved ? <Check size={15} /> : <Code2 size={15} />}</span>
    <span className="min-w-0 flex-1"><span className="block truncate text-sm font-bold group-hover:text-primary">{problem.title}</span><span className="mt-1 flex flex-wrap gap-1.5">{problem.topics.slice(0, 3).map((topic) => <span key={topic} className="rounded-md bg-secondary px-1.5 py-0.5 text-[10px] text-muted-foreground">{topic}</span>)}</span></span>
    <span className={cx('rounded-lg px-2 py-1 text-[10px] font-bold', difficultyClass(problem.difficulty))}>{problem.difficulty}</span><span className="mono w-[52px] text-right text-[10px] text-muted-foreground">{pct(problem.acceptanceRate)}</span><ChevronRight size={15} className="text-muted-foreground transition group-hover:translate-x-0.5 group-hover:text-primary" />
  </Link>;
}

function ProblemsPage() {
  const [q, setQ] = useState('');
  const [difficulty, setDifficulty] = useState('');
  const [topic, setTopic] = useState('');
  const [page, setPage] = useState(1);
  const params = { ...(q ? { q } : {}), ...(difficulty ? { difficulty: difficulty as 'Easy' | 'Medium' | 'Hard' } : {}), ...(topic ? { topic } : {}), page, limit: 12 };
  const query = useListProblems(params);
  return <div className="page-enter"><SectionTitle eyebrow="Practice library" title="Problems" detail="Find the right challenge. Filter by level, topic, or a title in mind." />
    <Panel className="mb-5 p-4 sm:p-5"><div className="grid gap-3 md:grid-cols-[1fr_180px_180px]"><label className="relative block"><Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" /><input value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} placeholder="Search problems…" className="h-11 w-full rounded-xl border border-input bg-background/70 pl-10 pr-4 text-sm outline-none transition focus:border-primary/60" data-testid="input-problem-search" /></label><select value={difficulty} onChange={(e) => { setDifficulty(e.target.value); setPage(1); }} className="h-11 rounded-xl border border-input bg-background px-3 text-sm outline-none focus:border-primary/60" data-testid="select-difficulty"><option value="">All difficulties</option><option>Easy</option><option>Medium</option><option>Hard</option></select><label className="relative"><ListFilter size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" /><input value={topic} onChange={(e) => { setTopic(e.target.value); setPage(1); }} placeholder="Topic (e.g. Arrays)" className="h-11 w-full rounded-xl border border-input bg-background pl-10 pr-3 text-sm outline-none focus:border-primary/60" data-testid="input-topic-filter" /></label></div><div className="mt-4 flex items-center justify-between border-t border-border pt-3 text-xs text-muted-foreground"><span className="mono">{query.data?.total ?? '—'} challenges in set</span><span className="flex items-center gap-1"><CheckCircle2 size={13} className="text-primary" /> Solved markers are yours</span></div></Panel>
    <DataState loading={query.isLoading} error={query.isError} retry={() => query.refetch()} empty={!query.isLoading && !query.isError && !query.data?.items?.length} emptyTitle="No problems match that search"><div className="space-y-2">{query.data?.items.map((problem) => <ProblemRow key={problem.id} problem={problem} />)}</div></DataState>
    {query.data && query.data.pages > 1 && <div className="mt-5 flex items-center justify-between"><span className="mono text-xs text-muted-foreground">PAGE {query.data.page} / {query.data.pages}</span><div className="flex gap-2"><Button variant="outline" onClick={() => setPage(Math.max(1, page - 1))} disabled={page <= 1} data-testid="button-problems-prev"><ChevronLeft size={15} />Previous</Button><Button variant="outline" onClick={() => setPage(Math.min(query.data!.pages, page + 1))} disabled={page >= query.data.pages} data-testid="button-problems-next">Next<ChevronRight size={15} /></Button></div></div>}
  </div>;
}

function ProblemPage() {
  const { slug = '' } = useParams<{ slug: string }>();
  const session = useGetCurrentUser({ query: { queryKey: getGetCurrentUserQueryKey(), retry: false } });
  const problemQuery = useGetProblem(slug, { query: { enabled: !!slug, queryKey: getGetProblemQueryKey(slug) } });
  const problem = problemQuery.data;
  const [language, setLanguage] = useState('javascript');
  const [code, setCode] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [resultTab, setResultTab] = useState<'result' | 'submission'>('result');
  const [submission, setSubmission] = useState<Submission | null>(null);
  const [error, setError] = useState('');
  const run = useRunCode();
  const submit = useSubmitCode();
  const qc = useQueryClient();
  const lang = (problem?.supportedLanguages.includes(language) ? language : problem?.supportedLanguages[0] || 'javascript') as 'javascript' | 'python' | 'java' | 'cpp';
  const currentCode = code ?? problem?.starterCode[lang] ?? '';
  const changeLang = (next: string) => { setLanguage(next); setCode(problem?.starterCode[next] || ''); };
  const onRun = () => {
    if (!problem || !currentCode.trim()) { setError('Add a solution before running it.'); return; }
    setError(''); setResultTab('result');
    run.mutate({ data: { problemId: problem.id, language: lang, code: currentCode, input } }, { onError: (cause) => setError(apiErrorMessage(cause, 'The code runner could not complete the request.')) });
  };
  const onSubmit = () => {
    if (!problem || !currentCode.trim()) { setError('Add a solution before submitting.'); return; }
    setError(''); setResultTab('submission');
    submit.mutate({ data: { problemId: problem.id, language: lang, code: currentCode } }, { onSuccess: (value) => { setSubmission(value); qc.invalidateQueries({ queryKey: getGetDashboardQueryKey() }); qc.invalidateQueries({ queryKey: getGetLeaderboardQueryKey() }); qc.invalidateQueries({ queryKey: getListProblemsQueryKey() }); qc.invalidateQueries({ queryKey: getListSubmissionsQueryKey() }); }, onError: (cause) => setError(apiErrorMessage(cause, 'Sign in before submitting a solution.')) });
  };
  if (problemQuery.isLoading) return <Loading rows={7} />;
  if (problemQuery.isError || !problem) return <DataState loading={false} error retry={() => problemQuery.refetch()} />;
  return <div className="page-enter">
    <div className="mb-5 flex flex-wrap items-center justify-between gap-3"><Link href="/problems" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary" data-testid="link-back-problems"><ChevronLeft size={16} /> Problem set</Link><span className="mono text-[10px] uppercase tracking-widest text-muted-foreground">CHALLENGE / {problem.id.toString().padStart(3, '0')}</span></div>
    <div className="grid gap-5 xl:grid-cols-[minmax(340px,.85fr)_minmax(460px,1.15fr)]">
      <div className="space-y-4">
        <Panel className="p-5 sm:p-7"><div className="flex flex-wrap items-center gap-3"><h1 className="text-2xl font-extrabold tracking-tight">{problem.title}</h1><span className={cx('rounded-lg px-2.5 py-1 text-[10px] font-bold', difficultyClass(problem.difficulty))}>{problem.difficulty}</span>{problem.solved && <span className="inline-flex items-center gap-1 text-xs font-bold text-primary"><CheckCircle2 size={14} /> Solved</span>}</div><div className="mt-4 flex flex-wrap gap-2">{problem.topics.map((t) => <span key={t} className="rounded-lg border border-border bg-secondary/60 px-2.5 py-1 text-xs text-muted-foreground">{t}</span>)}</div><div className="mt-6 grid grid-cols-2 gap-3"><div className="rounded-xl bg-background/60 p-3"><p className="mono text-[9px] uppercase tracking-wider text-muted-foreground">Acceptance</p><p className="mt-1 text-lg font-bold">{pct(problem.acceptanceRate)}</p></div><div className="rounded-xl bg-background/60 p-3"><p className="mono text-[9px] uppercase tracking-wider text-muted-foreground">Submissions</p><p className="mt-1 text-lg font-bold">{problem.totalSubmissions.toLocaleString()}</p></div></div><div className="prose prose-invert prose-sm mt-6 max-w-none prose-p:text-muted-foreground prose-li:text-muted-foreground prose-strong:text-foreground"><p className="whitespace-pre-wrap leading-7">{problem.description}</p></div></Panel>
        {problem.examples.map((example, i) => <Panel key={i} className="p-5"><h2 className="mb-4 text-sm font-bold">Example {i + 1}</h2><div className="grid grid-cols-[60px_1fr] gap-y-3 text-xs"><span className="text-muted-foreground">Input</span><code className="mono break-all text-primary">{example.input}</code><span className="text-muted-foreground">Output</span><code className="mono break-all text-primary">{example.output}</code>{example.explanation && <><span className="text-muted-foreground">Note</span><span className="text-muted-foreground">{example.explanation}</span></>}</div></Panel>)}
        <Panel className="p-5"><h2 className="mb-3 text-sm font-bold">Constraints</h2><ul className="space-y-2">{problem.constraints.map((item, i) => <li key={i} className="mono text-xs leading-5 text-muted-foreground">{item}</li>)}</ul></Panel>
      </div>
      <Panel className="flex min-h-[650px] flex-col overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3"><div className="flex items-center gap-2"><Terminal size={15} className="text-primary" /><span className="text-xs font-bold">Solution workspace</span><span className="mono text-[9px] text-muted-foreground">DRAFT</span></div><select value={lang} onChange={(e) => changeLang(e.target.value)} className="rounded-lg border border-input bg-background px-3 py-2 text-xs outline-none" data-testid="select-language">{problem.supportedLanguages.map((languageName) => <option key={languageName} value={languageName}>{languageName}</option>)}</select></div>
         <div className="flex flex-1 flex-col bg-[#0c111b]"><div className="flex items-center gap-3 border-b border-border/70 px-4 py-2.5"><span className="h-2 w-2 rounded-full bg-rose-400/80" /><span className="h-2 w-2 rounded-full bg-amber-300/80" /><span className="h-2 w-2 rounded-full bg-primary/80" /><span className="mono ml-2 text-[10px] text-muted-foreground">solution.{lang === 'python' ? 'py' : lang === 'java' ? 'java' : lang === 'cpp' ? 'cpp' : 'js'}</span><span className="ml-auto mono text-[9px] text-muted-foreground">UTF-8 · LF</span></div><div className="min-h-[390px] flex-1" data-testid="input-code-editor"><Editor height="390px" language={lang === 'cpp' ? 'cpp' : lang} value={currentCode} onChange={(value) => setCode(value ?? '')} theme="vs-dark" options={{ minimap: { enabled: false }, fontSize: 13, lineNumbers: 'on', scrollBeyondLastLine: false, automaticLayout: true, tabSize: 2, wordWrap: 'on', padding: { top: 14, bottom: 14 } }} /></div></div>
        <div className="border-t border-border p-4"><div className="mb-3 flex items-center justify-between"><span className="text-xs font-bold">Test input</span><button onClick={() => setInput(problem.examples[0]?.input || '')} className="text-[10px] font-bold text-primary hover:underline" data-testid="button-load-example">Load sample</button></div><textarea value={input} onChange={(e) => setInput(e.target.value)} placeholder="Optional custom input…" className="mono min-h-16 w-full resize-y rounded-xl border border-input bg-background/70 p-3 text-xs outline-none focus:border-primary/50" data-testid="input-custom-test" />
          {error && <p className="mt-2 text-xs text-rose-300" data-testid="status-code-error">{error}</p>}
          <div className="mt-3 flex flex-wrap items-center gap-2"><Button variant="outline" onClick={onRun} disabled={run.isPending || submit.isPending} data-testid="button-run-code">{run.isPending ? <LoaderCircle className="animate-spin" size={15} /> : <Play size={14} />} Run code</Button><Button onClick={onSubmit} disabled={run.isPending || submit.isPending || !session.data} data-testid="button-submit-code">{submit.isPending ? <LoaderCircle className="animate-spin" size={15} /> : <Zap size={14} />} Submit solution</Button>{!session.data && <Link href="/login" className="text-xs font-semibold text-primary hover:underline" data-testid="link-submit-sign-in">Sign in to submit</Link>}</div>
        </div>
        <div className="border-t border-border bg-background/50"><div className="flex border-b border-border"><button onClick={() => setResultTab('result')} className={cx('px-4 py-3 text-xs font-bold', resultTab === 'result' ? 'border-b-2 border-primary text-primary' : 'text-muted-foreground')} data-testid="tab-run-result">Run result</button><button onClick={() => setResultTab('submission')} className={cx('px-4 py-3 text-xs font-bold', resultTab === 'submission' ? 'border-b-2 border-primary text-primary' : 'text-muted-foreground')} data-testid="tab-submission-result">Submission</button></div><div className="min-h-[100px] p-4 text-xs">
          {resultTab === 'result' && (run.data ? <><div className="mb-2 flex items-center gap-2"><span className={cx('h-2 w-2 rounded-full', run.data.status.toLowerCase().includes('accept') ? 'bg-primary' : 'bg-rose-400')} /><span className="font-bold">{run.data.status}</span>{run.data.runtime != null && <span className="mono ml-auto text-muted-foreground">{run.data.runtime} ms</span>}</div><pre className="mono whitespace-pre-wrap text-muted-foreground">{run.data.error || run.data.output || 'No output returned.'}</pre></> : <p className="text-muted-foreground">Run your code to inspect output and runtime.</p>)}
          {resultTab === 'submission' && (submission ? <><div className="flex items-center gap-2 font-bold"><CheckCircle2 size={15} className={submission.status === 'Accepted' ? 'text-primary' : 'text-rose-300'} />{submission.status}<span className="mono ml-auto text-muted-foreground">{submission.testCasesPassed}/{submission.totalTestCases} tests</span></div>{submission.errorMessage && <p className="mt-2 text-rose-300">{submission.errorMessage}</p>}</> : <p className="text-muted-foreground">{submit.isPending ? 'Evaluating submission…' : 'Submit your solution to run all test cases.'}</p>)}
        </div></div>
      </Panel>
    </div>
  </div>;
}

function DashboardPage() {
  const query = useGetDashboard();
  const submissions = useListSubmissions({ page: 1 });
  const data = query.data ? { ...query.data, recentSubmissions: query.data.recentSubmissions.length ? query.data.recentSubmissions : submissions.data?.items || [] } : undefined;
  const maxActivity = Math.max(1, ...(data?.activity || []).map((point) => point.count));
  return <div className="page-enter"><SectionTitle eyebrow="Personal analytics" title="Your progress" detail="A clear read on how your practice is adding up." action={<Link href="/problems" className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground" data-testid="link-dashboard-practice">Practice now <ArrowRight size={15} /></Link>} />
    <DataState loading={query.isLoading} error={query.isError} retry={() => query.refetch()} empty={!query.isLoading && !query.isError && data?.totalSubmissions === 0} emptyTitle="Your first solve starts here">
      {data && <DashboardContent data={data} maxActivity={maxActivity} />}
    </DataState>
  </div>;
}

function DashboardContent({ data, maxActivity }: { data: Dashboard; maxActivity: number }) {
  const cards = [
    { label: 'Solved', value: data.totalSolved, hint: 'problems completed', icon: CheckCircle2, color: 'text-primary' },
    { label: 'Current streak', value: data.currentStreak, hint: 'days in a row', icon: Flame, color: 'text-accent' },
    { label: 'Acceptance rate', value: pct(data.acceptanceRate), hint: `${data.acceptedSubmissions} accepted`, icon: Gauge, color: 'text-sky-300' },
    { label: 'Submissions', value: data.totalSubmissions, hint: 'attempts made', icon: Activity, color: 'text-violet-300' },
  ];
  return <><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{cards.map(({ label, value, hint, icon: Icon, color }) => <Panel key={label} className="p-5"><div className="flex items-center justify-between"><span className="text-xs text-muted-foreground">{label}</span><Icon size={16} className={color} /></div><p className="mt-4 text-3xl font-extrabold tracking-tight" data-testid={`metric-${label.toLowerCase().replaceAll(' ', '-')}`}>{value}</p><p className="mt-1 text-[11px] text-muted-foreground">{hint}</p></Panel>)}</div>
    <div className="mt-6 grid gap-5 xl:grid-cols-[1.4fr_.8fr]"><Panel className="p-5 sm:p-6"><div className="mb-5 flex items-center justify-between"><div><p className="text-sm font-bold">Practice activity</p><p className="mt-1 text-xs text-muted-foreground">Each mark is a submission day.</p></div><span className="mono text-[10px] text-muted-foreground">RECENT WEEKS</span></div><div className="flex min-h-[114px] items-end gap-1.5 overflow-x-auto pb-1">{data.activity.map((point, i) => <div key={point.date} className="group flex min-w-[13px] flex-1 flex-col items-center gap-1.5" title={`${point.count} submissions · ${dateLabel(point.date)}`} data-testid={`activity-day-${i}`}><div className="w-full min-w-[9px] rounded-sm bg-primary transition-opacity" style={{ height: `${Math.max(7, (point.count / maxActivity) * 72)}px`, opacity: point.count ? .25 + point.count / maxActivity * .75 : .09 }} /><span className="mono hidden text-[8px] text-muted-foreground group-hover:block">{new Date(point.date).getDate()}</span></div>)}</div><div className="mt-3 flex justify-between border-t border-border pt-3 text-[10px] text-muted-foreground"><span>Less</span><span className="flex items-center gap-1">{[.1, .34, .62, 1].map((op) => <i key={op} className="h-2.5 w-2.5 rounded-sm bg-primary" style={{ opacity: op }} />)}</span><span>More</span></div></Panel>
      <Panel className="p-5 sm:p-6"><p className="text-sm font-bold">Difficulty mix</p><p className="mt-1 text-xs text-muted-foreground">Solved problems by level.</p><div className="mt-5 space-y-4">{[{ label: 'Easy', count: data.easySolved, color: 'bg-emerald-300' }, { label: 'Medium', count: data.mediumSolved, color: 'bg-amber-200' }, { label: 'Hard', count: data.hardSolved, color: 'bg-rose-300' }].map((item) => <div key={item.label}><div className="mb-2 flex justify-between text-xs"><span>{item.label}</span><span className="mono text-muted-foreground">{item.count}</span></div><div className="h-1.5 overflow-hidden rounded-full bg-secondary"><div className={cx('h-full rounded-full', item.color)} style={{ width: `${data.totalSolved ? item.count / data.totalSolved * 100 : 0}%` }} /></div></div>)}</div></Panel></div>
    <div className="mt-5 grid gap-5 xl:grid-cols-[.8fr_1.2fr]"><Panel className="p-5 sm:p-6"><div className="mb-5 flex items-center justify-between"><div><p className="text-sm font-bold">Topic mastery</p><p className="mt-1 text-xs text-muted-foreground">Keep spreading your range.</p></div><BookOpen size={16} className="text-primary" /></div>{data.topicProgress.length ? <div className="space-y-4">{data.topicProgress.slice(0, 7).map((item) => <div key={item.topic}><div className="mb-1.5 flex justify-between text-xs"><span>{item.topic}</span><span className="mono text-muted-foreground">{item.solved}/{item.total}</span></div><div className="h-1.5 rounded-full bg-secondary"><div className="h-full rounded-full bg-primary/80" style={{ width: `${item.total ? item.solved / item.total * 100 : 0}%` }} /></div></div>)}</div> : <p className="text-sm text-muted-foreground">Solve problems to reveal topic strengths.</p>}</Panel><RecentSubmissions items={data.recentSubmissions} /></div>
  </>;
}

function RecentSubmissions({ items, interactive = true }: { items: SubmissionSummary[]; interactive?: boolean }) {
  const [selected, setSelected] = useState<number | null>(null);
  return <Panel className="overflow-hidden"><div className="flex items-center justify-between border-b border-border px-5 py-4"><div><p className="text-sm font-bold">Recent submissions</p><p className="mt-1 text-xs text-muted-foreground">Latest attempts, all in one place.</p></div><Terminal size={16} className="text-primary" /></div>
    {!items.length ? <p className="p-5 text-sm text-muted-foreground">No submissions yet.</p> : items.slice(0, 6).map((item) => {
      const content = <><span className={cx('h-2 w-2 rounded-full', item.status === 'Accepted' ? 'bg-primary' : 'bg-rose-300')} /><span className="min-w-0 flex-1"><span className="block truncate text-xs font-bold">{item.problemTitle}</span><span className="mono text-[9px] text-muted-foreground">{item.language} · {dateLabel(item.submittedAt)}</span></span><span className={cx('text-[10px] font-bold', item.status === 'Accepted' ? 'text-primary' : 'text-rose-300')}>{item.status}</span></>;
      return interactive
        ? <button key={item.id} onClick={() => setSelected(item.id)} className="flex w-full items-center gap-3 border-b border-border/70 px-5 py-3 text-left last:border-0 hover:bg-secondary/40" data-testid={`button-submission-${item.id}`}>{content}</button>
        : <div key={item.id} className="flex w-full items-center gap-3 border-b border-border/70 px-5 py-3 text-left last:border-0" data-testid={`row-public-submission-${item.id}`}>{content}</div>;
    })}
    {interactive && selected !== null && <SubmissionDialog id={selected} onClose={() => setSelected(null)} />}
  </Panel>;
}

function SubmissionDialog({ id, onClose }: { id: number; onClose: () => void }) {
  const query = useGetSubmission(id, { query: { enabled: id > 0, queryKey: getGetSubmissionQueryKey(id) } });
  return <div className="fixed inset-0 z-50 grid place-items-center bg-background/80 p-4 backdrop-blur-sm" role="dialog" aria-modal="true"><Panel className="max-h-[85vh] w-full max-w-2xl overflow-auto p-5"><div className="mb-4 flex items-center justify-between"><h2 className="text-lg font-bold">Submission detail</h2><button onClick={onClose} className="rounded-lg p-2 hover:bg-secondary" aria-label="Close" data-testid="button-close-submission"><X size={17} /></button></div>{query.isLoading ? <Loading rows={3} /> : query.isError ? <DataState loading={false} error retry={() => query.refetch()} /> : query.data && <><p className="mb-3 text-sm font-bold">{query.data.problemTitle} <span className="ml-2 text-xs text-primary">{query.data.status}</span></p><pre className="mono max-h-[50vh] overflow-auto rounded-xl bg-[#0c111b] p-4 text-xs leading-6 text-[#c5d3e3]">{query.data.code}</pre><p className="mt-3 text-xs text-muted-foreground">{query.data.testCasesPassed}/{query.data.totalTestCases} test cases · {query.data.runtime ?? '—'} ms</p></>}</Panel></div>;
}

function AuthPage({ mode }: { mode: 'login' | 'register' }) {
  const loginMode = mode === 'login';
  const [, setLocation] = useLocation();
  const [fields, setFields] = useState({ email: '', password: '', username: '', name: '' });
  const [error, setError] = useState('');
  const qc = useQueryClient();
  const login = useLogin();
  const register = useRegister();
  const mutation = loginMode ? login : register;
  const update = (key: keyof typeof fields) => (e: ChangeEvent<HTMLInputElement>) => setFields({ ...fields, [key]: e.target.value });
  const submit = (event: FormEvent) => {
    event.preventDefault(); setError('');
    if (loginMode) login.mutate({ data: { email: fields.email, password: fields.password } }, { onSuccess: () => { qc.invalidateQueries({ queryKey: getGetCurrentUserQueryKey() }); setLocation('/dashboard'); }, onError: (cause) => setError(apiErrorMessage(cause, 'Sign in could not be completed.')) });
    else register.mutate({ data: { username: fields.username, name: fields.name, email: fields.email, password: fields.password } }, { onSuccess: () => { qc.invalidateQueries({ queryKey: getGetCurrentUserQueryKey() }); setLocation('/dashboard'); }, onError: (cause) => setError(apiErrorMessage(cause, 'Account could not be created.')) });
  };
  return <div className="page-enter mx-auto grid max-w-5xl overflow-hidden rounded-[28px] border border-border bg-card lg:grid-cols-[.9fr_1.1fr]">
    <div className="grid-texture relative hidden min-h-[600px] flex-col justify-between bg-primary/[.045] p-10 lg:flex"><div><Link href="/" className="flex items-center gap-3" data-testid="link-auth-brand"><span className="grid h-10 w-10 place-items-center rounded-xl bg-primary text-primary-foreground"><Code2 size={20} /></span><b>code<span className="text-primary">master</span></b></Link><p className="mono mt-16 text-[10px] uppercase tracking-[.2em] text-primary">{loginMode ? 'Welcome back' : 'Start with a clean slate'}</p><h1 className="mt-4 max-w-sm text-4xl font-extrabold leading-tight tracking-[-.04em]">{loginMode ? 'Your next breakthrough is one solve away.' : 'Build a practice habit that actually sticks.'}</h1><p className="mt-4 max-w-sm text-sm leading-7 text-muted-foreground">{loginMode ? 'Pick up your rhythm, keep your streak alive, and make the hard problems feel familiar.' : 'Join a focused community where each submission becomes a little more confidence.'}</p></div><div className="flex items-center gap-3 border-t border-border pt-5 text-xs text-muted-foreground"><Sparkles size={15} className="text-accent" /> A quieter space to get seriously good.</div></div>
    <div className="p-6 sm:p-10 lg:p-12"><div className="mb-9 lg:hidden"><Link href="/" className="flex items-center gap-2.5" data-testid="link-auth-brand-mobile"><span className="grid h-8 w-8 place-items-center rounded-lg bg-primary text-primary-foreground"><Code2 size={17} /></span><b>code<span className="text-primary">master</span></b></Link></div><p className="mono text-[10px] uppercase tracking-[.2em] text-primary">{loginMode ? 'Continue your progress' : 'Join the practice room'}</p><h2 className="mt-3 text-3xl font-extrabold tracking-tight">{loginMode ? 'Sign in' : 'Create your account'}</h2><p className="mt-2 text-sm text-muted-foreground">{loginMode ? 'Good to have you back.' : 'Your next practice session starts here.'}</p>
      <form onSubmit={submit} className="mt-8 space-y-4">
        {!loginMode && <><Field label="Your name"><input required maxLength={80} value={fields.name} onChange={update('name')} placeholder="Ada Lovelace" className="field" data-testid="input-name" /></Field><Field label="Username"><input required minLength={3} maxLength={24} pattern="[a-zA-Z0-9_]+" value={fields.username} onChange={update('username')} placeholder="ada_codes" className="field" data-testid="input-username" /></Field></>}
        <Field label="Email"><input required type="email" value={fields.email} onChange={update('email')} placeholder="you@example.com" className="field" data-testid="input-email" /></Field><Field label="Password"><input required minLength={8} type="password" value={fields.password} onChange={update('password')} placeholder="At least 8 characters" className="field" data-testid="input-password" /></Field>
        {error && <p className="rounded-xl border border-rose-300/20 bg-rose-300/[.06] p-3 text-xs text-rose-200" data-testid="status-auth-error">{error}</p>}
        <Button type="submit" className="mt-2 w-full py-3" disabled={mutation.isPending} data-testid="button-auth-submit">{mutation.isPending ? <LoaderCircle size={16} className="animate-spin" /> : loginMode ? 'Sign in to CodeMaster' : 'Create account'}<ArrowRight size={15} /></Button>
      </form>
      <p className="mt-6 text-center text-sm text-muted-foreground">{loginMode ? 'New to CodeMaster?' : 'Already have an account?'} <Link href={loginMode ? '/register' : '/login'} className="font-bold text-primary hover:underline" data-testid="link-auth-switch">{loginMode ? 'Create an account' : 'Sign in'}</Link></p>
      <p className="mt-8 border-t border-border pt-5 text-center text-[10px] leading-5 text-muted-foreground">By continuing, you agree to keep showing up for yourself.</p>
    </div>
  </div>;
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="block"><span className="mb-2 block text-xs font-bold">{label}</span>{children}</label>;
}

function ProfilePage() {
  const query = useGetMyProfile();
  const [form, setForm] = useState<{ name: string; username: string; avatar: string | null } | null>(null);
  const [notice, setNotice] = useState('');
  const update = useUpdateMyProfile();
  const qc = useQueryClient();
  const profile = query.data;
  const submit = (e: FormEvent) => { e.preventDefault(); if (!form) return; update.mutate({ data: form }, { onSuccess: (value) => { setNotice('Profile saved.'); setForm({ name: value.name, username: value.username, avatar: value.avatar }); qc.invalidateQueries({ queryKey: getGetMyProfileQueryKey() }); qc.invalidateQueries({ queryKey: getGetCurrentUserQueryKey() }); }, onError: (cause) => setNotice(apiErrorMessage(cause, 'Could not save profile.')) }); };
  if (query.isLoading) return <Loading rows={5} />;
  if (query.isError || !profile) return <DataState loading={false} error retry={() => query.refetch()} />;
  const values = form || { name: profile.name, username: profile.username, avatar: profile.avatar };
  return <div className="page-enter"><SectionTitle eyebrow="Your identity" title="Profile" detail="A little context for the people practicing alongside you." />
    <div className="grid gap-5 xl:grid-cols-[.75fr_1.25fr]"><Panel className="grid-texture p-6 sm:p-8"><div className="flex items-center gap-4"><Avatar user={profile} size="lg" /><div><h2 className="text-xl font-extrabold">{profile.name}</h2><p className="mt-1 text-sm text-muted-foreground">@{profile.username}</p></div></div><div className="mt-8 grid grid-cols-2 gap-3">{[{ title: 'Problems solved', value: profile.solvedCount }, { title: 'Current streak', value: `${profile.currentStreak} days` }, { title: 'Submissions', value: profile.totalSubmissions }, { title: 'Acceptance', value: pct(profile.acceptanceRate) }].map((metric) => <div key={metric.title} className="rounded-xl border border-border bg-background/50 p-4"><p className="text-[10px] text-muted-foreground">{metric.title}</p><p className="mt-2 text-xl font-extrabold">{metric.value}</p></div>)}</div><p className="mono mt-6 text-[10px] text-muted-foreground">MEMBER SINCE {dateLabel(profile.joinedAt).toUpperCase()}</p><Link href={`/u/${profile.username}`} className="mt-5 inline-flex items-center gap-2 text-xs font-bold text-primary" data-testid="link-public-profile">View public profile <Globe2 size={14} /></Link></Panel>
      <Panel className="p-6 sm:p-8"><div className="mb-6"><p className="text-lg font-bold">Profile details</p><p className="mt-1 text-sm text-muted-foreground">Keep your public practice identity current.</p></div><form onSubmit={submit} className="space-y-5"><Field label="Display name"><input className="field" required maxLength={80} value={values.name} onChange={(e) => setForm({ ...values, name: e.target.value })} data-testid="input-profile-name" /></Field><Field label="Username"><div className="relative"><span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">@</span><input className="field pl-8" required minLength={3} maxLength={24} pattern="[a-zA-Z0-9_]+" value={values.username} onChange={(e) => setForm({ ...values, username: e.target.value })} data-testid="input-profile-username" /></div></Field><Field label="Avatar URL"><input className="field" type="url" value={values.avatar || ''} onChange={(e) => setForm({ ...values, avatar: e.target.value || null })} placeholder="https://…" data-testid="input-profile-avatar" /></Field>
        {notice && <p className={cx('text-xs', notice.includes('Could not') ? 'text-rose-300' : 'text-primary')} data-testid="status-profile">{notice}</p>}<Button type="submit" disabled={update.isPending} data-testid="button-save-profile">{update.isPending ? <LoaderCircle size={15} className="animate-spin" /> : <Check size={15} />}Save changes</Button>
      </form></Panel></div>
    <div className="mt-6"><RecentSubmissions items={profile.recentSubmissions} /></div>
  </div>;
}

function PublicProfilePage() {
  const { username = '' } = useParams<{ username: string }>();
  const query = useGetPublicProfile(username, { query: { enabled: !!username, queryKey: getGetPublicProfileQueryKey(username) } });
  if (query.isLoading) return <Loading rows={6} />;
  if (query.isError || !query.data) return <DataState loading={false} error retry={() => query.refetch()} />;
  const p = query.data;
  return <div className="page-enter"><div className="grid-texture mb-6 flex flex-wrap items-center gap-5 rounded-2xl border border-border bg-card p-6 sm:p-8"><Avatar user={p} size="lg" /><div className="min-w-[180px] flex-1"><p className="mono text-[10px] uppercase tracking-[.2em] text-primary">Community profile</p><h1 className="mt-2 text-2xl font-extrabold">{p.name}</h1><p className="mt-1 text-sm text-muted-foreground">@{p.username} · Joined {dateLabel(p.joinedAt)}</p></div><div className="flex gap-7"><div><p className="mono text-2xl font-bold">{p.solvedCount}</p><p className="text-[10px] text-muted-foreground">solved</p></div><div><p className="mono text-2xl font-bold">{p.currentStreak}</p><p className="text-[10px] text-muted-foreground">day streak</p></div></div></div>
    <div className="grid gap-4 sm:grid-cols-3"><Panel className="p-5"><p className="text-xs text-muted-foreground">Accepted submissions</p><p className="mt-2 text-2xl font-extrabold">{p.acceptedSubmissions}</p></Panel><Panel className="p-5"><p className="text-xs text-muted-foreground">All submissions</p><p className="mt-2 text-2xl font-extrabold">{p.totalSubmissions}</p></Panel><Panel className="p-5"><p className="text-xs text-muted-foreground">Acceptance rate</p><p className="mt-2 text-2xl font-extrabold">{pct(p.acceptanceRate)}</p></Panel></div>
    <div className="mt-6"><RecentSubmissions items={p.recentSubmissions} interactive={false} /></div>
  </div>;
}

function LeaderboardPage() {
  const [page, setPage] = useState(1);
  const query = useGetLeaderboard({ page });
  const rows = query.data?.items || [];
  return <div className="page-enter"><SectionTitle eyebrow="Community" title="Leaderboard" detail="A snapshot of practice over time. Keep your own pace; the work adds up." action={<div className="flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 text-xs text-muted-foreground"><Trophy size={14} className="text-accent" />Lifetime problems solved</div>} />
    <Panel className="overflow-hidden"><div className="grid grid-cols-[48px_1fr_76px_72px] gap-2 border-b border-border bg-background/50 px-4 py-3 text-[9px] uppercase tracking-widest text-muted-foreground sm:grid-cols-[65px_1fr_105px_100px_100px]"><span>Rank</span><span>Solver</span><span className="text-right">Solved</span><span className="hidden text-right sm:block">Streak</span><span className="text-right">Acceptance</span></div>
      <DataState loading={query.isLoading} error={query.isError} retry={() => query.refetch()} empty={!query.isLoading && !query.isError && !rows.length} emptyTitle="No rankings just yet"><div>{rows.map((entry) => <Link href={`/u/${entry.username}`} key={entry.id} className="grid grid-cols-[48px_1fr_76px_72px] items-center gap-2 border-b border-border/70 px-4 py-4 transition last:border-0 hover:bg-secondary/40 sm:grid-cols-[65px_1fr_105px_100px_100px]" data-testid={`row-leaderboard-${entry.id}`}><span className={cx('mono text-sm font-bold', entry.rank <= 3 ? 'text-accent' : 'text-muted-foreground')}>{String(entry.rank).padStart(2, '0')}</span><span className="flex min-w-0 items-center gap-3"><Avatar user={entry} size="sm" /><span className="min-w-0"><span className="block truncate text-sm font-bold">{entry.name}</span><span className="block truncate text-[10px] text-muted-foreground">@{entry.username}</span></span></span><span className="mono text-right text-sm font-bold">{entry.solvedCount}</span><span className="hidden items-center justify-end gap-1 text-xs text-accent sm:flex"><Flame size={12} />{entry.currentStreak}</span><span className="mono text-right text-xs text-muted-foreground">{pct(entry.acceptanceRate)}</span></Link>)}</div></DataState>
    </Panel>{query.data && query.data.pages > 1 && <div className="mt-5 flex items-center justify-between"><span className="mono text-xs text-muted-foreground">{query.data.total} SOLVERS</span><div className="flex gap-2"><Button variant="outline" onClick={() => setPage(Math.max(1, page - 1))} disabled={page <= 1} data-testid="button-leader-prev"><ChevronLeft size={15} />Previous</Button><Button variant="outline" onClick={() => setPage(Math.min(query.data!.pages, page + 1))} disabled={page >= query.data.pages} data-testid="button-leader-next">Next<ChevronRight size={15} /></Button></div></div>}
  </div>;
}

function AdminPage() {
  const query = useGetAdminStats();
  const stats = query.data;
  return <div className="page-enter"><SectionTitle eyebrow="Platform operations" title="Admin overview" detail="A live view across CodeMaster's practice ecosystem." action={<Link href="/admin/problems" className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground" data-testid="link-admin-manage">Manage problems <ArrowRight size={15} /></Link>} />
    <DataState loading={query.isLoading} error={query.isError} retry={() => query.refetch()}>
      {stats && <><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{[{ label: 'Members', value: stats.users, icon: Users }, { label: 'Problems', value: stats.problems, icon: Code2 }, { label: 'Submissions', value: stats.submissions, icon: Activity }, { label: 'Acceptance', value: pct(stats.acceptanceRate), icon: Gauge }].map(({ label, value, icon: Icon }) => <Panel className="p-5" key={label}><div className="flex justify-between"><p className="text-xs text-muted-foreground">{label}</p><Icon size={16} className="text-primary" /></div><p className="mt-4 text-3xl font-extrabold">{value}</p></Panel>)}</div><div className="mt-6 grid gap-5 lg:grid-cols-[1.2fr_.8fr]"><Panel className="grid-texture p-7"><p className="mono text-[10px] uppercase tracking-[.2em] text-primary">Platform pulse</p><h2 className="mt-3 text-2xl font-extrabold">Practice is moving.</h2><p className="mt-2 max-w-lg text-sm leading-6 text-muted-foreground">Monitor member growth, challenge coverage, and accepted solutions as the community finds its rhythm.</p><div className="mt-7 h-2 overflow-hidden rounded-full bg-secondary"><div className="h-full rounded-full bg-primary" style={{ width: `${stats.submissions ? stats.acceptedSubmissions / stats.submissions * 100 : 0}%` }} /></div><div className="mt-2 flex justify-between text-xs text-muted-foreground"><span>{stats.acceptedSubmissions.toLocaleString()} accepted</span><span>{pct(stats.acceptanceRate)} platform-wide</span></div></Panel><Panel className="p-6"><p className="text-sm font-bold">Quick routes</p><div className="mt-4 space-y-2"><Link href="/admin/problems" className="flex items-center justify-between rounded-xl border border-border p-4 text-sm hover:border-primary/40" data-testid="link-admin-problems-card"><span className="flex items-center gap-3"><Settings2 size={16} className="text-primary" />Problem catalog</span><ArrowRight size={15} /></Link><Link href="/leaderboard" className="flex items-center justify-between rounded-xl border border-border p-4 text-sm hover:border-primary/40" data-testid="link-admin-leaderboard"><span className="flex items-center gap-3"><Trophy size={16} className="text-accent" />Community rankings</span><ArrowRight size={15} /></Link></div></Panel></div></>}
    </DataState></div>;
}

function blankWrite(): ProblemWriteInput {
  return { title: '', description: '', difficulty: 'Easy', topics: ['Arrays'], constraints: [''], examples: [{ input: '', output: '', explanation: null }], starterCode: { javascript: '' }, supportedLanguages: ['javascript'], testCases: [{ input: '', output: '' }], hiddenTestCases: [{ input: '', output: '' }], active: true };
}
function writeFromProblem(problem: AdminProblem): ProblemWriteInput {
  return { title: problem.title, description: problem.description, difficulty: problem.difficulty, topics: problem.topics, constraints: problem.constraints, examples: problem.examples, starterCode: problem.starterCode, supportedLanguages: problem.supportedLanguages as ProblemWriteInput['supportedLanguages'], testCases: problem.testCases, hiddenTestCases: problem.hiddenTestCases, active: problem.active };
}

function AdminProblemsPage() {
  const [search, setSearch] = useState('');
  const query = useListAdminProblems(search ? { q: search } : undefined);
  const [edit, setEdit] = useState<AdminProblem | null | 'new'>(null);
  const [json, setJson] = useState('');
  const [error, setError] = useState('');
  const qc = useQueryClient();
  const create = useCreateProblem();
  const update = useUpdateProblem();
  const remove = useDeleteProblem();
  const active = useSetProblemActive();
  const invalidate = () => { qc.invalidateQueries({ queryKey: getListAdminProblemsQueryKey() }); qc.invalidateQueries({ queryKey: getGetAdminStatsQueryKey() }); qc.invalidateQueries({ queryKey: getListProblemsQueryKey() }); };
  const openEditor = (problem: AdminProblem | null) => { setEdit(problem || 'new'); setJson(JSON.stringify(problem ? writeFromProblem(problem) : blankWrite(), null, 2)); setError(''); };
  const save = (e: FormEvent) => { e.preventDefault(); try { const data = JSON.parse(json) as ProblemWriteInput; if (!data.title?.trim() || !data.description?.trim() || !data.topics?.length || !data.supportedLanguages?.length) throw new Error('Add a title, description, topic, and at least one language.'); const done = () => { setEdit(null); invalidate(); }; if (edit === 'new') create.mutate({ data }, { onSuccess: done, onError: (err) => setError((err as Error).message) }); else if (edit) update.mutate({ id: edit.id, data }, { onSuccess: done, onError: (err) => setError((err as Error).message) }); } catch (err) { setError((err as Error).message || 'Problem JSON is invalid.'); } };
  const busy = create.isPending || update.isPending;
  return <div className="page-enter"><SectionTitle eyebrow="Content operations" title="Problem manager" detail="Create and maintain the practice catalog." action={<Button onClick={() => openEditor(null)} data-testid="button-create-problem"><Plus size={15} />New problem</Button>} />
    <Panel className="mb-5 p-4"><label className="relative block max-w-lg"><Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search all problems…" className="h-11 w-full rounded-xl border border-input bg-background pl-10 pr-4 text-sm outline-none focus:border-primary/60" data-testid="input-admin-search" /></label></Panel>
    <Panel className="overflow-hidden"><DataState loading={query.isLoading} error={query.isError} retry={() => query.refetch()} empty={!query.isLoading && !query.isError && !query.data?.length} emptyTitle="No problems found"><div>{query.data?.map((problem) => <div key={problem.id} className="flex flex-wrap items-center gap-3 border-b border-border px-4 py-4 last:border-0 sm:px-5" data-testid={`row-admin-problem-${problem.id}`}><div className={cx('h-2 w-2 rounded-full', problem.active ? 'bg-primary' : 'bg-muted-foreground/50')} /><div className="min-w-0 flex-1"><p className="truncate text-sm font-bold">{problem.title}</p><p className="mono mt-1 truncate text-[10px] text-muted-foreground">/{problem.slug} · {problem.topics.slice(0, 3).join(' / ')}</p></div><span className={cx('rounded-lg px-2 py-1 text-[10px] font-bold', difficultyClass(problem.difficulty))}>{problem.difficulty}</span><span className="hidden text-xs text-muted-foreground sm:block">{problem.totalSubmissions} submissions</span><span className={cx('rounded-full px-2 py-1 text-[9px] font-bold', problem.active ? 'bg-primary/10 text-primary' : 'bg-secondary text-muted-foreground')}>{problem.active ? 'ACTIVE' : 'INACTIVE'}</span><div className="flex gap-1"><Button variant="quiet" className="px-2.5 py-2 text-xs" onClick={() => active.mutate({ id: problem.id, data: { active: !problem.active } }, { onSuccess: invalidate })} data-testid={`button-toggle-active-${problem.id}`}>{problem.active ? 'Disable' : 'Activate'}</Button><Button variant="outline" className="px-3 py-2 text-xs" onClick={() => openEditor(problem)} data-testid={`button-edit-problem-${problem.id}`}>Edit</Button><Button variant="danger" className="px-3 py-2 text-xs" onClick={() => { if (window.confirm(`Delete "${problem.title}"? This cannot be undone.`)) remove.mutate({ id: problem.id }, { onSuccess: invalidate }); }} disabled={remove.isPending} data-testid={`button-delete-problem-${problem.id}`}>Delete</Button></div></div>)}</div></DataState></Panel>
    {edit !== null && <div className="fixed inset-0 z-50 grid place-items-center bg-background/85 p-4 backdrop-blur-sm" role="dialog" aria-modal="true"><Panel className="max-h-[92vh] w-full max-w-3xl overflow-hidden"><div className="flex items-center justify-between border-b border-border px-5 py-4"><div><h2 className="font-bold">{edit === 'new' ? 'Create problem' : `Edit ${edit.title}`}</h2><p className="mt-1 text-xs text-muted-foreground">Problem content follows the generated write schema.</p></div><button onClick={() => setEdit(null)} className="rounded-lg p-2 text-muted-foreground hover:bg-secondary" aria-label="Close editor" data-testid="button-close-problem-editor"><X size={17} /></button></div><form onSubmit={save} className="p-5"><div className="mb-3 flex items-center justify-between"><label htmlFor="problem-json" className="text-xs font-bold">Problem data (JSON)</label><span className="mono text-[9px] text-muted-foreground">ALL FIELDS REQUIRED BY SCHEMA</span></div><textarea id="problem-json" value={json} onChange={(e) => setJson(e.target.value)} spellCheck={false} className="mono min-h-[52vh] w-full resize-y rounded-xl border border-input bg-[#0c111b] p-4 text-xs leading-6 text-[#c5d3e3] outline-none focus:border-primary/50" data-testid="input-problem-json" />{error && <p className="mt-3 text-xs text-rose-300" data-testid="status-admin-problem-error">{error}</p>}<div className="mt-4 flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => setEdit(null)} data-testid="button-cancel-problem">Cancel</Button><Button type="submit" disabled={busy} data-testid="button-save-problem">{busy ? <LoaderCircle size={15} className="animate-spin" /> : <Check size={15} />}{edit === 'new' ? 'Create problem' : 'Save changes'}</Button></div></form></Panel></div>}
  </div>;
}

function RoutedBoundary({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>;
}

function AuthGate({ children, admin = false }: { children: ReactNode; admin?: boolean }) {
  const query = useGetCurrentUser({ query: { queryKey: getGetCurrentUserQueryKey(), retry: false } });
  if (query.isLoading) return <Loading rows={2} />;
  if (!query.data) {
    return <Panel className="mx-auto max-w-xl p-7 text-center sm:p-10"><div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-primary/10 text-primary"><UserRound size={21} /></div><h1 className="mt-4 text-xl font-extrabold">{admin ? 'Administrator sign in required' : 'Sign in to see your progress'}</h1><p className="mt-2 text-sm text-muted-foreground">{admin ? 'Use an administrator account to manage the platform.' : 'Your dashboard and profile are saved to your CodeMaster account.'}</p><div className="mt-5 flex justify-center gap-2"><Link href="/login" className="shine rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground" data-testid="link-gate-sign-in">Sign in</Link><Link href="/register" className="rounded-xl border border-border px-4 py-2.5 text-sm font-bold" data-testid="link-gate-register">Create account</Link></div></Panel>;
  }
  if (admin && query.data.role !== 'admin') {
    return <Panel className="mx-auto max-w-xl p-8 text-center"><Shield className="mx-auto text-accent" size={24} /><h1 className="mt-4 text-xl font-extrabold">Administrator access required</h1><p className="mt-2 text-sm text-muted-foreground">This account can use the practice workspace, but it cannot manage platform content.</p><Link href="/" className="mt-5 inline-flex text-sm font-bold text-primary" data-testid="link-gate-home">Back to overview</Link></Panel>;
  }
  return <>{children}</>;
}

function Router() {
  return <RoutedBoundary><AppShell><Switch>
    <Route path="/" component={HomePage} />
    <Route path="/login"><AuthPage mode="login" /></Route>
    <Route path="/register"><AuthPage mode="register" /></Route>
    <Route path="/problems" component={ProblemsPage} />
    <Route path="/problems/:slug" component={ProblemPage} />
    <Route path="/dashboard"><AuthGate><DashboardPage /></AuthGate></Route>
    <Route path="/profile"><AuthGate><ProfilePage /></AuthGate></Route>
    <Route path="/u/:username" component={PublicProfilePage} />
    <Route path="/leaderboard" component={LeaderboardPage} />
    <Route path="/admin"><AuthGate admin><AdminPage /></AuthGate></Route>
    <Route path="/admin/problems"><AuthGate admin><AdminProblemsPage /></AuthGate></Route>
    <Route component={NotFound} />
  </Switch></AppShell></RoutedBoundary>;
}

function App() {
  return <QueryClientProvider client={queryClient}><TooltipProvider><Router /><Toaster /></TooltipProvider></QueryClientProvider>;
}

export default App;