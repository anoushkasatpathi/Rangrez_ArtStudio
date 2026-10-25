import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Link, NavLink, Route, Routes, useLocation, useNavigate, useParams } from 'react-router-dom';
import './styles.css'; // global styles first, so page styles (home.css) can build on them
import { addDaysString, api, formatMoney, todayString } from './api.js';
import AdminScreen from './AdminScreen.jsx';
import HomeExperience from './HomeExperience.jsx';

// Browser tab titles for each route (the site name is Rangrez / रंगरेज़).
const PAGE_TITLES = [
  ['/paintings/', 'Painting'], ['/paintings', 'Paintings'], ['/wall-painting', 'Book a wall painting'], ['/pottery', 'Custom pottery'],
  ['/login', 'Log in'], ['/signup', 'Sign up'], ['/account', 'My account'], ['/admin', 'Studio desk']
];
function pageTitle(pathname) {
  const match = PAGE_TITLES.find(([prefix]) => pathname.startsWith(prefix));
  return match ? `${match[1]} · Rangrez` : 'Rangrez · रंगरेज़ · Paint it. Fire it. Frame it.';
}

const AuthContext = createContext(null);
const useAuth = () => useContext(AuthContext);

function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const refresh = async () => {
    try {
      const data = await api('/api/auth/me');
      setUser(data.user);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { refresh(); }, []);
  const value = useMemo(() => ({
    user,
    loading,
    async login(credentials) { const data = await api('/api/auth/login', { method: 'POST', body: JSON.stringify(credentials) }); setUser(data.user); return data.user; },
    async signup(credentials) { const data = await api('/api/auth/signup', { method: 'POST', body: JSON.stringify(credentials) }); setUser(data.user); return data.user; },
    async logout() { await api('/api/auth/logout', { method: 'POST' }); setUser(null); }
  }), [user, loading]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

function Shell({ children }) {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [orderCount, setOrderCount] = useState(0);
  useEffect(() => setMenuOpen(false), [location.pathname]);
  useEffect(() => { document.title = pageTitle(location.pathname); }, [location.pathname]);
  useEffect(() => { if (!user || user.role !== 'customer') { setOrderCount(0); return; } api('/api/orders').then((data) => setOrderCount(data.orders.length)).catch(() => setOrderCount(0)); }, [user]);
  const onHome = location.pathname === '/';
  return <div className="app-shell">
    <header className={`site-header ${onHome ? 'home-header' : 'inner-header'}`}>
      <Link to="/" className="wordmark" aria-label="Rangrez home"><img src="/logo-dark.svg" alt="Rangrez — रंगरेज़" /></Link>
      <div className="header-actions"><Link className="orders-link" to={user ? (user.role === 'admin' ? '/admin' : '/account') : '/login'}>{user?.role === 'customer' ? `Orders (${orderCount})` : user?.role === 'admin' ? 'Admin Dashboard' : 'Login'}</Link><button className="menu-trigger" onClick={() => setMenuOpen((open) => !open)} aria-expanded={menuOpen}>Menu <span>{menuOpen ? '×' : '↗'}</span></button></div>
    </header>
    {menuOpen && <div className={`menu-overlay ${onHome ? 'menu-dark' : ''}`}><nav><NavLink to="/">Home</NavLink><NavLink to="/paintings">Paintings</NavLink><NavLink to="/wall-painting">Wall Painting</NavLink><NavLink to="/pottery">Pottery</NavLink><NavLink to={user ? (user.role === 'admin' ? '/admin' : '/account') : '/login'}>{user?.role === 'admin' ? 'Admin Dashboard' : user ? 'My Account' : 'Login'}</NavLink>{user && <button onClick={logout}>Logout</button>}</nav><span className="menu-hindi" lang="hi">रंगरेज़</span></div>}
    <main>{children}</main>
    <footer className={`site-footer ${onHome ? 'site-footer-home' : ''}`}>
      <div className="footer-brand"><img src="/logo-dark.svg" alt="Rangrez — रंगरेज़" /><span className="eyebrow">Rangrez / Est. in the studio</span><p>Paint it. Fire it. Frame it.</p></div>
      <div className="footer-note">Original work, made slowly.<br />© 2026 Rangrez Art Studio</div>
    </footer>
  </div>;
}

function StateBlock({ loading, error, empty, children, emptyMessage = 'Nothing here yet.' }) {
  if (loading) return <div className="state-block"><span className="spinner" /> Loading the studio…</div>;
  if (error) return <div className="state-block state-error"><strong>We hit a rough edge.</strong><span>{error}</span></div>;
  if (empty) return <div className="state-block"><strong>{emptyMessage}</strong><span>Check back soon, or choose another way to make something.</span></div>;
  return children;
}

function StatusBadge({ value }) { return <span className={`status status-${value}`}>{value}</span>; }

function Home() {
  return <HomeExperience />;
}

function Gallery() {
  const [paintings, setPaintings] = useState([]); const [loading, setLoading] = useState(true); const [error, setError] = useState(''); const [filter, setFilter] = useState('all');
  useEffect(() => { setLoading(true); api('/api/paintings').then((data) => setPaintings(data.paintings)).catch((err) => setError(err.message)).finally(() => setLoading(false)); }, []);
  const shown = paintings.filter((painting) => filter === 'all' || painting.status === filter);
  return <div className="page-wrap gallery-page"><div className="page-intro"><span className="eyebrow">The collection / 2026</span><h1>Pieces with<br /><em>their own weather.</em></h1><p>Every painting is one of one. Browse the available works, or wander through the sold archive to see what has already found its room.</p></div><div className="filter-row"><button className={filter === 'all' ? 'filter active' : 'filter'} onClick={() => setFilter('all')}>All works</button><button className={filter === 'available' ? 'filter active' : 'filter'} onClick={() => setFilter('available')}>Available</button><button className={filter === 'sold' ? 'filter active' : 'filter'} onClick={() => setFilter('sold')}>Sold archive</button></div><StateBlock loading={loading} error={error} empty={!shown.length} emptyMessage="No works match this view."><div className="painting-grid">{shown.map((painting) => <PaintingCard key={painting.id} painting={painting} />)}</div></StateBlock></div>;
}

function PaintingCard({ painting }) { return <Link to={`/paintings/${painting.id}`} className="painting-card"><div className="painting-photo"><img src={painting.imageUrl} alt={painting.title} />{painting.status === 'sold' && <span className="sold-stamp">Sold</span>}</div><div className="painting-meta"><div><span className="eyebrow">{painting.artist}</span><h3>{painting.title}</h3></div><strong>{formatMoney(painting.price)}</strong></div><p>{painting.description}</p></Link>; }

function Detail() {
  const { id } = useParams(); const { user } = useAuth(); const navigate = useNavigate(); const [painting, setPainting] = useState(null); const [loading, setLoading] = useState(true); const [error, setError] = useState(''); const [message, setMessage] = useState('');
  useEffect(() => { api(`/api/paintings/${id}`).then((data) => setPainting(data.painting)).catch((err) => setError(err.message)).finally(() => setLoading(false)); }, [id]);
  async function buy() { if (!user) return navigate('/login'); try { const data = await api('/api/orders', { method: 'POST', body: JSON.stringify({ paintingId: id }) }); setMessage('It is yours in the studio ledger. Order placed.'); setPainting((current) => ({ ...current, status: 'sold' })); } catch (err) { setMessage(err.message); } }
  return <div className="page-wrap detail-page"><StateBlock loading={loading} error={error} empty={!painting} emptyMessage="Painting not found.">{painting && <div className="detail-grid"><div className="detail-image"><img src={painting.imageUrl} alt={painting.title} /></div><div className="detail-copy"><Link className="back-link" to="/paintings">← Back to collection</Link><span className="eyebrow">{painting.artist} / {painting.status}</span><h1>{painting.title}</h1><p className="detail-description">{painting.description}</p><div className="price-line"><strong>{formatMoney(painting.price)}</strong><span>Original work / no reproductions</span></div>{message && <div className="notice">{message}</div>}{painting.status === 'available' ? user?.role === 'customer' || !user ? <button className="button button-dark" onClick={buy}>Buy this painting <span>↗</span></button> : <p className="muted">Admin accounts can browse, but customers place orders.</p> : <div className="sold-panel"><StatusBadge value="sold" /><p>This work has found its room. Browse the collection for the next one.</p></div>}</div></div>}</StateBlock></div>;
}

function RequireCustomer({ children }) { const { user, loading } = useAuth(); if (loading) return <div className="page-wrap"><StateBlock loading /></div>; if (!user) return <NavigateMessage title="The studio keeps accounts." copy="Log in or make a customer account to book, buy and request pottery." />; if (user.role !== 'customer') return <NavigateMessage title="This page is for customers." copy="Use the studio desk to manage requests and bookings." />; return children; }
function NavigateMessage({ title, copy }) { return <div className="page-wrap centered-message"><span className="eyebrow">A small pause</span><h1>{title}</h1><p>{copy}</p><Link className="button button-dark" to="/login">Log in to continue <span>↗</span></Link></div>; }

function WallPainting() {
  const [taken, setTaken] = useState([]); const [loading, setLoading] = useState(true); const [error, setError] = useState(''); const [message, setMessage] = useState(''); const [form, setForm] = useState({ bookingDate: addDaysString(7), wallSizeSqft: 40, address: '' });
  useEffect(() => { api('/api/bookings/taken-dates').then((data) => setTaken(data.dates)).catch((err) => setError(err.message)).finally(() => setLoading(false)); }, []);
  const price = Number(form.wallSizeSqft || 0) * 150;
  async function submit(event) { event.preventDefault(); setMessage(''); try { await api('/api/bookings', { method: 'POST', body: JSON.stringify({ ...form, wallSizeSqft: Number(form.wallSizeSqft) }) }); setMessage('Your wall date is requested. We will confirm the colour plan shortly.'); setTaken((dates) => [...dates, form.bookingDate]); } catch (err) { setMessage(err.message); } }
  return <RequireCustomer><div className="page-wrap form-page"><div className="form-intro"><span className="eyebrow">Wall painting / 01</span><h1>Give your wall<br /><em>a date worth remembering.</em></h1><p>Tell us where the mural lives and how much room it has. We price by the square foot, then bring the colour story to life.</p></div><StateBlock loading={loading} error={error}><div className="form-layout"><form className="studio-form" onSubmit={submit}><label>Date<div className="input-with-note"><input type="date" min={addDaysString(7)} max={addDaysString(90)} value={form.bookingDate} onChange={(e) => setForm({ ...form, bookingDate: e.target.value })} required />{taken.includes(form.bookingDate) && <span className="field-note error-text">That date is already taken.</span>}</div></label><label>Wall size / sq ft<input type="number" min="10" max="500" value={form.wallSizeSqft} onChange={(e) => setForm({ ...form, wallSizeSqft: e.target.value })} required /></label><label>Address<textarea rows="4" maxLength="500" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="Where should the colour land?" required /></label>{message && <div className="notice">{message}</div>}<button className="button button-dark" type="submit">Request this date <span>↗</span></button></form><aside className="price-card"><span className="eyebrow">Live estimate</span><strong>{formatMoney(price)}</strong><p>₹150 per sq ft, stored by the studio when you request. Your date stays open until we confirm it.</p><div className="taken-dates"><span className="eyebrow">Already in the diary</span>{taken.length ? taken.slice(0, 5).map((date) => <span key={date}>{date}</span>) : <span className="muted">No dates taken yet.</span>}</div></aside></div></StateBlock></div></RequireCustomer>;
}

function Pottery() {
  const [options, setOptions] = useState({ items: [], glazes: [] }); const [loading, setLoading] = useState(true); const [error, setError] = useState(''); const [message, setMessage] = useState(''); const [form, setForm] = useState({ itemId: '', glazeId: '', quantity: 1, neededBy: addDaysString(14) });
  useEffect(() => { api('/api/pottery/options').then((data) => { setOptions(data); setForm((current) => ({ ...current, itemId: data.items[0]?.id || '', glazeId: data.glazes[0]?.id || '' })); }).catch((err) => setError(err.message)).finally(() => setLoading(false)); }, []);
  async function submit(event) { event.preventDefault(); setMessage(''); try { await api('/api/pottery-requests', { method: 'POST', body: JSON.stringify({ ...form, quantity: Number(form.quantity) }) }); setMessage('Pottery request sent. The studio will shape a reply around your date.'); } catch (err) { setMessage(err.message); } }
  return <RequireCustomer><div className="page-wrap form-page pottery-page"><div className="form-intro"><span className="eyebrow">Custom pottery / 02</span><h1>Choose a form.<br /><em>Then give it colour.</em></h1><p>Small batches, generous glazes. Pick a shape, pick a finish, and tell us when the piece needs to be part of your life.</p></div><StateBlock loading={loading} error={error} empty={!options.items.length || !options.glazes.length} emptyMessage="Pottery options are resting. Try again later."><div className="form-layout"><form className="studio-form" onSubmit={submit}><label>Item<select value={form.itemId} onChange={(e) => setForm({ ...form, itemId: e.target.value })}>{options.items.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label>Glaze<select value={form.glazeId} onChange={(e) => setForm({ ...form, glazeId: e.target.value })}>{options.glazes.map((glaze) => <option key={glaze.id} value={glaze.id}>{glaze.name}</option>)}</select></label><label>Quantity<input type="number" min="1" max="12" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} required /></label><label>Needed by<input type="date" min={addDaysString(14)} value={form.neededBy} onChange={(e) => setForm({ ...form, neededBy: e.target.value })} required /></label>{message && <div className="notice">{message}</div>}<button className="button button-dark" type="submit">Send pottery request <span>↗</span></button></form><aside className="material-card"><div className="material-swatch swatch-red" /><div className="material-swatch swatch-yellow" /><div className="material-swatch swatch-green" /><span className="eyebrow">The Rangrez promise</span><h3>Made to be used.</h3><p>We make forms that can live with tea stains, flower stems, and the everyday rituals that make a place yours.</p></aside></div></StateBlock></div></RequireCustomer>;
}

function AuthPage({ mode }) {
  const { user, login, signup } = useAuth(); const navigate = useNavigate(); const [form, setForm] = useState({ name: '', email: '', password: '' }); const [error, setError] = useState(''); const [loading, setLoading] = useState(false);
  useEffect(() => { if (user) navigate(user.role === 'admin' ? '/admin' : '/account', { replace: true }); }, [user, navigate]);
  async function submit(event) { event.preventDefault(); setLoading(true); setError(''); try { const signedIn = mode === 'login' ? await login({ email: form.email, password: form.password }) : await signup(form); navigate(signedIn.role === 'admin' ? '/admin' : '/account'); } catch (err) { setError(err.message); } finally { setLoading(false); } }
  return <div className="auth-page"><div className="auth-art"><img className="auth-logo" src="/logo-dark.svg" alt="Rangrez — रंगरेज़" /><span className="eyebrow light">Enter the studio</span><h1>{mode === 'login' ? <>Come back to<br /><em>your colour.</em></> : <>Make a little<br /><em>room for art.</em></>}</h1><span className="auth-vertical">PAINT IT / FIRE IT / FRAME IT</span></div><form className="auth-form" onSubmit={submit}><Link to="/" className="back-link">← Return home</Link><img className="auth-mark" src="/logo-mark.svg" alt="" /><span className="eyebrow">{mode === 'login' ? 'Customer login' : 'New customer'}</span><h2>{mode === 'login' ? 'Welcome back.' : 'Join Rangrez.'}</h2>{mode === 'signup' && <label>Your name<input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></label>}<label>Email<input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required /></label><label>Password<input type="password" minLength="8" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required /></label>{error && <div className="notice notice-error">{error}</div>}<button className="button button-dark" disabled={loading}>{loading ? 'Opening…' : mode === 'login' ? 'Log in ↗' : 'Create account ↗'}</button><p className="switch-auth">{mode === 'login' ? 'New to the studio?' : 'Already have an account?'} <Link to={mode === 'login' ? '/signup' : '/login'}>{mode === 'login' ? 'Create one' : 'Log in'}</Link></p></form></div>;
}

function Account() {
  const { user } = useAuth(); const [orders, setOrders] = useState([]); const [bookings, setBookings] = useState([]); const [requests, setRequests] = useState([]); const [loading, setLoading] = useState(true); const [error, setError] = useState(''); const [message, setMessage] = useState(''); const [editing, setEditing] = useState(null);
  const load = () => { setLoading(true); Promise.all([api('/api/orders'), api('/api/bookings'), api('/api/pottery-requests')]).then(([a, b, c]) => { setOrders(a.orders); setBookings(b.bookings); setRequests(c.requests); }).catch((err) => setError(err.message)).finally(() => setLoading(false)); };
  useEffect(load, []);
  async function cancel(path) { try { await api(path, { method: 'POST' }); setMessage('Updated.'); load(); } catch (err) { setMessage(err.message); } }
  async function updatePottery(event) { event.preventDefault(); try { await api(`/api/pottery-requests/${editing.id}`, { method: 'PATCH', body: JSON.stringify({ itemId: editing.itemId, glazeId: editing.glazeId, quantity: Number(editing.quantity), neededBy: editing.neededBy }) }); setMessage('Pottery request updated.'); setEditing(null); load(); } catch (err) { setMessage(err.message); } }
  return <div className="page-wrap account-page"><div className="page-intro compact"><span className="eyebrow">Your studio ledger / {user?.name}</span><h1>Keep an eye on<br /><em>what is becoming.</em></h1><p>Orders, wall dates and pottery requests live here until they find their final form.</p></div>{message && <div className="notice">{message}</div>}<StateBlock loading={loading} error={error} empty={false}><div className="account-columns"><section className="ledger-panel"><div className="panel-heading"><h2>Orders</h2><span>{orders.length}</span></div>{orders.length ? orders.map((order) => <div className="ledger-row" key={order.id}><div><span className="eyebrow">{order.title || order.paintingId}</span><strong>{formatMoney(order.priceAtPurchase)}</strong></div><div><StatusBadge value={order.status} />{order.status === 'placed' && <button className="small-action" onClick={() => cancel(`/api/orders/${order.id}/cancel`)}>Cancel</button>}</div></div>) : <div className="panel-empty">No paintings in your ledger yet.</div>}</section><section className="ledger-panel"><div className="panel-heading"><h2>Wall dates</h2><span>{bookings.length}</span></div>{bookings.length ? bookings.map((booking) => <div className="ledger-row" key={booking.id}><div><span className="eyebrow">{booking.bookingDate} / {booking.wallSizeSqft} sq ft</span><strong>{formatMoney(booking.price)}</strong></div><div><StatusBadge value={booking.status} />{['requested', 'confirmed'].includes(booking.status) && <button className="small-action" onClick={() => cancel(`/api/bookings/${booking.id}/cancel`)}>Cancel</button>}</div></div>) : <div className="panel-empty">No wall dates booked yet.</div>}</section><section className="ledger-panel ledger-wide"><div className="panel-heading"><h2>Pottery requests</h2><span>{requests.length}</span></div>{requests.length ? requests.map((request) => <div className="ledger-row" key={request.id}><div><span className="eyebrow">{request.itemName} / {request.glazeName} / ×{request.quantity}</span><strong>Needed by {request.neededBy}</strong></div><div><StatusBadge value={request.status} />{request.status === 'requested' && <><button className="small-action" onClick={() => setEditing(request)}>Edit</button><button className="small-action" onClick={() => cancel(`/api/pottery-requests/${request.id}/cancel`)}>Cancel</button></>}</div></div>) : <div className="panel-empty">No pottery requests yet.</div>}</section></div></StateBlock>{editing && <form className="edit-drawer studio-form" onSubmit={updatePottery}><button type="button" className="close-button" onClick={() => setEditing(null)}>×</button><span className="eyebrow">Edit while requested</span><h2>Shape the request.</h2><label>Item ID<input value={editing.itemId} onChange={(e) => setEditing({ ...editing, itemId: e.target.value })} /></label><label>Glaze ID<input value={editing.glazeId} onChange={(e) => setEditing({ ...editing, glazeId: e.target.value })} /></label><label>Quantity<input type="number" min="1" max="12" value={editing.quantity} onChange={(e) => setEditing({ ...editing, quantity: e.target.value })} /></label><label>Needed by<input type="date" min={addDaysString(14)} value={editing.neededBy} onChange={(e) => setEditing({ ...editing, neededBy: e.target.value })} /></label><button className="button button-dark">Save request ↗</button></form>}</div>;
}

function Admin() {
  const [data, setData] = useState({ paintings: [], orders: [], bookings: [], requests: [] }); const [loading, setLoading] = useState(true); const [error, setError] = useState(''); const [message, setMessage] = useState(''); const [form, setForm] = useState({ id: '', title: '', artist: '', description: '', price: '', imageUrl: '/images/p-001.jpg', status: 'available' });
  const load = () => { setLoading(true); Promise.all([api('/api/paintings'), api('/api/orders'), api('/api/bookings'), api('/api/pottery-requests')]).then(([p, o, b, r]) => setData({ paintings: p.paintings, orders: o.orders, bookings: b.bookings, requests: r.requests })).catch((err) => setError(err.message)).finally(() => setLoading(false)); };
  useEffect(load, []);
  async function action(path) { try { const result = await api(path, { method: 'POST' }); setMessage(result.message); load(); } catch (err) { setMessage(err.message); } }
  async function addPainting(event) { event.preventDefault(); try { await api('/api/paintings', { method: 'POST', body: JSON.stringify({ ...form, price: Number(form.price) }) }); setMessage('Painting added to the collection.'); setForm({ id: '', title: '', artist: '', description: '', price: '', imageUrl: '/images/p-001.jpg', status: 'available' }); load(); } catch (err) { setMessage(err.message); } }
  return <div className="page-wrap admin-page"><div className="page-intro compact"><span className="eyebrow">Private view / studio desk</span><h1>Keep the<br /><em>work moving.</em></h1><p>Manage the collection, then give each request the considered yes or no it deserves.</p></div><StateBlock loading={loading} error={error} empty={false}><div className="admin-grid"><form className="studio-form admin-form" onSubmit={addPainting}><span className="eyebrow">Add a work</span><h2>New painting</h2><label>ID<input value={form.id} onChange={(e) => setForm({ ...form, id: e.target.value })} placeholder="p-013" required /></label><label>Title<input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required /></label><label>Artist<input value={form.artist} onChange={(e) => setForm({ ...form, artist: e.target.value })} required /></label><label>Description<textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} required /></label><label>Price<input type="number" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} required /></label><label>Image URL<input value={form.imageUrl} onChange={(e) => setForm({ ...form, imageUrl: e.target.value })} required /></label><button className="button button-dark">Add painting ↗</button></form><section className="admin-panel"><div className="panel-heading"><h2>Collection</h2><span>{data.paintings.length} works</span></div>{data.paintings.map((painting) => <div className="admin-list-row" key={painting.id}><img src={painting.imageUrl} alt="" /><div><strong>{painting.title}</strong><span>{painting.artist} · {formatMoney(painting.price)}</span></div><StatusBadge value={painting.status} /></div>)}</section><section className="admin-panel"><div className="panel-heading"><h2>Orders</h2><span>{data.orders.length}</span></div>{data.orders.length ? data.orders.map((order) => <div className="admin-list-row plain" key={order.id}><div><strong>{order.title}</strong><span>{order.customerName || order.userId} · {formatMoney(order.priceAtPurchase)}</span></div><StatusBadge value={order.status} /></div>) : <div className="panel-empty">No orders yet.</div>}</section><section className="admin-panel"><div className="panel-heading"><h2>Wall diary</h2><span>{data.bookings.length}</span></div>{data.bookings.length ? data.bookings.map((booking) => <div className="admin-list-row plain" key={booking.id}><div><strong>{booking.bookingDate} · {booking.customerName || booking.userId}</strong><span>{booking.wallSizeSqft} sq ft · {formatMoney(booking.price)}</span></div><div><StatusBadge value={booking.status} />{booking.status === 'requested' && <><button className="small-action" onClick={() => action(`/api/bookings/${booking.id}/confirm`)}>Confirm</button><button className="small-action" onClick={() => action(`/api/bookings/${booking.id}/decline`)}>Decline</button></>}</div></div>) : <div className="panel-empty">No wall requests yet.</div>}</section><section className="admin-panel"><div className="panel-heading"><h2>Pottery queue</h2><span>{data.requests.length}</span></div>{data.requests.length ? data.requests.map((request) => <div className="admin-list-row plain" key={request.id}><div><strong>{request.itemName} · {request.glazeName}</strong><span>{request.customerName || request.userId} · ×{request.quantity} · {request.neededBy}</span></div><div><StatusBadge value={request.status} />{request.status === 'requested' && <><button className="small-action" onClick={() => action(`/api/pottery-requests/${request.id}/accept`)}>Accept</button><button className="small-action" onClick={() => action(`/api/pottery-requests/${request.id}/decline`)}>Decline</button></>}</div></div>) : <div className="panel-empty">No pottery requests yet.</div>}</section></div></StateBlock>{message && <div className="toast notice">{message}</div>}</div>;
}

