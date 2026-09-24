import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, Route, Switch, useLocation, useParams } from 'wouter';
import {
  ArrowLeft, ArrowRight, BarChart3, Bell, Bot, Check, ChevronRight, CircleHelp, Download,
Moon, Sun,
  Clock3, CreditCard, DollarSign, Edit3, FileText, Filter, Home as HomeIcon,
  Info, Lightbulb, LogOut, Menu, Mic, MoreHorizontal, Package, Plus, Receipt,
  Search, Settings, ShoppingBag, Sparkles, Trash2, TrendingUp, UserRound, Users,
  WifiOff, X, Zap,
} from 'lucide-react';
import { ErrorBoundary } from '@/components/error-boundary';
import { readLocal, writeLocal, type MockProduct, type MockTransaction, type MockUser } from '@/lib/mock-services';
import { api, ApiError, money, type Analytics, type ApiProduct, type ApiTransaction, type Notification } from '@/lib/api';
import { supabase } from '@/lib/supabase';

const naira = (amount: number) => `₦${amount.toLocaleString('en-NG')}`;
const LOW_STOCK_THRESHOLD = 10;
type Product = MockProduct;
type Transaction = MockTransaction;
const read = readLocal;
const write = writeLocal;
const productFromApi = (product: ApiProduct): Product => ({
  id: product.id,
  name: product.name,
  category: product.category,
  price: money(product.price),
  cost: money(product.cost),
  stock: product.stock,
  unit: product.unit,
});

const transactionFromApi = (transaction: ApiTransaction): Transaction => ({
  id: transaction.id,
  item: transaction.item,
  quantity: transaction.quantity,
  total: money(transaction.total),
  customer: transaction.counterparty,
  status: transaction.status,
  date: new Date(transaction.created_at).toLocaleDateString('en-NG'),
});
const getCurrentUser = () => read<MockUser | null>('mp-user', null);
const EMPTY_USER: MockUser = {
  name: 'Merchant',
  business: '',
  identifier: '',
};
const initials = (name: string) => name.trim().split(/\s+/).map(part => part[0]).join('').slice(0, 2).toUpperCase();
const isLowStock = (stock: number) => stock < LOW_STOCK_THRESHOLD;
const stockLabel = (stock: number) => stock === 0 ? 'Out of stock' : isLowStock(stock) ? 'Low stock' : 'Healthy';

function BrandLogo({ small = false }: { small?: boolean }) {
  return <div className={`brand-logo-lockup ${small ? 'brand-logo-small' : ''}`} aria-label="MerchantPal"><img className="brand-logo-mark" src="/merchantpal-mark.png" alt="" /><strong>MerchantPal</strong></div>;
}

function Button({ children, onClick, variant = 'primary', className = '', type = 'button', disabled = false }: { children: React.ReactNode; onClick?: () => void; variant?: 'primary' | 'outline' | 'ghost' | 'danger'; className?: string; type?: 'button' | 'submit'; disabled?: boolean }) {
  return <button type={type} onClick={onClick} disabled={disabled} className={`mp-button mp-${variant} pressable ${className}`}>{children}</button>;
}

function IconButton({ children, label, onClick, className = '' }: { children: React.ReactNode; label: string; onClick?: () => void; className?: string }) {
  return <button aria-label={label} data-testid={`button-${label.toLowerCase().replaceAll(' ', '-')}`} onClick={onClick} className={`icon-button pressable ${className}`}>{children}</button>;
}

function AppHeader({ title = 'MerchantPal', back, action }: { title?: string; back?: string; action?: React.ReactNode }) {
  return <header className="app-header safe-top">
    {back ? <Link href={back} className="icon-button" data-testid="link-back"><ArrowLeft size={21} /></Link> : <div className="brand-lockup"><BrandLogo small /></div>}
    {back && <strong className="header-title">{title}</strong>}
    {action || (!back && <Link href="/notifications" className="icon-button" data-testid="link-notifications"><Bell size={20} /><span className="notification-dot" /></Link>)}
  </header>;
}

const navItems = [
  { href: '/', label: 'Home', icon: HomeIcon },
  { href: '/assistant', label: 'Assistant', icon: Bot },
  { href: '/inventory', label: 'Inventory', icon: Package },
  { href: '/transactions', label: 'Transactions', icon: Receipt },
  { href: '/profile', label: 'Profile', icon: UserRound },
];
function BottomNav() {
  const [location] = useLocation();
  return <nav className="bottom-nav safe-bottom" aria-label="Primary navigation">
    {navItems.map(({ href, label, icon: Icon }) => {
      const active = href === '/' ? location === '/' : location.startsWith(href);
      return <Link href={href} key={href} className={`bottom-item ${active ? 'active' : ''}`} data-testid={`link-nav-${label.toLowerCase()}`}>
        <span className="nav-icon"><Icon size={19} strokeWidth={active ? 2.5 : 1.8} /></span><span>{label}</span>
      </Link>;
    })}
  </nav>;
}

function Shell({ children }: { children: React.ReactNode }) {
  const [, navigate] = useLocation();
  const [offline, setOffline] = useState(!navigator.onLine);
  const [authReady, setAuthReady] = useState(!supabase);

  useEffect(() => {
    const goOffline = () => setOffline(true);
    const goOnline = () => setOffline(false);
    window.addEventListener('offline', goOffline);
    window.addEventListener('online', goOnline);
    if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => undefined);

    if (supabase) {
      supabase.auth.getSession().then(({ data }) => {
        if (!data.session) navigate('/login');
        setAuthReady(true);
      }).catch(() => {
        navigate('/login');
        setAuthReady(true);
      });
    }

    return () => {
      window.removeEventListener('offline', goOffline);
      window.removeEventListener('online', goOnline);
    };
  }, [navigate]);

  if (!authReady) {
    return <div className="app-shell"><div className="app-frame"><main className="screen-content"><p className="muted">Checking your account…</p></main></div></div>;
  }

  return <div className="app-shell"><div className="app-frame">
    {offline && <div className="offline-strip"><WifiOff size={14} /> Working offline · your changes stay on this device</div>}
    {children}<BottomNav />
  </div></div>;
}

function PublicFrame({ children, title, back = '/welcome' }: { children: React.ReactNode; title?: string; back?: string }) {
  return <div className="app-shell"><div className="app-frame public-frame">
    {title ? <AppHeader title={title} back={back} /> : null}<main className="public-main">{children}</main>
  </div></div>;
}

function Welcome() {
  return <PublicFrame><main className="welcome-main">
    <div className="welcome-brand"><BrandLogo /></div>
    <div className="welcome-copy"><span className="eyebrow">A clearer way to trade</span><h1>Your business,<br /><em>understood.</em></h1><p>Keep track of sales, stock and the small details that keep your business moving.</p></div>
    <div className="welcome-art" aria-hidden="true"><div className="art-ring ring-one" /><div className="art-ring ring-two" /><div className="art-card"><TrendingUp size={26} /><span>₦48,000</span><small>Today's sales</small></div><div className="art-dots" /></div>
    <div className="welcome-actions"><Link href="/signup" className="mp-button mp-primary" data-testid="link-get-started">Get started <ArrowRight size={18} /></Link><Link href="/login" className="mp-button mp-outline" data-testid="link-login">I already have an account</Link></div>
    <p className="welcome-foot">Made by the MerchantPal team · Works offline</p>
  </main></PublicFrame>;
}

function Login({ signup = false }: { signup?: boolean }) {
  const [, navigate] = useLocation();
  const [form, setForm] = useState({ name: '', identifier: '', password: '' });
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;

    if (!supabase) {
      window.alert('Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to the frontend environment.');
      return;
    }

    if (!form.identifier.includes('@')) {
      window.alert('For this hackathon build, please use an email address to create or access your account.');
      return;
    }

    setLoading(true);
    try {
      if (signup) {
        const { data, error } = await supabase.auth.signUp({
  email: form.identifier.trim(),
  password: form.password,
  options: {
    data: { full_name: form.name.trim() || 'Merchant' },
    emailRedirectTo: window.location.origin,
  },
});
        if (error) throw error;

        if (!data.session) {
          window.alert('Account created. Check your email to confirm your account, then log in.');
          navigate('/login');
          return;
        }

        write('mp-pending-user', {
          name: form.name.trim() || 'Merchant',
          identifier: form.identifier.trim(),
          business: '',
        });
        navigate('/setup');
        return;
      }

const { error } = await supabase.auth.signInWithPassword({
  email: form.identifier.trim(),
  password: form.password,
});

if (error) throw error;

const {
  data: { user: authUser },
} = await supabase.auth.getUser();

const profile = await api.profile.get();

const authName =
  authUser?.user_metadata?.full_name?.trim() || 'Merchant';

const isNewProfile =
  !profile.business || profile.business === 'My business';

if (isNewProfile) {
  write('mp-pending-user', {
    name: authName,
    identifier: form.identifier.trim(),
    business: '',
  });

  navigate('/setup');
  return;
}

write('mp-user', {
  ...profile,
  identifier: form.identifier.trim(),
  isNew: false,
});

navigate('/');
    } catch (error) {
      console.error('Authentication failed:', error);

      const authError = error as {
        message?: string;
        status?: number;
        code?: string;
      };
      const message = authError.message?.toLowerCase() ?? '';
      const isExistingEmail =
        signup &&
        (
          message.includes('already registered') ||
          message.includes('already exists') ||
          message.includes('user already') ||
          authError.code === 'user_already_exists'
        );
      const isRateLimited =
        signup &&
        (authError.status === 429 || message.includes('rate limit'));

      if (isExistingEmail) {
        window.alert('Email already exists. Please log in instead.');
      } else if (isRateLimited) {
        window.alert('Too many signup attempts have been made recently. Please try again later.');
      } else {
        window.alert(authError.message || 'Could not complete authentication.');
      }
    } finally {
      setLoading(false);
    }
  };
  return <PublicFrame title={signup ? 'Create account' : 'Welcome back'} back="/welcome">
    <div className="auth-layout"><div className="auth-intro"><BrandLogo small /><span className="eyebrow">{signup ? 'Start small. Grow steady.' : 'Good to see you again.'}</span><h1>
  {signup ? (
    'Make room for what matters.'
  ) : (
    <>
      Your numbers,
      <br />
      in one place.
    </>
  )}
