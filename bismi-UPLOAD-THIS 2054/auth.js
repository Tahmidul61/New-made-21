// ═══════════════════════════════════════════════════════════
// BISMI TREATS — auth.js  (Profile & Session Management)
// ═══════════════════════════════════════════════════════════

const AUTH = {
  defaultProfiles: [
    { id: 'admin-1', name: 'Tahmidul', role: 'admin', pin: '78674233', active: true, createdAt: new Date().toISOString() },
    { id: 'counter-1', name: 'Counter', role: 'counter', pin: '1234', active: true, createdAt: new Date().toISOString() },
    { id: 'kitchen-1', name: 'Kitchen', role: 'kitchen', pin: '1234', active: true, createdAt: new Date().toISOString() },
    { id: 'delivery-1', name: 'Delivery', role: 'delivery', pin: '1234', active: true, createdAt: new Date().toISOString() },
  ],
  ROLES: {
    admin:    { label: 'Admin',    icon: '👑', color: '#b5845a' },
    counter:  { label: 'Counter',  icon: '🧾', color: '#5a85b0' },
    kitchen:  { label: 'Kitchen',  icon: '👨‍🍳', color: '#6a9e6a' },
    delivery: { label: 'Delivery', icon: '🚚', color: '#c9853a' },
  },
  AUTO_LOGOUT_MINUTES: 30,
  MAX_ATTEMPTS: 3,
  LOCKOUT_MINUTES: 5,

  getProfiles() {
    try {
      const stored = localStorage.getItem('bismiProfiles');
      if (stored) return JSON.parse(stored);
      this.saveProfiles(this.defaultProfiles);
      return JSON.parse(JSON.stringify(this.defaultProfiles));
    } catch { return JSON.parse(JSON.stringify(this.defaultProfiles)); }
  },
  saveProfiles(profiles) { localStorage.setItem('bismiProfiles', JSON.stringify(profiles)); },
  getSession() { try { return JSON.parse(sessionStorage.getItem('bismiSession') || 'null'); } catch { return null; } },
  saveSession(session) { sessionStorage.setItem('bismiSession', JSON.stringify(session)); },
  clearSession() { sessionStorage.removeItem('bismiSession'); },

  getAttempts(profileId) {
    try { return JSON.parse(localStorage.getItem('bismiAttempts_' + profileId) || '{"count":0,"lockedUntil":null}'); } catch { return { count: 0, lockedUntil: null }; }
  },
  saveAttempts(profileId, data) { localStorage.setItem('bismiAttempts_' + profileId, JSON.stringify(data)); },
  resetAttempts(profileId) { localStorage.removeItem('bismiAttempts_' + profileId); },
  isLocked(profileId) {
    const attempts = this.getAttempts(profileId);
    if (attempts.lockedUntil && new Date() < new Date(attempts.lockedUntil)) {
      const remaining = Math.ceil((new Date(attempts.lockedUntil) - new Date()) / 1000 / 60);
      return { locked: true, remaining };
    }
    return { locked: false };
  },
  recordFailedAttempt(profileId) {
    const attempts = this.getAttempts(profileId);
    attempts.count = (attempts.count || 0) + 1;
    if (attempts.count >= this.MAX_ATTEMPTS) {
      attempts.lockedUntil = new Date(Date.now() + this.LOCKOUT_MINUTES * 60 * 1000).toISOString();
      attempts.count = 0;
    }
    this.saveAttempts(profileId, attempts);
    return attempts;
  },

  login(profileId, pin) {
    const profiles = this.getProfiles();
    const profile = profiles.find(p => p.id === profileId && p.active);
    if (!profile) return { success: false, error: 'Perfil não encontrado' };
    const lockStatus = this.isLocked(profileId);
    if (lockStatus.locked) return { success: false, error: `Bloqueado por ${lockStatus.remaining} min. Demasiadas tentativas.` };
    if (profile.pin !== pin) {
      const attempts = this.recordFailedAttempt(profileId);
      if (attempts.lockedUntil) return { success: false, error: `PIN incorreto. Bloqueado por ${this.LOCKOUT_MINUTES} minutos.` };
      const remaining = this.MAX_ATTEMPTS - (attempts.count || 0);
      return { success: false, error: `PIN incorreto. ${remaining} tentativa(s) restante(s).` };
    }
    this.resetAttempts(profileId);
    const session = { profileId: profile.id, name: profile.name, role: profile.role, loginAt: new Date().toISOString(), lastActivity: new Date().toISOString() };
    this.saveSession(session);
    this.logActivity({ type: 'login', profileId: profile.id, profileName: profile.name, role: profile.role, details: 'Sessão iniciada' });
    const history = this.getLoginHistory();
    history.push({ profileId: profile.id, profileName: profile.name, role: profile.role, loginAt: session.loginAt, logoutAt: null });
    localStorage.setItem('bismiLoginHistory', JSON.stringify(history));
    return { success: true, session };
  },

  logout() {
    const session = this.getSession();
    if (session) {
      this.logActivity({ type: 'logout', profileId: session.profileId, profileName: session.name, role: session.role, details: 'Sessão terminada' });
      const history = this.getLoginHistory();
      const last = [...history].reverse().find(h => h.profileId === session.profileId && !h.logoutAt);
      if (last) { last.logoutAt = new Date().toISOString(); localStorage.setItem('bismiLoginHistory', JSON.stringify(history)); }
    }
    this.clearSession();
  },

  checkSession() {
    const session = this.getSession();
    if (!session) return null;
    if (session.role !== 'admin') {
      const diffMinutes = (new Date() - new Date(session.lastActivity)) / 1000 / 60;
      if (diffMinutes > this.AUTO_LOGOUT_MINUTES) { this.logout(); return null; }
    }
    session.lastActivity = new Date().toISOString();
    this.saveSession(session);
    return session;
  },
  updateActivity() { const s = this.getSession(); if (s) { s.lastActivity = new Date().toISOString(); this.saveSession(s); } },

  logActivity(entry) {
    try {
      const log = JSON.parse(localStorage.getItem('bismiActivityLog') || '[]');
      log.push({ ...entry, timestamp: new Date().toISOString(), id: Date.now() });
      if (log.length > 2000) log.splice(0, log.length - 2000);
      localStorage.setItem('bismiActivityLog', JSON.stringify(log));
    } catch (e) {}
  },
  logOrderActivity(orderId, orderRef, action, details, session) {
    if (!session) session = this.getSession();
    if (!session) return;
    this.logActivity({ type: 'order', orderId, orderRef, action, details, profileId: session.profileId, profileName: session.name, role: session.role });
    try {
      const key = 'bismiOrderHistory_' + orderId;
      const h = JSON.parse(localStorage.getItem(key) || '[]');
      h.push({ action, details, profileId: session.profileId, profileName: session.name, role: session.role, timestamp: new Date().toISOString() });
      localStorage.setItem(key, JSON.stringify(h));
    } catch (e) {}
  },
  getActivityLog() { try { return JSON.parse(localStorage.getItem('bismiActivityLog') || '[]'); } catch { return []; } },
  getOrderHistory(orderId) { try { return JSON.parse(localStorage.getItem('bismiOrderHistory_' + orderId) || '[]'); } catch { return []; } },
  getLoginHistory() { try { return JSON.parse(localStorage.getItem('bismiLoginHistory') || '[]'); } catch { return []; } },

  can(action, session) {
    if (!session) return false;
    const permissions = {
      admin:    ['all'],
      counter:  ['view_orders','add_order','edit_order','change_status','print','whatsapp','view_requests','insert_request','add_photo','view_photos','priority_flag','view_calendar','view_all_orders','view_remaining'],
      kitchen:  ['view_orders','change_status_no_deliver','view_photos','upload_ready_photo','view_calendar'],
      delivery: ['view_ready_orders','mark_delivered'],
    };
    const perms = permissions[session.role] || [];
    return perms.includes('all') || perms.includes(action);
  },

  addProfile(name, role, pin) {
    const profiles = this.getProfiles();
    const id = role + '-' + Date.now();
    profiles.push({ id, name, role, pin, active: true, createdAt: new Date().toISOString() });
    this.saveProfiles(profiles);
    return id;
  },
  updateProfile(id, updates) {
    const profiles = this.getProfiles();
    const idx = profiles.findIndex(p => p.id === id);
    if (idx >= 0) { profiles[idx] = { ...profiles[idx], ...updates }; this.saveProfiles(profiles); return true; }
    return false;
  },
  deleteProfile(id) { this.saveProfiles(this.getProfiles().filter(p => p.id !== id)); },
  getProfilesByRole(role) { return this.getProfiles().filter(p => p.role === role && p.active); },
};