import React, { useEffect, useState } from 'react';
import { api, formatMoney } from './api.js';

function StatusBadge({ value }) {
  return <span className={`status status-${value}`}>{value}</span>;
}

function DataState({ loading, error, children }) {
  if (loading) return <div className="state-block"><span className="spinner" /> Loading the studio desk…</div>;
  if (error) return <div className="state-block state-error"><strong>We hit a rough edge.</strong><span>{error}</span></div>;
  return children;
}

const blankPainting = { id: '', title: '', artist: '', description: '', price: '', imageUrl: '/images/p-001.jpg', status: 'available' };

export default function AdminScreen() {
  const [data, setData] = useState({ paintings: [], orders: [], bookings: [], requests: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [form, setForm] = useState(blankPainting);
  const [editingId, setEditingId] = useState('');

  const load = () => {
    setLoading(true);
    setError('');
    Promise.all([api('/api/paintings'), api('/api/orders'), api('/api/bookings'), api('/api/pottery-requests')])
      .then(([paintings, orders, bookings, requests]) => setData({ paintings: paintings.paintings, orders: orders.orders, bookings: bookings.bookings, requests: requests.requests }))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  function editPainting(painting) {
    setEditingId(painting.id);
    setForm({ id: painting.id, title: painting.title, artist: painting.artist, description: painting.description, price: painting.price, imageUrl: painting.imageUrl, status: painting.status });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function savePainting(event) {
    event.preventDefault();
    try {
      const path = editingId ? `/api/paintings/${editingId}` : '/api/paintings';
      const method = editingId ? 'PATCH' : 'POST';
      await api(path, { method, body: JSON.stringify({ ...form, price: Number(form.price) }) });
      setMessage(editingId ? 'Painting details updated.' : 'Painting added to the collection.');
      setEditingId('');
      setForm(blankPainting);
      load();
    } catch (err) {
      setMessage(err.message);
    }
  }

  async function action(path) {
    try {
      const result = await api(path, { method: 'POST' });
      setMessage(result.message);
      load();
    } catch (err) {
      setMessage(err.message);
    }
  }

  return <div className="page-wrap admin-page">
    <div className="page-intro compact"><span className="eyebrow">Private view / studio desk</span><h1>Keep the<br /><em>work moving.</em></h1><p>Manage the collection, then give each request the considered yes or no it deserves.</p></div>
    <DataState loading={loading} error={error}>
      <div className="admin-grid">
        <form className="studio-form admin-form" onSubmit={savePainting}>
          <span className="eyebrow">{editingId ? 'Edit an available work' : 'Add a work'}</span><h2>{editingId ? 'Refine painting' : 'New painting'}</h2>
          <label>ID<input value={form.id} disabled={Boolean(editingId)} onChange={(e) => setForm({ ...form, id: e.target.value })} placeholder="p-013" required /></label>
          <label>Title<input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required /></label>
          <label>Artist<input value={form.artist} onChange={(e) => setForm({ ...form, artist: e.target.value })} required /></label>
          <label>Description<textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} required /></label>
          <label>Price<input type="number" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} required /></label>
          <label>Image URL<input value={form.imageUrl} onChange={(e) => setForm({ ...form, imageUrl: e.target.value })} required /></label>
          <div className="form-actions"><button className="button button-dark">{editingId ? 'Save painting ↗' : 'Add painting ↗'}</button>{editingId && <button type="button" className="text-button" onClick={() => { setEditingId(''); setForm(blankPainting); }}>Cancel edit</button>}</div>
        </form>
        <section className="admin-panel"><div className="panel-heading"><h2>Collection</h2><span>{data.paintings.length} works</span></div>{data.paintings.length ? data.paintings.map((painting) => <div className="admin-list-row" key={painting.id}><img src={painting.imageUrl} alt="" /><div><strong>{painting.title}</strong><span>{painting.artist} · {formatMoney(painting.price)}</span></div><div><StatusBadge value={painting.status} />{painting.status === 'available' && <button className="small-action" onClick={() => editPainting(painting)}>Edit</button>}</div></div>) : <div className="panel-empty">No paintings yet.</div>}</section>
        <section className="admin-panel"><div className="panel-heading"><h2>Orders</h2><span>{data.orders.length}</span></div>{data.orders.length ? data.orders.map((order) => <div className="admin-list-row plain" key={order.id}><div><strong>{order.title || order.paintingId}</strong><span>{order.customerName || order.userId} · {formatMoney(order.priceAtPurchase)}</span></div><StatusBadge value={order.status} /></div>) : <div className="panel-empty">No orders yet.</div>}</section>
        <section className="admin-panel"><div className="panel-heading"><h2>Wall diary</h2><span>{data.bookings.length}</span></div>{data.bookings.length ? data.bookings.map((booking) => <div className="admin-list-row plain" key={booking.id}><div><strong>{booking.bookingDate} · {booking.customerName || booking.userId}</strong><span>{booking.wallSizeSqft} sq ft · {formatMoney(booking.price)}</span></div><div><StatusBadge value={booking.status} />{booking.status === 'requested' && <><button className="small-action" onClick={() => action(`/api/bookings/${booking.id}/confirm`)}>Confirm</button><button className="small-action" onClick={() => action(`/api/bookings/${booking.id}/decline`)}>Decline</button></>}</div></div>) : <div className="panel-empty">No wall requests yet.</div>}</section>
        <section className="admin-panel"><div className="panel-heading"><h2>Pottery queue</h2><span>{data.requests.length}</span></div>{data.requests.length ? data.requests.map((request) => <div className="admin-list-row plain" key={request.id}><div><strong>{request.itemName} · {request.glazeName}</strong><span>{request.customerName || request.userId} · ×{request.quantity} · {request.neededBy}</span></div><div><StatusBadge value={request.status} />{request.status === 'requested' && <><button className="small-action" onClick={() => action(`/api/pottery-requests/${request.id}/accept`)}>Accept</button><button className="small-action" onClick={() => action(`/api/pottery-requests/${request.id}/decline`)}>Decline</button></>}</div></div>) : <div className="panel-empty">No pottery requests yet.</div>}</section>
      </div>
    </DataState>
    {message && <div className="toast notice">{message}</div>}
  </div>;
}