</h1><p>{signup ? 'Set up your private business companion in less than a minute.' : 'Pick up right where you left off.'}</p></div>
      <form className="form-stack" onSubmit={submit}>
        {signup && <label>Full name<input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="e.g. Ayomide David" required data-testid="input-name" /></label>}
        <label>Email address<input type="email" value={form.identifier} onChange={e => setForm({ ...form, identifier: e.target.value })} placeholder="you@example.com" required data-testid="input-identifier" /></label>
        <label>Password<input type="password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} placeholder={signup ? 'Create a password' : 'Enter your password'} required data-testid="input-password" /></label>
        {!signup && <Link className="form-link align-right" href="/login">Forgot password?</Link>}
        <Button type="submit" className="full-width" disabled={loading}>{loading ? 'Please wait…' : signup ? 'Create my account' : 'Log in'} {!loading && <ArrowRight size={17} />}</Button>
          </form>
      <p className="auth-switch">{signup ? 'Already have an account?' : "Don't have an account?"} <Link href={signup ? '/login' : '/signup'} data-testid="link-auth-switch">{signup ? 'Log in' : 'Create account'}</Link></p>
    </div>
  </PublicFrame>;
}

function Setup() {
  const [, navigate] = useLocation();
  const pending = read<MockUser>('mp-pending-user', { name: 'Merchant', business: '', identifier: '' });
  const [business, setBusiness] = useState(pending.business || '');
  const [offer, setOffer] = useState('food');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!supabase) return;
    api.profile.get().then(profile => {
      if (profile.name) write('mp-pending-user', { ...pending, name: profile.name });
      if (profile.business && profile.business !== 'My business') setBusiness(profile.business);
      if (profile.category) setOffer(profile.category);
      if (profile.description) setDescription(profile.description);
    }).catch(() => undefined);
  }, []);

  const finish = async () => {
    if (!business.trim() || saving) return;
    if (!supabase) {
      window.alert('Supabase is not configured.');
      return;
    }

    setSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate('/login');
        return;
      }

      const profile = await api.profile.update({
        name: pending.name || 'Merchant',
        business: business.trim(),
        category: offer,
        description: description.trim(),
      });

      write('mp-user', {
        ...profile,
        identifier: pending.identifier,
        isNew: false,
      });
      write('mp-pending-user', null);
      navigate('/');
    } catch (error) {
      console.error('Profile setup failed:', error);
      window.alert(error instanceof ApiError ? error.message : 'Could not save your business details.');
    } finally {
      setSaving(false);
    }
  };

  return <PublicFrame title="Business setup" back="/signup"><div className="setup-page"><div className="stepper"><span className="step-active">1</span><i /><span>2</span><i /><span>3</span></div><span className="eyebrow">A little about your business</span><h1>Let’s get you set up.</h1><p className="muted">This helps MerchantPal give you more useful summaries. You can change it later.</p><div className="form-stack"><label>Business name<input value={business} onChange={e => setBusiness(e.target.value)} placeholder="e.g. My Superstore" required data-testid="input-business-name" /></label><label>What do you offer?<select value={offer} onChange={e => setOffer(e.target.value)}><option value="food">Food and drinks</option><option value="retail">Retail products</option><option value="services">Services</option><option value="other">Something else</option></select></label><label>Tell us a little more <textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="What do you offer, and what would you like MerchantPal to help you track?" rows={4} /></label><label>Currency<select defaultValue="ngn"><option value="ngn">Nigerian Naira (₦)</option><option value="usd">US Dollar ($)</option></select></label><Button onClick={finish} className="full-width" disabled={saving}>{saving ? 'Saving…' : 'Finish setup'} {!saving && <ArrowRight size={17} />}</Button></div></div></PublicFrame>;
}

function StatCard({ label, value, trend, tone = '' }: { label: string; value: string; trend?: string; tone?: string }) {
  return <div className={`stat-card ${tone}`}><span className="label muted">{label}</span><strong>{value}</strong>{trend && <span className="stat-trend"><TrendingUp size={14} />{trend}</span>}</div>;
}

function Dashboard() {
  const user = getCurrentUser();
  const [products, setProducts] = useState<Product[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [stats, setStats] = useState<{
    revenue: string;
    profit: string;
    expenses: string;
    net_cash_flow: string;
    inventory_value: string;
    low_stock_count: number;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadDashboard() {
      try {
        const [apiProducts, apiTransactions, apiStats] = await Promise.all([
          api.products.list(),
          api.transactions.list(),
          api.dashboard(),
        ]);

        if (cancelled) return;

        setProducts(apiProducts.map(productFromApi));
        setTransactions(apiTransactions.map(transactionFromApi));
        setStats({
          revenue: apiStats.revenue,
          profit: apiStats.profit,
          expenses: apiStats.expenses,
          net_cash_flow: apiStats.net_cash_flow,
          inventory_value: apiStats.inventory_value,
          low_stock_count: apiStats.low_stock_count,
        });
      } catch (error) {
        console.error('Failed to load dashboard:', error);

        if (!cancelled) {
       setProducts([]);
setTransactions([]);
        }
      }
    }

    loadDashboard();

    return () => {
      cancelled = true;
    };
  }, []);

  const lowStockProducts = products.filter(product => isLowStock(product.stock));
  const featuredProducts = products.slice(0, 2);

  const todaySales = stats ? naira(money(stats.revenue)) : '₦0';
  const todayProfit = stats ? naira(money(stats.profit)) : '₦0';
  const expenses = stats ? naira(money(stats.expenses)) : '₦0';
  const netProfit = stats ? naira(money(stats.net_cash_flow)) : '₦0';
  const inventoryValue = stats ? naira(money(stats.inventory_value)) : '₦0';

  return <Shell><AppHeader /><main className="screen-content fade-in"><div className="greeting"><span className="eyebrow">{new Date().toLocaleDateString('en-NG', { weekday: 'long', day: 'numeric', month: 'long' })}</span><h1>Good morning, {user?.name || 'there'}</h1><p>Here’s how your business is doing today.</p></div>
    <Link href="/assistant/voice" className="talk-card pressable" data-testid="link-talk-assistant"><div className="talk-icon"><Sparkles size={23} /></div><div><span className="label">YOUR BUSINESS COMPANION</span><h2>Talk to MerchantPal</h2><p>Tell me what happened today.</p></div><ArrowRight size={20} /></Link>

    <section className="section-block"><div className="section-heading"><h2>Today at a glance</h2><Link href="/analytics">See analytics</Link></div><div className="stats-grid">
      <StatCard label="TODAY'S SALES" value={todaySales} />
      <StatCard label="TODAY'S PROFIT" value={todayProfit} tone="mint" />
    </div></section>

    <section className="section-block"><div className="section-heading"><h2>Business health</h2><Link href="/insights">View insights</Link></div><div className="health-grid">
      <Link href="/analytics" className="health-card"><span className="health-icon expense"><DollarSign size={15} /></span><span className="label muted">EXPENSES</span><strong>{expenses}</strong><small>this week</small></Link>
      <Link href="/analytics" className="health-card"><span className="health-icon profit"><TrendingUp size={15} /></span><span className="label muted">NET PROFIT</span><strong>{netProfit}</strong><small>this week</small></Link>
      <Link href="/insights" className="health-card health-insight"><span className="health-icon insight"><Lightbulb size={15} /></span><span className="label muted">INSIGHT</span><strong>See your business insights</strong><small>tap to learn more</small></Link>
    </div></section>

    <section className="section-block"><div className="section-heading"><h2>Inventory</h2><Link href="/inventory">View all</Link></div><div className="stock-card"><div className="stock-header"><div className="stock-symbol"><Package size={18} /></div><div><strong>{products.length} products</strong><p>{inventoryValue} total value</p></div>{lowStockProducts.length > 0 && <span className="stock-warning">{lowStockProducts.length} low stock</span>}</div>{featuredProducts.length ? featuredProducts.map(product => <Link href={`/inventory/${product.id}`} className="stock-row" key={product.id}><span>{product.name}</span><div className={`progress ${isLowStock(product.stock) ? 'warning' : ''}`}><i style={{ width: `${Math.min(product.stock / 36 * 100, 100)}%` }} /></div><b className={isLowStock(product.stock) ? 'warn-text' : ''}>{product.stock}</b>{isLowStock(product.stock) && <span className="stock-row-badge">Low</span>}</Link>) : <p className="empty-stock">No products added yet.</p>}</div></section>

    <section className="section-block"><div className="section-heading"><h2>Recent sales</h2><Link href="/transactions">See all</Link></div>
      {transactions.length > 0 ? (
        transactions.slice(0, 2).map(transaction => (
          <TransactionRow transaction={transaction} key={transaction.id} />
        ))
      ) : (
        <p className="empty-stock">No transactions yet.</p>
      )}
    </section>
  </main></Shell>;
}

