import React, { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import axios from 'axios';

const Admin = () => {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({
    title: '',
    description: '',
    category: 'Politics',
    subCategory: 'All',
    endDate: '',
    options: 'Yes,No',
    image: '',
    // category specifics
    cryptoName: '',
    cryptoLogo: '',
    team1Name: '',
    team1Logo: '',
    team1Odds: '',
    team2Name: '',
    team2Logo: '',
    team2Odds: '',
    matchTime: '',
    sportType: '',
    country: '',
    countryFlag: '',
    candidates: '' // name|percentage|image per line
  });

  const { data: stats } = useQuery(['admin-dashboard'], async () => (await axios.get('/api/admin/dashboard')).data);
  const { data: polls, isLoading } = useQuery(['admin-polls', page], async () => (await axios.get(`/api/admin/polls?page=${page}&limit=10`)).data);

  const createMutation = useMutation(async () => {
    const payload = {
      title: form.title,
      description: form.description,
      category: form.category,
      subCategory: form.subCategory,
      endDate: form.endDate,
      options: form.options.split(',').map((t) => ({ text: t.trim() })).filter((o) => o.text),
      image: form.image
    };

    if (form.category === 'Crypto') {
      payload.cryptoName = form.cryptoName;
      payload.cryptoLogo = form.cryptoLogo;
    }
    if (form.category === 'Sports') {
      payload.team1 = { name: form.team1Name, logo: form.team1Logo, odds: Number(form.team1Odds) || undefined };
      payload.team2 = { name: form.team2Name, logo: form.team2Logo, odds: Number(form.team2Odds) || undefined };
      payload.matchTime = form.matchTime;
      payload.sportType = form.sportType;
    }
    if (form.category === 'Elections') {
      payload.country = form.country;
      payload.countryFlag = form.countryFlag;
      payload.candidates = form.candidates
        .split('\n')
        .map((line) => {
          const [name, percentage, image] = line.split('|').map((x) => (x || '').trim());
          if (!name) return null;
          return { name, percentage: Number(percentage) || 0, image };
        })
        .filter(Boolean);
    }

    return (await axios.post('/api/polls', payload)).data;
  }, {
    onSuccess: () => {
      setCreating(false);
      setForm({
        title: '', description: '', category: 'Politics', subCategory: 'All', endDate: '', options: 'Yes,No', image: '',
        cryptoName: '', cryptoLogo: '', team1Name: '', team1Logo: '', team1Odds: '', team2Name: '', team2Logo: '', team2Odds: '', matchTime: '', sportType: '', country: '', countryFlag: '', candidates: ''
      });
      queryClient.invalidateQueries(['admin-polls']);
    }
  });

  const deleteMutation = useMutation(async (id) => (await axios.delete(`/api/admin/polls/${id}`)).data, {
    onSuccess: () => queryClient.invalidateQueries(['admin-polls'])
  });

  const [editingPoll, setEditingPoll] = useState(null);
  const [resolvingPoll, setResolvingPoll] = useState(null);
  const [resolveIndex, setResolveIndex] = useState('');
  const updateMutation = useMutation(async ({ id, data }) => (await axios.put(`/api/admin/polls/${id}`, data)).data, {
    onSuccess: () => {
      setEditingPoll(null);
      queryClient.invalidateQueries(['admin-polls']);
    }
  });
  const resolveMutation = useMutation(async ({ id, winningOption }) => (await axios.post(`/api/admin/polls/${id}/resolve`, { winningOption })).data, {
    onSuccess: () => {
      setResolvingPoll(null);
      queryClient.invalidateQueries(['admin-polls']);
    }
  });

  const categories = useMemo(() => ['Politics', 'Middle East', 'Crypto', 'Tech', 'Culture', 'World', 'Economy', 'Sports', 'Elections'], []);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Admin Dashboard</h1>
          <button onClick={() => setCreating(true)} className="btn-primary">Create Poll</button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-4">
            <div className="text-sm text-gray-500">Users</div>
            <div className="text-2xl font-semibold text-gray-900 dark:text-gray-100">{stats?.totalUsers ?? '-'}</div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg p-4">
            <div className="text-sm text-gray-500">Polls</div>
            <div className="text-2xl font-semibold text-gray-900 dark:text-gray-100">{stats?.totalPolls ?? '-'}</div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg p-4">
            <div className="text-sm text-gray-500">Active Polls</div>
            <div className="text-2xl font-semibold text-gray-900 dark:text-gray-100">{stats?.activePolls ?? '-'}</div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg p-4">
            <div className="text-sm text-gray-500">Volume</div>
            <div className="text-2xl font-semibold text-gray-900 dark:text-gray-100">${(stats?.totalVolume || 0).toLocaleString()}</div>
          </div>
        </div>

        {/* Polls table */}
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 dark:text-gray-400">
                  <th className="py-2 pr-4">Title</th>
                  <th className="py-2 pr-4">Category</th>
                  <th className="py-2 pr-4">End</th>
                  <th className="py-2 pr-4">Active</th>
                  <th className="py-2 pr-4">Actions</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr><td className="py-6" colSpan="5">Loading...</td></tr>
                ) : (polls?.polls || []).map((p) => (
                  <tr key={p._id} className="border-t border-gray-100 dark:border-gray-700">
                    <td className="py-2 pr-4 text-gray-900 dark:text-gray-100">{p.title}</td>
                    <td className="py-2 pr-4 text-gray-700 dark:text-gray-300">{p.category}</td>
                    <td className="py-2 pr-4 text-gray-700 dark:text-gray-300">{new Date(p.endDate).toLocaleString()}</td>
                    <td className="py-2 pr-4">{p.isActive ? 'Yes' : 'No'}</td>
                    <td className="py-2 pr-4 flex gap-2">
                      <button onClick={() => setEditingPoll(p)} className="btn-outline btn-sm">Edit</button>
                      {!p.isResolved && <button onClick={() => { setResolvingPoll(p); setResolveIndex(''); }} className="btn-primary btn-sm">Resolve</button>}
                      <button onClick={() => deleteMutation.mutate(p._id)} className="btn-danger btn-sm">Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex justify-end mt-4 gap-2">
            <button className="btn-outline btn-sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={!polls?.pagination?.hasPrev}>Prev</button>
            <button className="btn-outline btn-sm" onClick={() => setPage((p) => p + 1)} disabled={!polls?.pagination?.hasNext}>Next</button>
          </div>
        </div>

        {/* Create modal */}
        {creating && (
          <div className="modal-overlay" onClick={() => setCreating(false)}>
            <div className="modal-content max-w-2xl" onClick={(e) => e.stopPropagation()}>
              <div className="p-6">
                <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-4">Create Poll</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="md:col-span-2">
                    <label className="block text-sm text-gray-600 dark:text-gray-300 mb-1">Title</label>
                    <input className="input w-full" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm text-gray-600 dark:text-gray-300 mb-1">Description</label>
                    <textarea className="input w-full h-24" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-600 dark:text-gray-300 mb-1">Category</label>
                    <select className="input w-full" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                      {categories.map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm text-gray-600 dark:text-gray-300 mb-1">Sub-category</label>
                    <input className="input w-full" value={form.subCategory} onChange={(e) => setForm({ ...form, subCategory: e.target.value })} />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-600 dark:text-gray-300 mb-1">End Date</label>
                    <input type="datetime-local" className="input w-full" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-600 dark:text-gray-300 mb-1">Options (comma separated)</label>
                    <input className="input w-full" value={form.options} onChange={(e) => setForm({ ...form, options: e.target.value })} />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm text-gray-600 dark:text-gray-300 mb-1">Image URL</label>
                    <input className="input w-full" value={form.image} onChange={(e) => setForm({ ...form, image: e.target.value })} />
                  </div>

                  {/* Crypto specifics */}
                  {form.category === 'Crypto' && (
                    <>
                      <div>
                        <label className="block text-sm text-gray-600 dark:text-gray-300 mb-1">Crypto Name</label>
                        <input className="input w-full" value={form.cryptoName} onChange={(e) => setForm({ ...form, cryptoName: e.target.value })} />
                      </div>
                      <div>
                        <label className="block text-sm text-gray-600 dark:text-gray-300 mb-1">Crypto Logo URL</label>
                        <input className="input w-full" value={form.cryptoLogo} onChange={(e) => setForm({ ...form, cryptoLogo: e.target.value })} />
                      </div>
                    </>
                  )}

                  {/* Sports specifics */}
                  {form.category === 'Sports' && (
                    <>
                      <div>
                        <label className="block text-sm text-gray-600 dark:text-gray-300 mb-1">Team 1 Name</label>
                        <input className="input w-full" value={form.team1Name} onChange={(e) => setForm({ ...form, team1Name: e.target.value })} />
                      </div>
                      <div>
                        <label className="block text-sm text-gray-600 dark:text-gray-300 mb-1">Team 1 Logo</label>
                        <input className="input w-full" value={form.team1Logo} onChange={(e) => setForm({ ...form, team1Logo: e.target.value })} />
                      </div>
                      <div>
                        <label className="block text-sm text-gray-600 dark:text-gray-300 mb-1">Team 1 Odds</label>
                        <input className="input w-full" value={form.team1Odds} onChange={(e) => setForm({ ...form, team1Odds: e.target.value })} />
                      </div>
                      <div>
                        <label className="block text-sm text-gray-600 dark:text-gray-300 mb-1">Team 2 Name</label>
                        <input className="input w-full" value={form.team2Name} onChange={(e) => setForm({ ...form, team2Name: e.target.value })} />
                      </div>
                      <div>
                        <label className="block text-sm text-gray-600 dark:text-gray-300 mb-1">Team 2 Logo</label>
                        <input className="input w-full" value={form.team2Logo} onChange={(e) => setForm({ ...form, team2Logo: e.target.value })} />
                      </div>
                      <div>
                        <label className="block text-sm text-gray-600 dark:text-gray-300 mb-1">Team 2 Odds</label>
                        <input className="input w-full" value={form.team2Odds} onChange={(e) => setForm({ ...form, team2Odds: e.target.value })} />
                      </div>
                      <div>
                        <label className="block text-sm text-gray-600 dark:text-gray-300 mb-1">Match Time</label>
                        <input type="datetime-local" className="input w-full" value={form.matchTime} onChange={(e) => setForm({ ...form, matchTime: e.target.value })} />
                      </div>
                      <div>
                        <label className="block text-sm text-gray-600 dark:text-gray-300 mb-1">Sport Type</label>
                        <input className="input w-full" value={form.sportType} onChange={(e) => setForm({ ...form, sportType: e.target.value })} />
                      </div>
                    </>
                  )}

                  {/* Elections specifics */}
                  {form.category === 'Elections' && (
                    <>
                      <div>
                        <label className="block text-sm text-gray-600 dark:text-gray-300 mb-1">Country</label>
                        <input className="input w-full" value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} />
                      </div>
                      <div>
                        <label className="block text-sm text-gray-600 dark:text-gray-300 mb-1">Country Flag URL</label>
                        <input className="input w-full" value={form.countryFlag} onChange={(e) => setForm({ ...form, countryFlag: e.target.value })} />
                      </div>
                      <div className="md:col-span-2">
                        <label className="block text-sm text-gray-600 dark:text-gray-300 mb-1">Candidates (one per line: name|percentage|image)</label>
                        <textarea className="input w-full h-24" value={form.candidates} onChange={(e) => setForm({ ...form, candidates: e.target.value })} />
                      </div>
                    </>
                  )}
                </div>
                <div className="flex justify-end gap-2 mt-6">
                  <button className="btn-outline" onClick={() => setCreating(false)}>Cancel</button>
                  <button className="btn-primary" onClick={() => createMutation.mutate()} disabled={createMutation.isLoading}>Create</button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Edit modal */}
        {editingPoll && (
          <div className="modal-overlay" onClick={() => setEditingPoll(null)}>
            <div className="modal-content max-w-2xl" onClick={(e) => e.stopPropagation()}>
              <div className="p-6">
                <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-4">Edit Poll</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="md:col-span-2">
                    <label className="block text-sm text-gray-600 dark:text-gray-300 mb-1">Title</label>
                    <input className="input w-full" value={editingPoll.title || ''} onChange={(e) => setEditingPoll({ ...editingPoll, title: e.target.value })} />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm text-gray-600 dark:text-gray-300 mb-1">Description</label>
                    <textarea className="input w-full h-24" value={editingPoll.description || ''} onChange={(e) => setEditingPoll({ ...editingPoll, description: e.target.value })} />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-600 dark:text-gray-300 mb-1">Featured</label>
                    <label className="inline-flex items-center gap-2"><input type="checkbox" checked={!!editingPoll.featured} onChange={(e) => setEditingPoll({ ...editingPoll, featured: e.target.checked })} /> <span className="text-sm text-gray-700 dark:text-gray-300">Mark as featured</span></label>
                  </div>
                  <div>
                    <label className="block text-sm text-gray-600 dark:text-gray-300 mb-1">Trending</label>
                    <label className="inline-flex items-center gap-2"><input type="checkbox" checked={!!editingPoll.trending} onChange={(e) => setEditingPoll({ ...editingPoll, trending: e.target.checked })} /> <span className="text-sm text-gray-700 dark:text-gray-300">Mark as trending</span></label>
                  </div>
                  <div>
                    <label className="block text-sm text-gray-600 dark:text-gray-300 mb-1">Sub-category</label>
                    <input className="input w-full" value={editingPoll.subCategory || ''} onChange={(e) => setEditingPoll({ ...editingPoll, subCategory: e.target.value })} />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-600 dark:text-gray-300 mb-1">End Date</label>
                    <input type="datetime-local" className="input w-full" value={editingPoll.endDate ? new Date(editingPoll.endDate).toISOString().slice(0,16) : ''} onChange={(e) => setEditingPoll({ ...editingPoll, endDate: e.target.value })} />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm text-gray-600 dark:text-gray-300 mb-1">Image URL</label>
                    <input className="input w-full" value={editingPoll.image || ''} onChange={(e) => setEditingPoll({ ...editingPoll, image: e.target.value })} />
                  </div>

                  {/* Crypto */}
                  {editingPoll.category === 'Crypto' && (
                    <>
                      <div>
                        <label className="block text-sm text-gray-600 dark:text-gray-300 mb-1">Crypto Name</label>
                        <input className="input w-full" value={editingPoll.cryptoName || ''} onChange={(e) => setEditingPoll({ ...editingPoll, cryptoName: e.target.value })} />
                      </div>
                      <div>
                        <label className="block text-sm text-gray-600 dark:text-gray-300 mb-1">Crypto Logo</label>
                        <input className="input w-full" value={editingPoll.cryptoLogo || ''} onChange={(e) => setEditingPoll({ ...editingPoll, cryptoLogo: e.target.value })} />
                      </div>
                    </>
                  )}

                  {/* Sports */}
                  {editingPoll.category === 'Sports' && (
                    <>
                      <div>
                        <label className="block text-sm text-gray-600 dark:text-gray-300 mb-1">Team 1 Name</label>
                        <input className="input w-full" value={editingPoll.team1?.name || ''} onChange={(e) => setEditingPoll({ ...editingPoll, team1: { ...(editingPoll.team1 || {}), name: e.target.value } })} />
                      </div>
                      <div>
                        <label className="block text-sm text-gray-600 dark:text-gray-300 mb-1">Team 1 Logo</label>
                        <input className="input w-full" value={editingPoll.team1?.logo || ''} onChange={(e) => setEditingPoll({ ...editingPoll, team1: { ...(editingPoll.team1 || {}), logo: e.target.value } })} />
                      </div>
                      <div>
                        <label className="block text-sm text-gray-600 dark:text-gray-300 mb-1">Team 1 Odds</label>
                        <input className="input w-full" value={editingPoll.team1?.odds ?? ''} onChange={(e) => setEditingPoll({ ...editingPoll, team1: { ...(editingPoll.team1 || {}), odds: e.target.value } })} />
                      </div>
                      <div>
                        <label className="block text-sm text-gray-600 dark:text-gray-300 mb-1">Team 2 Name</label>
                        <input className="input w-full" value={editingPoll.team2?.name || ''} onChange={(e) => setEditingPoll({ ...editingPoll, team2: { ...(editingPoll.team2 || {}), name: e.target.value } })} />
                      </div>
                      <div>
                        <label className="block text-sm text-gray-600 dark:text-gray-300 mb-1">Team 2 Logo</label>
                        <input className="input w-full" value={editingPoll.team2?.logo || ''} onChange={(e) => setEditingPoll({ ...editingPoll, team2: { ...(editingPoll.team2 || {}), logo: e.target.value } })} />
                      </div>
                      <div>
                        <label className="block text-sm text-gray-600 dark:text-gray-300 mb-1">Team 2 Odds</label>
                        <input className="input w-full" value={editingPoll.team2?.odds ?? ''} onChange={(e) => setEditingPoll({ ...editingPoll, team2: { ...(editingPoll.team2 || {}), odds: e.target.value } })} />
                      </div>
                      <div>
                        <label className="block text-sm text-gray-600 dark:text-gray-300 mb-1">Match Time</label>
                        <input type="datetime-local" className="input w-full" value={editingPoll.matchTime ? new Date(editingPoll.matchTime).toISOString().slice(0,16) : ''} onChange={(e) => setEditingPoll({ ...editingPoll, matchTime: e.target.value })} />
                      </div>
                      <div>
                        <label className="block text-sm text-gray-600 dark:text-gray-300 mb-1">Sport Type</label>
                        <input className="input w-full" value={editingPoll.sportType || ''} onChange={(e) => setEditingPoll({ ...editingPoll, sportType: e.target.value })} />
                      </div>
                    </>
                  )}

                  {/* Elections */}
                  {editingPoll.category === 'Elections' && (
                    <>
                      <div>
                        <label className="block text-sm text-gray-600 dark:text-gray-300 mb-1">Country</label>
                        <input className="input w-full" value={editingPoll.country || ''} onChange={(e) => setEditingPoll({ ...editingPoll, country: e.target.value })} />
                      </div>
                      <div>
                        <label className="block text-sm text-gray-600 dark:text-gray-300 mb-1">Country Flag</label>
                        <input className="input w-full" value={editingPoll.countryFlag || ''} onChange={(e) => setEditingPoll({ ...editingPoll, countryFlag: e.target.value })} />
                      </div>
                    </>
                  )}
                </div>
                {/* Options editor */}
                <div className="md:col-span-2 mt-2">
                  <label className="block text-sm text-gray-600 dark:text-gray-300 mb-2">Options</label>
                  <div className="space-y-2">
                    {(editingPoll.options || []).map((opt, idx) => (
                      <div key={idx} className="grid grid-cols-7 gap-2 items-center">
                        <input className="input col-span-3" value={opt.text} onChange={(e) => {
                          const updated = [...editingPoll.options];
                          updated[idx] = { ...updated[idx], text: e.target.value };
                          setEditingPoll({ ...editingPoll, options: updated });
                        }} />
                        <input className="input col-span-2" type="number" min="0" max="100" value={opt.percentage ?? 0} onChange={(e) => {
                          const updated = [...editingPoll.options];
                          updated[idx] = { ...updated[idx], percentage: Number(e.target.value) };
                          setEditingPoll({ ...editingPoll, options: updated });
                        }} />
                        <input className="input col-span-2" placeholder="Image URL (optional)" value={opt.image || ''} onChange={(e) => {
                          const updated = [...editingPoll.options];
                          updated[idx] = { ...updated[idx], image: e.target.value };
                          setEditingPoll({ ...editingPoll, options: updated });
                        }} />
                      </div>
                    ))}
                    <div className="flex gap-2">
                      <button className="btn-outline btn-sm" onClick={() => setEditingPoll({ ...editingPoll, options: [...(editingPoll.options || []), { text: 'New Option', percentage: 0 }] })}>Add Option</button>
                      <button className="btn-outline btn-sm" onClick={() => setEditingPoll({ ...editingPoll, options: (editingPoll.options || []).slice(0, -1) })} disabled={!editingPoll.options || editingPoll.options.length <= 2}>Remove Last</button>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end gap-2 mt-6 md:col-span-2">
                  <button className="btn-outline" onClick={() => setEditingPoll(null)}>Cancel</button>
                  <button className="btn-primary" onClick={() => updateMutation.mutate({ id: editingPoll._id, data: editingPoll })} disabled={updateMutation.isLoading}>Save</button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Resolve modal */}
        {resolvingPoll && (
          <div className="modal-overlay" onClick={() => setResolvingPoll(null)}>
            <div className="modal-content max-w-md" onClick={(e) => e.stopPropagation()}>
              <div className="p-6">
                <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-4">Resolve Poll</h2>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">Choose winning option index (0 - {Math.max(0, (resolvingPoll.options?.length || 1) - 1)})</p>
                <input className="input w-full" type="number" min="0" max={(resolvingPoll.options?.length || 1) - 1} value={resolveIndex} onChange={(e) => setResolveIndex(e.target.value)} />
                <div className="flex justify-end gap-2 mt-6">
                  <button className="btn-outline" onClick={() => setResolvingPoll(null)}>Cancel</button>
                  <button className="btn-primary" onClick={() => resolveMutation.mutate({ id: resolvingPoll._id, winningOption: Number(resolveIndex) })} disabled={resolveMutation.isLoading || resolveIndex === ''}>Resolve</button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Admin;