function App() {
  return <AuthProvider><Shell><Routes><Route path="/" element={<Home />} /><Route path="/paintings" element={<Gallery />} /><Route path="/paintings/:id" element={<Detail />} /><Route path="/wall-painting" element={<WallPainting />} /><Route path="/pottery" element={<Pottery />} /><Route path="/login" element={<AuthPage mode="login" />} /><Route path="/signup" element={<AuthPage mode="signup" />} /><Route path="/account" element={<RequireCustomer><Account /></RequireCustomer>} /><Route path="/admin" element={<RequireAdmin><AdminScreen /></RequireAdmin>} /><Route path="*" element={<NavigateMessage title="That page wandered off." copy="The studio only has a few rooms, but each one has something to make." />} /></Routes></Shell></AuthProvider>;
}
function RequireAdmin({ children }) { const { user, loading } = useAuth(); if (loading) return <div className="page-wrap"><StateBlock loading /></div>; if (!user) return <NavigateMessage title="The studio desk is private." copy="Log in with the seeded admin account to manage Rangrez." />; if (user.role !== 'admin') return <NavigateMessage title="The studio desk is private." copy="This view is only for the Rangrez admin." />; return children; }

createRoot(document.getElementById('root')).render(<BrowserRouter><App /></BrowserRouter>);