function Assistant() {
  const user = getCurrentUser();

  const [messages, setMessages] = useState<
    { from: 'user' | 'bot'; text: string }[]
  >([
    {
      from: 'bot',
      text: `Hi ${(user?.name || 'there').split(' ')[0]}. Tell me about a sale, an expense, or anything on your mind.`,
    },
  ]);

  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);

  const send = async () => {
    const value = input.trim();

    if (!value || sending) return;

    setInput('');

    setMessages(current => [
      ...current,
      { from: 'user', text: value },
    ]);

    setSending(true);

    try {
      const response = await api.assistant(value);

      setMessages(current => [
        ...current,
        {
          from: 'bot',
          text: response.explanation,
        },
      ]);
    } catch (error) {
      console.error('Assistant request failed:', error);

      setMessages(current => [
        ...current,
        {
          from: 'bot',
          text:
            error instanceof ApiError
              ? error.message
              : 'I couldn’t reach MerchantPal right now. Please try again.',
        },
      ]);
    } finally {
      setSending(false);
    }
  };

  return (
    <Shell>
      <AppHeader
        title="Assistant"
        action={
          <IconButton
            label="assistant-help"
          >
            <CircleHelp size={20} />
          </IconButton>
        }
      />

      <main className="assistant-page">
        <div className="assistant-hero">
          <div className="assistant-orb">
            <Sparkles size={28} />
          </div>

          <span className="eyebrow">MERCHANTPAL AI</span>

          <h1>
            Your business,
            <br />
            in plain language.
          </h1>

          <p>Ask a question or tell me what happened.</p>
        </div>

        <div className="chat-list">
          {messages.map((message, i) => (
            <div
              key={`${message.from}-${i}`}
              className={`chat-row ${message.from}`}
            >
              <div className="chat-bubble">
                {message.text}
              </div>
            </div>
          ))}

          {sending && (
            <div className="chat-row bot">
              <div className="chat-bubble">
                Thinking…
              </div>
            </div>
          )}
        </div>

        <div className="assistant-composer">
          <Link
            href="/assistant/voice"
            className="voice-mini"
            aria-label="start voice recording"
            data-testid="link-voice-recording"
          >
            <Mic size={19} />
          </Link>

          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') {
                send();
              }
            }}
            placeholder="Ask MerchantPal anything…"
            data-testid="input-assistant"
            disabled={sending}
          />

          <IconButton
            label="send-message"
            onClick={send}
            className={sending ? 'disabled' : ''}
          >
            <ArrowRight size={19} />
          </IconButton>
        </div>
      </main>
    </Shell>
  );
}

function VoiceRecording() {
  const [, navigate] = useLocation();
  const [recording, setRecording] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [supported, setSupported] = useState(true);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [elapsed, setElapsed] = useState(0);

const recognitionRef = useRef<any>(null);
  useEffect(() => {
    const Recognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!Recognition) {
      setSupported(false);
      return;
    }

    const recognition = new Recognition();
recognition.continuous = false;
recognition.interimResults = false;
recognition.maxAlternatives = 1;
recognition.lang = 'en-NG';

recognition.onresult = (event: any) => {
  const text = Array.from(event.results)
    .map((result: any) => result[0]?.transcript || '')
    .join(' ')
    .trim();

  if (text) {
    setTranscript(text);
  }
};

    recognition.onerror = (event: any) => {
      console.error('Speech recognition failed:', event.error);
      setRecording(false);
    };

    recognition.onend = () => {
      setRecording(false);
    };

    recognitionRef.current = recognition;

    return () => {
      try { recognition.stop(); } catch { /* already stopped */ }
    };
  }, []);

  useEffect(() => {
    if (!recording || !startedAt) return;
    const timer = window.setInterval(() => setElapsed(Date.now() - startedAt), 250);
    return () => window.clearInterval(timer);
  }, [recording, startedAt]);

  const start = () => {
    if (!supported) return;
setTranscript('');
    setElapsed(0);
    setStartedAt(Date.now());
    setRecording(true);
    try {
      recognitionRef.current?.start();
    } catch (error) {
      console.error('Could not start speech recognition:', error);
    }
  };

  const stop = () => {
    try { recognitionRef.current?.stop(); } catch { /* already stopped */ }
    setRecording(false);
  };

  const review = () => {
    stop();
    const value = transcript.trim();
    if (!value) {
      window.alert('I did not catch any words. Try recording again or enter the note manually on the review screen.');
    }
    write('mp-voice-transcript', value);
    navigate('/assistant/clarify');
  };

  const seconds = Math.floor(elapsed / 1000);
  const timerText = `00:${String(seconds % 60).padStart(2, '0')}`;

  const bars = [22, 35, 52, 30, 67, 42, 76, 43, 58, 29, 51, 38, 70, 31, 48, 24, 59, 36, 45, 28];

  return <Shell><AppHeader title="Talk to MerchantPal" back="/assistant" /><main className="voice-page"><div className="voice-copy"><span className="eyebrow">VOICE NOTE</span><h1>{recording ? 'I’m listening.' : 'Ready when you are.'}</h1><p>{supported ? (recording ? 'Tell me what happened in your business today.' : 'Tap the microphone to start.') : 'Voice transcription is not supported in this browser. You can still enter the note manually.'}</p></div><div className={`waveform ${recording ? 'recording' : ''}`}>{bars.map((height, i) => <i key={i} style={{ height: `${recording ? height : 8}px`, animationDelay: `${i * 40}ms` }} />)}</div><div className="voice-timer">{timerText}</div><button className={`record-button ${recording ? 'record-pulse' : ''}`} onClick={recording ? stop : start} aria-label={recording ? 'stop recording' : 'start recording'} disabled={!supported}><span>{recording ? <div className="stop-square" /> : <Mic size={32} />}</span></button>{transcript && <p className="muted" style={{ maxWidth: 520, textAlign: 'center' }}>{transcript}</p>}<div className="voice-actions"><Button variant="ghost" onClick={() => navigate('/assistant')}>Cancel</Button><Button onClick={supported ? review : () => { write('mp-voice-transcript', ''); navigate('/assistant/clarify'); }}>Review note <ArrowRight size={17} /></Button></div></main></Shell>;
}

function Clarify() {
  const [, navigate] = useLocation();
  const [transcript, setTranscript] = useState(read<string>('mp-voice-transcript', ''));
  const [draft, setDraft] = useState<{
    type: 'sale' | 'purchase' | 'expense';
    item: string;
    quantity: number;
    total: string | number;
    counterparty: string;
    status: 'paid' | 'pending';
    product_id?: string | null;
    source_transcript?: string | null;
  } | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(Boolean(transcript));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    api.products.list().then(items => setProducts(items.map(productFromApi))).catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!transcript.trim()) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError('');

    api.assistantInterpret(transcript.trim())
      .then(response => {
        if (cancelled) return;
        setDraft({
          ...response.draft,
          source_transcript: response.draft.source_transcript || response.transcript,
        });

        const exact = products.find(product => product.name.toLowerCase() === response.draft.item.toLowerCase());
        if (exact && !response.draft.product_id) {
          setDraft(current => current ? { ...current, product_id: exact.id, item: exact.name } : current);
        }
      })
      .catch(error => {
        console.error('Voice interpretation failed:', error);
        if (!cancelled) setError(error instanceof ApiError ? error.message : 'MerchantPal could not understand the note.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [transcript, retry]);

  const updateDraft = (field: string, value: string | number) => {
    setDraft(current => current ? { ...current, [field]: value } : current);
  };

  const confirm = async () => {
    if (!draft || saving) return;
    if (!draft.item.trim() || Number(draft.total) <= 0 || Number(draft.quantity) <= 0) {
      window.alert('Please check the item, quantity, and total before recording it.');
      return;
    }

    setSaving(true);
    try {
      const created = await api.transactions.create({
        type: draft.type,
        item: draft.item.trim(),
        quantity: Number(draft.quantity),
        total: Number(draft.total),
        counterparty: draft.counterparty.trim() || (draft.type === 'sale' ? 'Walk-in customer' : 'Unknown'),
        status: draft.status,
        product_id: draft.product_id || null,
        source_transcript: transcript.trim() || undefined,
      });

      const product = products.find(item => item.id === draft.product_id);
      const profit = draft.type === 'sale' && product
        ? (product.price - product.cost) * Number(draft.quantity)
        : 0;

      sessionStorage.setItem('mp-last-confirmation', JSON.stringify({
        type: draft.type,
        item: draft.item,
        quantity: Number(draft.quantity),
        total: Number(draft.total),
        profit,
        transactionId: created.id,
      }));

      write('mp-voice-transcript', null);
      navigate(`/transactions/${created.id}/confirm`);
    } catch (error) {
      console.error('Transaction creation failed:', error);
      window.alert(error instanceof ApiError ? error.message : 'Could not record this transaction.');
    } finally {
      setSaving(false);
    }
  };

  return <Shell><AppHeader title="Review note" back="/assistant/voice" /><main className="screen-content clarify-page"><span className="eyebrow">VOICE NOTE</span><h1>Review before recording.</h1><div className="clarify-note"><Sparkles size={17} /><span>MerchantPal interpreted your note. Check the details before anything is saved.</span></div><div className="clarify-card surface-card">{loading ? <p className="muted">Understanding your note…</p> : error ? <><p className="draft-placeholder">{error}</p><Button onClick={() => setRetry(value => value + 1)}>Try again <ArrowRight size={17} /></Button></> : <>{!transcript && <label>What happened?<textarea value={transcript} onChange={e => setTranscript(e.target.value)} placeholder="e.g. Sold two plates of jollof rice to Kunle for ₦12,000." rows={4} /></label>}{draft && <div className="form-stack"><label>Type<select value={draft.type} onChange={e => updateDraft('type', e.target.value)}><option value="sale">Sale</option><option value="purchase">Purchase</option><option value="expense">Expense</option></select></label><label>Item<input value={draft.item} onChange={e => updateDraft('item', e.target.value)} /></label><label>Quantity<input type="number" min="1" value={draft.quantity} onChange={e => updateDraft('quantity', Number(e.target.value))} /></label><label>Total<input type="number" min="0" value={draft.total} onChange={e => updateDraft('total', Number(e.target.value))} /></label><label>{draft.type === 'sale' ? 'Customer' : draft.type === 'purchase' ? 'Supplier' : 'Payee'}<input value={draft.counterparty} onChange={e => updateDraft('counterparty', e.target.value)} /></label><label>Payment status<select value={draft.status} onChange={e => updateDraft('status', e.target.value)}><option value="paid">Paid</option><option value="pending">Pending</option></select></label><label>Inventory product (optional)<select value={draft.product_id || ''} onChange={e => { const value = e.target.value; const product = products.find(item => item.id === value); setDraft(current => current ? { ...current, product_id: value || null, item: product ? product.name : current.item } : current); }}><option value="">No linked product</option>{products.map(product => <option key={product.id} value={product.id}>{product.name} · {product.stock} {product.unit}s</option>)}</select></label></div>}</>}</div>{draft && <Button className="full-width" onClick={confirm} disabled={saving}>{saving ? 'Recording…' : 'Confirm & record'} {!saving && <Check size={17} />}</Button>}{!draft && !loading && <Button className="full-width" onClick={() => navigate('/assistant')}>Back to assistant <ArrowRight size={17} /></Button>}</main></Shell>;
}

function Inventory() {
  const [, navigate] = useLocation();
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState('');
  const [lowOnly, setLowOnly] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function loadProducts(showLoading = false) {
      if (showLoading) setLoading(true);

      try {
        const apiProducts = await api.products.list();

        if (!cancelled) {
          setProducts(apiProducts.map(productFromApi));
        }
      } catch (error) {
        console.error('Failed to load inventory:', error);

        if (!cancelled && showLoading) {
          setProducts([]);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    const refresh = () => { void loadProducts(false); };
    void loadProducts(true);
    window.addEventListener('focus', refresh);
    window.addEventListener('pageshow', refresh);

    return () => {
      cancelled = true;
      window.removeEventListener('focus', refresh);
      window.removeEventListener('pageshow', refresh);
    };
  }, []);

  const visible = products.filter(
    product =>
      (product.name.toLowerCase().includes(search.toLowerCase()) ||
        product.category.toLowerCase().includes(search.toLowerCase())) &&
      (!lowOnly || isLowStock(product.stock))
  );

  const inventoryValue = products.reduce(
    (total, product) => total + product.price * product.stock,
    0
  );

  const remove = async (id: string) => {
    if (!window.confirm('Remove this product from inventory?')) return;

    try {
      await api.products.remove(id);
      setProducts(products => products.filter(product => product.id !== id));
    } catch (error) {
      console.error('Failed to remove product:', error);
      window.alert('Could not remove this product. Please try again.');
    }
  };

  return (
    <Shell>
      <AppHeader />

      <main className="screen-content fade-in">
        <div className="page-heading">
          <div>
            <span className="eyebrow">YOUR CATALOG</span>
            <h1>Inventory</h1>
          </div>

          <IconButton
            label="add-product"
            onClick={() => navigate('/inventory/add')}
          >
            <Plus size={21} />
          </IconButton>
        </div>

        <div className="search-box">
          <Search size={18} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search products…"
            data-testid="input-search-products"
          />
        </div>

        <div className="inventory-summary surface-card">
          <div>
            <span className="label muted">INVENTORY VALUE</span>
            <strong>{naira(inventoryValue)}</strong>
            <span className="stat-trend">
              <TrendingUp size={13} /> Live inventory
            </span>
          </div>

          <div className="summary-side">
            <b>{products.length}</b>
            <span>products</span>
          </div>
        </div>

        <div className="section-heading inventory-list-heading">
          <h2>Product list</h2>

          <Button
            variant="ghost"
            onClick={() => setLowOnly(!lowOnly)}
          >
            <Filter size={15} />
            {lowOnly ? 'All products' : 'Low stock'}
          </Button>
        </div>

        {loading ? (
          <p className="muted">Loading inventory…</p>
        ) : visible.length ? (
          <div className="product-list">
            {visible.map(product => (
              <div
                className={`product-card surface-card ${
                  isLowStock(product.stock) ? 'product-card-low' : ''
                }`}
                key={product.id}
                data-testid={`card-product-${product.id}`}
              >
                <div
                  className={`product-icon ${
                    isLowStock(product.stock) ? 'product-icon-low' : ''
                  }`}
                >
                  <ShoppingBag size={18} />
                </div>

                <div className="product-info">
                  <div className="product-name-row">
                    <strong>{product.name}</strong>

                    {isLowStock(product.stock) && (
                      <span className="low-stock-badge">
                        {stockLabel(product.stock)}
                      </span>
                    )}
                  </div>

                  <span>
                    {product.category} · {naira(product.price)} / {product.unit}
                  </span>

                  <div className="product-stock">
                    <div
                      className={`progress ${
                        isLowStock(product.stock) ? 'warning' : ''
                      }`}
                    >
                      <i
                        style={{
                          width: `${Math.min(
                            (product.stock / 36) * 100,
                            100
                          )}%`,
                        }}
                      />
                    </div>

                    <small
                      className={
                        isLowStock(product.stock) ? 'warn-text' : ''
                      }
                    >
                      {product.stock} in stock
                    </small>
                  </div>
                </div>

                <div className="product-actions">
                  <IconButton
                    label={`edit-${product.id}`}
                    onClick={() =>
                      navigate(`/inventory/${product.id}`)
                    }
                  >
                    <Edit3 size={16} />
                  </IconButton>

                  <IconButton
                    label={`delete-${product.id}`}
                    onClick={() => remove(product.id)}
                  >
                    <Trash2 size={16} />
                  </IconButton>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <EmptyInventory
            onAdd={() => navigate('/inventory/add')}
          />
        )}
      </main>
    </Shell>
  );
}

function EmptyInventory({ onAdd }: { onAdd: () => void }) { return <div className="empty-state surface-card"><div className="empty-illustration"><Package size={32} /></div><h2>Your shelves are waiting.</h2><p>Add your first product to start tracking stock and value in one place.</p><Button onClick={onAdd} className="full-width"><Plus size={17} /> Add a product</Button></div>; }
function AddProduct() {
  const [, navigate] = useLocation();
  const params = useParams<{ id: string }>();
  const editing = Boolean(params.id && params.id !== 'add');

  const [form, setForm] = useState({
    name: '',
    category: 'Prepared food',
    price: '',
    cost: '',
    stock: '',
    unit: 'piece',
  });

  const [loading, setLoading] = useState(editing);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!editing || !params.id) {
      setLoading(false);
      return;
    }

async function loadProduct() {
  try {
    const products = await api.products.list();
    const found = products.find(product => product.id === params.id);

    if (found) {
      setForm({
        name: found.name,
        category: found.category,
        price: String(found.price),
        cost: String(found.cost),
        stock: String(found.stock),
        unit: found.unit,
      });
    }
  } catch (error) {
    console.error('Failed to load product:', error);
  } finally {
    setLoading(false);
  }
}

    loadProduct();
  }, [editing, params.id]);

  const update = (
    key: keyof typeof form,
    value: string
  ) => {
    setForm(current => ({
      ...current,
      [key]: value,
    }));
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (saving) return;

    setSaving(true);

    try {
      const productData = {
        name: form.name,
        category: form.category,
        price: Number(form.price),
        cost: Number(form.cost),
        stock: Number(form.stock),
        unit: form.unit,
      };

      if (editing && params.id) {
        await api.products.update(params.id, productData);
      } else {
        await api.products.create(productData);
      }

      navigate('/inventory');
    } catch (error) {
      console.error('Failed to save product:', error);
      window.alert('Could not save this product. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Shell>
        <AppHeader
          title="Edit product"
          back="/inventory"
        />
        <main className="screen-content form-page">
          <p className="muted">Loading product…</p>
        </main>
      </Shell>
    );
  }

  return (
    <Shell>
      <AppHeader
        title={editing ? 'Edit product' : 'Add product'}
        back={editing ? `/inventory/${params.id}` : '/inventory'}
      />

      <main className="screen-content form-page">
        <span className="eyebrow">
          {editing ? 'UPDATE YOUR CATALOG' : 'NEW PRODUCT'}
        </span>

        <h1>
          {editing ? 'Keep it current.' : 'What are you selling?'}
        </h1>

        <p className="muted">
          Add the details you reach for most often. You can always
          change them later.
        </p>

        <form className="form-stack" onSubmit={submit}>
          <label>
            Product name
            <input
              value={form.name}
              onChange={e => update('name', e.target.value)}
              placeholder="e.g. Jollof Rice"
              required
              data-testid="input-product-name"
            />
          </label>

          <label>
            Category
            <select
              value={form.category}
              onChange={e => update('category', e.target.value)}
            >
              <option>Prepared food</option>
              <option>Drinks</option>
              <option>Retail</option>
              <option>Services</option>
            </select>
          </label>

          <div className="two-fields">
            <label>
              Selling price
              <input
                type="number"
                value={form.price}
                onChange={e => update('price', e.target.value)}
                placeholder="0"
                required
              />
            </label>

            <label>
              Cost price
              <input
                type="number"
                value={form.cost}
                onChange={e => update('cost', e.target.value)}
                placeholder="0"
                required
              />
            </label>
          </div>

          <div className="two-fields">
            <label>
              Current stock
              <input
                type="number"
                value={form.stock}
                onChange={e => update('stock', e.target.value)}
                placeholder="0"
                required
              />
            </label>

            <label>
              Unit
              <select
                value={form.unit}
                onChange={e => update('unit', e.target.value)}
              >
                <option>piece</option>
                <option>plate</option>
                <option>bottle</option>
                <option>pack</option>
              </select>
            </label>
          </div>

          <Button
            type="submit"
            className="full-width"
            disabled={saving}
          >
            {saving
              ? 'Saving…'
              : editing
                ? 'Save changes'
                : 'Add product'}
            {!saving && <Check size={17} />}
          </Button>
        </form>
      </main>
    </Shell>
  );
}

function ProductDetails() {
  const [, navigate] = useLocation();
  const { id } = useParams<{ id: string }>();

  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;

    async function loadProduct() {
      try {
        const products = await api.products.list();
        const found = products.find(product => product.id === id);

        if (found) {
          setProduct(productFromApi(found));
        }
      } catch (error) {
        console.error('Failed to load product:', error);
      } finally {
        setLoading(false);
      }
    }

    loadProduct();
  }, [id]);

  if (loading) {
    return (
      <Shell>
        <AppHeader title="Product details" back="/inventory" />
        <main className="screen-content product-detail">
          <p className="muted">Loading product…</p>
        </main>
      </Shell>
    );
  }

  if (!product) {
    return (
      <Shell>
        <AppHeader title="Product details" back="/inventory" />
        <main className="screen-content">
          <div className="empty-state surface-card">
            <div className="empty-illustration">
              <Package size={32} />
            </div>
            <h2>Product not found.</h2>
            <p>This product may have been removed.</p>
            <Button
              onClick={() => navigate('/inventory')}
              className="full-width"
            >
              Back to inventory
            </Button>
          </div>
        </main>
      </Shell>
    );
  }

  return (
    <Shell>
      <AppHeader
        title="Product details"
        back="/inventory"
        action={
          <IconButton
            label="more-product"
            onClick={() =>
              navigate(`/inventory/${product.id}/edit`)
            }
          >
            <MoreHorizontal size={21} />
          </IconButton>
        }
      />

      <main className="screen-content product-detail">
        <div
          className={`detail-product-icon ${
            isLowStock(product.stock) ? 'product-icon-low' : ''
          }`}
        >
          <ShoppingBag size={34} />
        </div>

        <span className="eyebrow">{product.category}</span>

        <h1>{product.name}</h1>

        <div className="detail-price">
          {naira(product.price)} <small>/ {product.unit}</small>
        </div>

        {isLowStock(product.stock) && (
          <span className="detail-stock-badge">
            {stockLabel(product.stock)}
          </span>
        )}

        <div className="detail-grid">
          <div>
            <span className="label muted">IN STOCK</span>

            <strong
              className={
                isLowStock(product.stock) ? 'warn-text' : ''
              }
            >
              {product.stock}
            </strong>

            <small>{product.unit}s available</small>
          </div>

          <div>
            <span className="label muted">MARGIN</span>

            <strong>
              {naira(product.price - product.cost)}
            </strong>

            <small>per {product.unit}</small>
          </div>
        </div>

        <div className="detail-panel surface-card">
          <div className="section-heading">
            <h2>Stock level</h2>

            <span
              className={
                isLowStock(product.stock)
                  ? 'warn-text'
                  : 'muted'
              }
            >
              {product.stock === 0
                ? 'Out of stock'
                : isLowStock(product.stock)
                  ? 'Running low'
                  : 'Healthy'}
            </span>
          </div>

          <div
            className={`big-progress progress ${
              isLowStock(product.stock) ? 'warning' : ''
            }`}
          >
            <i
              style={{
                width: `${Math.min(
                  (product.stock / 36) * 100,
                  100
                )}%`,
              }}
            />
          </div>

          <p className="body-sm muted">
            Low stock alerts show when fewer than{' '}
            {LOW_STOCK_THRESHOLD} units remain.
          </p>
        </div>

        <Button
          onClick={() =>
            navigate(`/inventory/${product.id}/edit`)
          }
          className="full-width"
        >
          <Edit3 size={17} /> Edit product
        </Button>
      </main>
    </Shell>
  );
}
function TransactionRow({ transaction, onClick }: { transaction: Transaction; onClick?: () => void }) {
  return <button onClick={onClick} className="transaction-row" data-testid={`row-transaction-${transaction.id}`}><span className={`transaction-mark ${transaction.status}`}><Receipt size={16} /></span><span className="transaction-info"><strong>{transaction.item}</strong><small>{transaction.date} · {transaction.customer}</small></span><span className="transaction-amount"><b>{naira(transaction.total)}</b><small>{transaction.status === 'paid' ? 'Paid' : 'Pending'}</small></span><ChevronRight size={17} className="chevron" /></button>;
}
function ManualSale() {
  const [, navigate] = useLocation();
  const [products, setProducts] = useState<Product[]>([]);
  const [query, setQuery] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [status, setStatus] = useState<'paid' | 'pending'>('paid');
  const [customer, setCustomer] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;

    api.products.list()
      .then(items => {
        if (!cancelled) setProducts(items.map(productFromApi));
      })
      .catch(error => {
        console.error('Failed to load products for manual sale:', error);
        if (!cancelled) setProducts([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, []);

  const filteredProducts = products.filter(product =>
    product.name.toLowerCase().includes(query.toLowerCase()) ||
    product.category.toLowerCase().includes(query.toLowerCase())
  );

  const total = selectedProduct ? selectedProduct.price * quantity : 0;
  const availableStock = selectedProduct?.stock ?? 0;
  const quantityValid = Number.isInteger(quantity) && quantity > 0 && quantity <= availableStock;

  const selectProduct = (product: Product) => {
    setSelectedProduct(product);
    setQuantity(1);
    setQuery('');
  };

  const confirm = async () => {
    if (!selectedProduct || saving) return;

    if (!quantityValid) {
      window.alert(availableStock > 0
        ? `Enter a quantity from 1 to ${availableStock}.`
        : 'This product is out of stock.');
      return;
    }

    setSaving(true);
    try {
      const created = await api.transactions.create({
        type: 'sale',
        item: selectedProduct.name,
        quantity,
        total,
        counterparty: customer.trim() || 'Walk-in customer',
        status,
        product_id: selectedProduct.id,
      });

      const profit = (selectedProduct.price - selectedProduct.cost) * quantity;
      sessionStorage.setItem('mp-last-confirmation', JSON.stringify({
        type: 'sale',
        item: selectedProduct.name,
        quantity,
        total,
        profit,
        transactionId: created.id,
      }));

      navigate(`/transactions/${created.id}/confirm`);
    } catch (error) {
      console.error('Manual sale creation failed:', error);
      window.alert(error instanceof ApiError ? error.message : 'Could not record this sale.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Shell>
      <AppHeader title="Record sale" back="/transactions" />
      <main className="screen-content form-page">
        <span className="eyebrow">QUICK SALE</span>
        <h1>Record a sale.</h1>
        <p className="muted">Pick an item, enter the quantity, and MerchantPal will calculate the total price.</p>

        <div className="surface-card" style={{ padding: 16, marginTop: 18 }}>
          <label>Search or pick a product</label>
          <div className="search-box" style={{ marginTop: 8 }}>
            <Search size={18} />
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search inventory…"
              disabled={loading || saving}
            />
          </div>

          {selectedProduct ? (
            <div className="surface-card" style={{ marginTop: 12, padding: 14 }}>
              <div className="section-heading" style={{ marginBottom: 8 }}>
                <div>
                  <span className="eyebrow">SELECTED ITEM</span>
                  <h2>{selectedProduct.name}</h2>
                </div>
                <Button variant="ghost" onClick={() => setSelectedProduct(null)} disabled={saving}>Change</Button>
              </div>
              <p className="muted">{naira(selectedProduct.price)} / {selectedProduct.unit} · {selectedProduct.stock} in stock</p>
            </div>
          ) : (
            <div style={{ display: 'grid', gap: 8, marginTop: 12 }}>
              {filteredProducts.slice(0, 12).map(product => (
                <button
                  key={product.id}
                  type="button"
                  className="settings-row"
                  onClick={() => selectProduct(product)}
                  disabled={saving}
                  style={{ textAlign: 'left' }}
                >
                  <span className="setting-icon mint"><ShoppingBag size={18} /></span>
                  <span>
                    <b>{product.name}</b>
                    <small>{naira(product.price)} / {product.unit} · {product.stock} in stock</small>
                  </span>
                  <ChevronRight size={18} />
                </button>
              ))}
              {!loading && filteredProducts.length === 0 && <p className="muted">No matching products.</p>}
              {loading && <p className="muted">Loading products…</p>}
            </div>
          )}
        </div>

        {selectedProduct && (
          <div className="form-stack" style={{ marginTop: 16 }}>
            <label>Quantity
              <input
                type="number"
                min="1"
                max={selectedProduct.stock}
                step="1"
                value={quantity}
                onChange={e => setQuantity(Number(e.target.value))}
                disabled={saving}
              />
            </label>

            <label>Customer (optional)
              <input
                value={customer}
                onChange={e => setCustomer(e.target.value)}
                placeholder="Walk-in customer"
                disabled={saving}
              />
            </label>

            <div className="surface-card" style={{ padding: 16 }}>
              <span className="label muted">TOTAL PRICE</span>
              <strong style={{ display: 'block', fontSize: 28, marginTop: 4 }}>{naira(total)}</strong>
              <small className="muted">{naira(selectedProduct.price)} × {quantity || 0} {selectedProduct.unit}{quantity === 1 ? '' : 's'}</small>
            </div>

            <div>
              <label>Payment status</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 8 }}>
                <Button
                  type="button"
                  variant={status === 'paid' ? 'primary' : 'outline'}
                  onClick={() => setStatus('paid')}
                  disabled={saving}
                >
                  Paid
                </Button>
                <Button
                  type="button"
                  variant={status === 'pending' ? 'primary' : 'outline'}
                  onClick={() => setStatus('pending')}
                  disabled={saving}
                >
                  Pending
                </Button>
              </div>
            </div>

            <Button
              className="full-width"
              onClick={confirm}
              disabled={saving || !quantityValid}
            >
              {saving ? 'Recording…' : 'Record sale'} {!saving && <Check size={17} />}
            </Button>
          </div>
        )}
      </main>
    </Shell>
  );
}

function Transactions() {
  const [, navigate] = useLocation();

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'paid' | 'pending'>('all');
  const [filterOpen, setFilterOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function loadTransactions() {
      try {
        const apiTransactions = await api.transactions.list();

        if (!cancelled) {
          setTransactions(apiTransactions.map(transactionFromApi));
        }
      } catch (error) {
        console.error('Failed to load transactions:', error);

        if (!cancelled) {
          setTransactions([]);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadTransactions();

    return () => {
      cancelled = true;
    };
  }, []);

  const visibleTransactions = transactions.filter(
    transaction =>
      transaction.item.toLowerCase().includes(query.toLowerCase()) &&
      (statusFilter === 'all' || transaction.status === statusFilter)
  );

  const total = transactions
    .filter(transaction => transaction.status === 'paid')
    .reduce((sum, transaction) => sum + transaction.total, 0);

  const filterLabel =
    statusFilter === 'all'
      ? 'Filter'
      : statusFilter === 'paid'
        ? 'Paid only'
        : 'Pending only';

  return (
    <Shell>
      <AppHeader />

      <main className="screen-content">
        <div className="page-heading">
          <div>
            <span className="eyebrow">MONEY IN, MONEY OUT</span>
            <h1>Transactions</h1>
          </div>

          <IconButton
            label="new-transaction"
            onClick={() => navigate('/transactions/manual')}
          >
            <Plus size={21} />
          </IconButton>
        </div>

        <div className="search-box">
          <Search size={18} />
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search transactions…"
          />
        </div>

        <div className="transaction-total surface-card">
          <span className="label muted">TOTAL PAID SALES</span>
          <strong>{naira(total)}</strong>
          <span className="stat-trend">
            <TrendingUp size={13} /> From recorded transactions
          </span>
        </div>

        <div className="section-heading transaction-heading">
          <h2>Recent activity</h2>

          <div className="filter-wrap">
            <Button
              variant="ghost"
              onClick={() => setFilterOpen(!filterOpen)}
            >
              <Filter size={15} />
              {filterLabel}
            </Button>

            {filterOpen && (
              <div className="transaction-filter-menu">
                <button
                  className={statusFilter === 'all' ? 'selected' : ''}
                  onClick={() => {
                    setStatusFilter('all');
                    setFilterOpen(false);
                  }}
                >
                  All transactions
                </button>

                <button
                  className={statusFilter === 'paid' ? 'selected' : ''}
                  onClick={() => {
                    setStatusFilter('paid');
                    setFilterOpen(false);
                  }}
                >
                  Paid
                </button>

                <button
                  className={statusFilter === 'pending' ? 'selected' : ''}
                  onClick={() => {
                    setStatusFilter('pending');
                    setFilterOpen(false);
                  }}
                >
                  Pending
                </button>
              </div>
            )}
          </div>
        </div>

        {loading ? (
          <p className="muted">Loading transactions…</p>
        ) : visibleTransactions.length ? (
          <div className="transaction-list">
            {visibleTransactions.map(transaction => (
              <TransactionRow
                key={transaction.id}
                transaction={transaction}
                onClick={() =>
                  navigate(`/transactions/${transaction.id}`)
                }
              />
            ))}
          </div>
        ) : (
          <div className="transaction-empty surface-card">
            <Receipt size={22} />
            <p>No transactions match these filters.</p>

            <button
              onClick={() => {
                setQuery('');
                setStatusFilter('all');
              }}
            >
              Clear filters
            </button>
          </div>
        )}
      </main>
    </Shell>
  );
}
function TransactionDetails() {
  const [, navigate] = useLocation();
  const { id } = useParams<{ id: string }>();

  const [transaction, setTransaction] = useState<Transaction | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) {
      setLoading(false);
      return;
    }

    async function loadTransaction() {
      try {
        const found = await api.transactions.get(id);

        if (found) {
          setTransaction(transactionFromApi(found));
        }
      } catch (error) {
        console.error('Failed to load transaction:', error);

      } finally {
        setLoading(false);
      }
    }

    loadTransaction();
  }, [id]);

  if (loading) {
    return (
      <Shell>
        <AppHeader title="Transaction details" back="/transactions" />

        <main className="screen-content transaction-detail">
          <p className="muted">Loading transaction…</p>
        </main>
      </Shell>
    );
  }

  if (!transaction) {
    return (
      <Shell>
        <AppHeader title="Transaction details" back="/transactions" />

        <main className="screen-content">
          <div className="empty-state surface-card">
            <div className="empty-illustration">
              <Receipt size={32} />
            </div>

            <h2>Transaction not found.</h2>

            <p>
              This transaction may have been removed or does not exist.
            </p>

            <Button
              onClick={() => navigate('/transactions')}
              className="full-width"
            >
              Back to transactions
            </Button>
          </div>
        </main>
      </Shell>
    );
  }

  return (
    <Shell>
      <AppHeader
        title="Transaction details"
        back="/transactions"
      />

      <main className="screen-content transaction-detail">
        <div className="detail-receipt">
          <div className="receipt-icon">
            <Check size={27} />
          </div>

          <span className="eyebrow">SALE RECORDED</span>

          <h1>{naira(transaction.total)}</h1>

          <p>{transaction.date}</p>
        </div>

        <div className="receipt-card surface-card">
          <div className="receipt-card-head">
            <span>Item</span>
            <span>Amount</span>
          </div>

          <div className="receipt-item">
            <div>
              <strong>{transaction.item}</strong>
              <small>{transaction.quantity} items</small>
            </div>

            <b>{naira(transaction.total)}</b>
          </div>

          <div className="receipt-line">
            <span>Payment status</span>

            <b className={transaction.status === 'paid' ? 'paid-text' : ''}>
              {transaction.status === 'paid' && <Check size={14} />}
              {transaction.status === 'paid' ? 'Paid' : 'Pending'}
            </b>
          </div>

          <div className="receipt-line">
            <span>Customer</span>
            <b>{transaction.customer}</b>
          </div>
        </div>

        <Button
          className="full-width"
          onClick={() => navigate('/transactions/manual')}
        >
          Record another sale <Plus size={17} />
        </Button>
      </main>
    </Shell>
  );
}
function TransactionConfirmation() {
  const [, navigate] = useLocation();
  const { id } = useParams<{ id: string }>();
  const [transaction, setTransaction] = useState<ApiTransaction | null>(null);
  const [loading, setLoading] = useState(true);
  const saved = useMemo(() => {
    try {
      return JSON.parse(sessionStorage.getItem('mp-last-confirmation') || 'null') as { type?: string; profit?: number } | null;
    } catch {
      return null;
    }
  }, []);

  useEffect(() => {
    if (!id) return;
    api.transactions.get(id)
      .then(setTransaction)
      .catch(error => console.error('Could not load recorded transaction:', error))
      .finally(() => setLoading(false));
  }, [id]);

  const type = transaction?.type || saved?.type || 'sale';
  const title = type === 'purchase' ? 'Purchase recorded.' : type === 'expense' ? 'Expense recorded.' : 'Sale recorded.';
  const total = transaction ? money(transaction.total) : 0;
  const quantity = transaction?.quantity || 0;
  const item = transaction?.item || 'Transaction';

  return <Shell><main className="confirmation-page"><div className="confirm-check"><Check size={38} /></div><span className="eyebrow">ALL DONE</span><h1>{loading ? 'Saving your numbers.' : title}</h1><p>{type === 'sale' ? 'Your numbers are up to date and your inventory has been adjusted when a product was linked.' : 'Your transaction is now in your business records.'}</p><div className="confirm-summary surface-card"><div><span className="label muted">TOTAL PRICE / COST</span><strong>{naira(total)}</strong></div><div className="confirm-summary-row"><span>{item}</span><b>{quantity} item{quantity === 1 ? '' : 's'}</b></div>{type === 'sale' && <div className="confirm-summary-row"><span>Estimated profit</span><b className="paid-text">{naira(saved?.profit || 0)}</b></div>}</div><Button onClick={() => navigate('/')} className="full-width">Back to home <ArrowRight size={17} /></Button><Button variant="ghost" onClick={() => navigate('/transactions')} className="full-width">See all transactions</Button></main></Shell>;
}

function Analytics() {
  const [analytics, setAnalytics] = useState<{
    stats: {
      revenue: string;
      total_sales: string;
      total_purchases: string;
      expenses: string;
      total_expenses: string;
      profit: string;
      net_cash_flow: string;
      total_transactions: number;
      inventory_value: string;
      low_stock_count: number;
      low_stock_threshold: number;
      low_stock_items: string[];
    };
    daily_sales: { date: string; amount: string }[];
  } | null>(null);

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function loadAnalytics() {
      try {
        const data = await api.analytics();

        if (!cancelled) {
          setAnalytics(data);
        }
      } catch (error) {
        console.error('Failed to load analytics:', error);
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadAnalytics();

    return () => {
      cancelled = true;
    };
  }, []);

  const dailySales = analytics?.daily_sales ?? [];

  const chartValues = dailySales.map(day => money(day.amount));
  const maxSales = Math.max(...chartValues, 1);

  const chartDays = dailySales.slice(-7);

  const profit = analytics
    ? naira(money(analytics.stats.profit))
    : '₦0';

  const sales = analytics
    ? naira(money(analytics.stats.total_sales))
    : '₦0';

  const expenses = analytics
    ? naira(money(analytics.stats.total_expenses))
    : '₦0';

  if (loading) {
    return (
      <Shell>
        <AppHeader title="Profit analytics" back="/" />

        <main className="screen-content analytics-page">
          <span className="eyebrow">THE BIG PICTURE</span>
          <h1>Your profit, clearly.</h1>
          <p className="muted">Loading your business data…</p>
        </main>
      </Shell>
    );
  }

  return (
    <Shell>
      <AppHeader title="Profit analytics" back="/" />

      <main className="screen-content analytics-page">
        <span className="eyebrow">THE BIG PICTURE</span>

        <h1>Your profit, clearly.</h1>

        <div className="period-tabs">
          <button className="selected">This week</button>
          <button disabled> This month </button>
          <button disabled>3 months</button>
        </div>

        <div className="analytics-hero surface-card">
          <span className="label muted">
            NET PROFIT · THIS WEEK
          </span>

          <strong>{profit}</strong>

          <span className="stat-trend">
            <TrendingUp size={14} />
            Based on recorded transactions
          </span>

          <div className="chart">
            {chartDays.length > 0 ? (
              chartDays.map((day, index) => {
                const amount = money(day.amount);

                return (
                  <i
                    key={`${day.date}-${index}`}
                    className={index === chartDays.length - 1 ? 'today' : ''}
                    style={{
                      height: `${Math.max(
                        (amount / maxSales) * 100,
                        4
                      )}%`,
                    }}
                    title={`${day.date}: ${naira(amount)}`}
                  />
                );
              })
            ) : (
              <p className="muted">No daily sales data yet.</p>
            )}
          </div>

          <div className="chart-labels">
            {chartDays.map(day => (
              <span key={day.date}>
                {new Date(day.date).toLocaleDateString('en-NG', {
                  weekday: 'short',
                }).slice(0, 1)}
              </span>
            ))}
          </div>
        </div>

        <div className="stats-grid analytics-stats">
          <StatCard
            label="SALES"
            value={sales}
          />

          <StatCard
            label="EXPENSES"
            value={expenses}
            tone="rose"
          />
        </div>

        <div className="insight-callout">
          <Lightbulb size={19} />

          <div>
            <b>Keep tracking your business.</b>

            <p>
              MerchantPal will be able to surface stronger patterns
              as more sales and expenses are recorded.
            </p>
          </div>
        </div>

        <Link
          href="/insights"
          className="list-link surface-card"
        >
          <span className="icon-tile mint">
            <Sparkles size={17} />
          </span>

          <span>
            <b>Business insights</b>
            <small>
              See observations from your numbers
            </small>
          </span>

          <ChevronRight size={18} />
        </Link>
      </main>
    </Shell>
  );
}
function Insights() {
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([api.analytics(), api.products.list()])
      .then(([data, apiProducts]) => {
        setAnalytics(data);
        setProducts(apiProducts.map(productFromApi));
      })
      .catch(error => console.error('Failed to load insights:', error))
      .finally(() => setLoading(false));
  }, []);

  const lowStock = products.filter(product => isLowStock(product.stock)).sort((a, b) => a.stock - b.stock);
  const days = analytics?.daily_sales || [];
  const strongest = days.length ? [...days].sort((a, b) => money(b.amount) - money(a.amount))[0] : null;

  return <Shell><AppHeader title="Business insights" back="/analytics" /><main className="screen-content"><span className="eyebrow">A CLOSER LOOK</span><h1>Worth knowing.</h1><p className="muted">{loading ? 'Looking at your recent activity…' : 'Patterns from your actual MerchantPal data.'}</p>{loading ? <p className="muted">Loading insights…</p> : <div className="insight-list">{strongest && <div className="insight-card surface-card"><div className="insight-number">01</div><TrendingUp size={19} /><h2>Your strongest sales day</h2><p>{new Date(strongest.date).toLocaleDateString('en-NG', { weekday: 'long' })} recorded {naira(money(strongest.amount))} in sales.</p><Link href="/analytics">See analytics <ArrowRight size={15} /></Link></div>}{lowStock.length > 0 && <div className="insight-card surface-card"><div className="insight-number">02</div><Zap size={19} /><h2>Stock needs attention</h2><p>{lowStock.slice(0, 3).map(product => `${product.name} (${product.stock} left)`).join(', ')} {lowStock.length > 3 ? `and ${lowStock.length - 3} more` : ''} are below the restock threshold.</p><Link href="/inventory">Check your stock <ArrowRight size={15} /></Link></div>}<div className="insight-card surface-card"><div className="insight-number">{strongest && lowStock.length > 0 ? '03' : '02'}</div><Lightbulb size={19} /><h2>Keep recording transactions</h2><p>MerchantPal can only identify reliable business patterns from transactions actually recorded in your account.</p><Link href="/assistant/voice">Record a transaction <ArrowRight size={15} /></Link></div></div>}</main></Shell>;
}

function Notifications() {
  const [notes, setNotes] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [readAll, setReadAll] = useState(false);

  useEffect(() => {
    api.notifications()
      .then(setNotes)
      .catch(error => console.error('Failed to load notifications:', error))
      .finally(() => setLoading(false));
  }, []);

  return <Shell><AppHeader title="Notifications" back="/" /><main className="screen-content"><div className="page-heading"><div><span className="eyebrow">KEEPING YOU IN THE LOOP</span><h1>Notifications</h1></div>{notes.length > 0 && <Button variant="ghost" onClick={() => setReadAll(true)}>Mark all read</Button>}</div>{loading ? <p className="muted">Loading notifications…</p> : notes.length === 0 ? <div className="empty-state surface-card"><div className="empty-illustration"><Bell size={32} /></div><h2>Nothing needs your attention.</h2><p>MerchantPal will show stock alerts here when your inventory gets low.</p></div> : <div className="notification-list">{notes.map((note, i) => { const Icon = note.kind === 'low_stock' ? Package : Bell; return <div className={`notification-item ${i === 0 && !readAll ? 'unread' : ''}`} key={note.id}><span className="notification-icon amber"><Icon size={18} /></span><div><b>{note.title}</b><p>{note.body}</p><small>{new Date(note.created_at).toLocaleString('en-NG')}</small></div>{i === 0 && !readAll && <i className="unread-dot" />}</div>; })}</div>}</main></Shell>;
}

function Profile() {
  const [, navigate] = useLocation();
  const [business, setBusiness] = useState<MockUser>(getCurrentUser() ?? EMPTY_USER);
  const [offlineOnly, setOfflineOnly] = useState(true);
  const [darkMode, setDarkMode] = useState(
  () => localStorage.getItem('mp-theme') === 'dark'
);
  const [installEvent, setInstallEvent] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
  document.documentElement.classList.toggle('dark', darkMode);
  localStorage.setItem('mp-theme', darkMode ? 'dark' : 'light');
}, [darkMode]);

  useEffect(() => {
    const onInstall = (event: Event) => {
      event.preventDefault();
      setInstallEvent(event);
    };
    window.addEventListener('beforeinstallprompt', onInstall);

    api.profile.get()
      .then(profile => {
        const current = { ...profile, identifier: business.identifier };
        setBusiness(current);
        write('mp-user', current);
      })
      .catch(error => console.error('Failed to load profile:', error))
      .finally(() => setLoading(false));

    return () => window.removeEventListener('beforeinstallprompt', onInstall);
  }, []);

  const install = async () => {
    if (!installEvent) return;
    await installEvent.prompt();
    setInstallEvent(null);
  };

  const logout = async () => {
    if (supabase) await supabase.auth.signOut();
    write('mp-user', null);
    navigate('/welcome');
  };

  return <Shell><AppHeader /><main className="screen-content profile-page"><div className="profile-head"><div className="avatar">{initials(business.name || 'Merchant')}</div><div><span className="eyebrow">YOUR ACCOUNT</span><h1>{loading ? 'Loading…' : business.name}</h1><p>{business.business}</p></div><IconButton label="edit-profile" onClick={() => navigate('/setup')}><Edit3 size={17} /></IconButton></div><div className="profile-section"><span className="label muted">BUSINESS</span><div className="settings-list"><Link href="/setup" className="settings-row"><span className="setting-icon mint"><ShoppingBag size={18} /></span><span><b>Business details</b><small>Update your business information</small></span><ChevronRight size={18} /></Link><Link href="/analytics" className="settings-row"><span className="setting-icon blue"><BarChart3 size={18} /></span><span><b>Profit analytics</b><small>See how your business is doing</small></span><ChevronRight size={18} /></Link></div></div><div className="profile-section"><span className="label muted">PREFERENCES</span><div className="settings-list"> <div className="settings-row">
  <span className="setting-icon blue">
    {darkMode ? <Moon size={18} /> : <Sun size={18} />}
  </span>

  <span>
    <b>Dark mode</b>
    <small>{darkMode ? 'Use the light theme' : 'Use the darker theme'}</small>
  </span>

  <button
    className={`toggle ${darkMode ? 'on' : ''}`}
    onClick={() => setDarkMode(value => !value)}
    aria-label="toggle dark mode"
  >
    <i />
  </button>
</div>{installEvent && <button className="settings-row" onClick={install}><span className="setting-icon mint"><Download size={18} /></span><span><b>Install MerchantPal</b><small>Add it to your home screen</small></span><ChevronRight size={18} /></button>}<div className="settings-row"><span className="setting-icon amber"><WifiOff size={18} /></span><span><b>Offline-first mode</b><small>Keep working without internet</small></span><button className={`toggle ${offlineOnly ? 'on' : ''}`} onClick={() => setOfflineOnly(!offlineOnly)} aria-label="toggle offline mode"><i /></button></div><Link href="/notifications" className="settings-row"><span className="setting-icon rose"><Bell size={18} /></span><span><b>Notifications</b><small>Stock alerts and business updates</small></span><ChevronRight size={18} /></Link></div></div><div className="profile-section"><span className="label muted">SUPPORT</span><div className="settings-list"><button className="settings-row" onClick={() => window.alert('For the hackathon build, contact the MerchantPal team directly for support.')}><span className="setting-icon blue"><CircleHelp size={18} /></span><span><b>Help & feedback</b><small>Contact the MerchantPal team</small></span><ChevronRight size={18} /></button><button className="settings-row logout" onClick={logout}><span className="setting-icon rose"><LogOut size={18} /></span><span><b>Log out</b><small>Sign out of this account</small></span><ChevronRight size={18} /></button></div></div><p className="profile-version">MerchantPal v1.0.0 · Made for small businesses</p></main></Shell>;
}

function Offline() { const [, navigate] = useLocation(); return <PublicFrame><div className="offline-page"><div className="offline-icon"><WifiOff size={32} /></div><span className="eyebrow">NO CONNECTION</span><h1>You’re offline,<br />but still in business.</h1><p>MerchantPal saves your work on this device, so you can keep recording sales and checking stock.</p><div className="offline-points"><span><Check size={16} />Your local data is safe</span><span><Check size={16} />Sales will sync when you’re back</span></div><Button onClick={() => navigate('/')} className="full-width">Continue offline <ArrowRight size={17} /></Button></div></PublicFrame>; }
function NotFoundPage() { return <PublicFrame><div className="empty-state"><div className="empty-illustration"><CircleHelp size={32} /></div><h1>Page not found</h1><p>That page isn’t part of today’s numbers.</p><Link href="/" className="mp-button mp-primary full-width">Back to home</Link></div></PublicFrame>; }

function Router() {
  return <ErrorBoundary><Switch>
    <Route path="/welcome" component={Welcome} /><Route path="/login" component={() => <Login />} /><Route path="/signup" component={() => <Login signup />} /><Route path="/setup" component={Setup} />
    <Route path="/" component={Dashboard} /><Route path="/assistant" component={Assistant} /><Route path="/assistant/voice" component={VoiceRecording} /><Route path="/assistant/clarify" component={Clarify} />
    <Route path="/inventory" component={Inventory} /><Route path="/inventory/empty" component={() => <Shell><AppHeader title="Inventory" back="/inventory" /><main className="screen-content"><EmptyInventory onAdd={() => undefined} /></main></Shell>} /><Route path="/inventory/add" component={AddProduct} /><Route path="/inventory/:id/edit" component={AddProduct} /><Route path="/inventory/:id" component={ProductDetails} />
    <Route path="/transactions" component={Transactions} /><Route path="/transactions/manual" component={ManualSale} /><Route path="/transactions/empty" component={() => <Shell><AppHeader title="Transactions" back="/" /><main className="screen-content"><div className="empty-state surface-card"><div className="empty-illustration"><Receipt size={32} /></div><h2>No sales yet.</h2><p>Record your first sale with MerchantPal Assistant.</p><Link href="/assistant/voice" className="mp-button mp-primary full-width">Record a sale <Mic size={17} /></Link></div></main></Shell>} /><Route path="/transactions/:id/confirm" component={TransactionConfirmation} /><Route path="/transactions/:id" component={TransactionDetails} />
    <Route path="/analytics" component={Analytics} /><Route path="/insights" component={Insights} /><Route path="/notifications" component={Notifications} /><Route path="/profile" component={Profile} /><Route path="/offline" component={Offline} /><Route component={NotFoundPage} />
  </Switch></ErrorBoundary>;
}
function App() { return <Router />; }
export default App;