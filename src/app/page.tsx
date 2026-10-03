"use client";

import { FormEvent, Fragment, useCallback, useEffect, useMemo, useState } from "react";

const API_URL = "/api";
const TOKEN_KEY = "voucher-dashboard-token";

type ApiRecord = Record<string, unknown>;

type Voucher = {
  id: string;
  code: string;
  title: string;
  description: string;
  valueAmount: string;
  pointsCost: string;
  isActive: boolean;
};

type VoucherForm = Omit<Voucher, "id">;

type RedeemedVoucher = {
  redemptionId: string;
  voucherId: string;
  code: string;
  title: string;
  valueAmount: string;
  pointsSpent: string;
  redeemedAt: string;
};

type AdminUser = {
  id: string;
  name: string;
  email: string;
  role: string;
  createdAt: string;
  scoreTotal: string;
  redeemedVoucherCount: number;
  redeemedVouchers: RedeemedVoucher[];
};

const emptyForm: VoucherForm = {
  code: "",
  title: "",
  description: "",
  valueAmount: "",
  pointsCost: "",
  isActive: true,
};

async function apiRequest(path: string, token?: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  if (init.body) headers.set("Content-Type", "application/json");
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const response = await fetch(`${API_URL}${path}`, { ...init, headers });
  const text = await response.text();
  let result: unknown = null;

  if (text) {
    try {
      result = JSON.parse(text);
    } catch {
      result = text;
    }
  }

  if (!response.ok) {
    const body = asRecord(result);
    const message =
      typeof body.message === "string"
        ? body.message
        : typeof body.error === "string"
          ? body.error
          : `Permintaan gagal (${response.status}).`;
    throw new Error(message);
  }

  return result;
}

function asRecord(value: unknown): ApiRecord {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as ApiRecord)
    : {};
}

function valueOf(record: ApiRecord, keys: string[], fallback = "") {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" || typeof value === "number") {
      return String(value);
    }
  }
  return fallback;
}

function getToken(response: unknown) {
  const root = asRecord(response);
  const data = asRecord(root.data);
  const token =
    root.token ??
    root.accessToken ??
    root.access_token ??
    data.token ??
    data.accessToken ??
    data.access_token;
  return typeof token === "string" ? token : "";
}

function normalizeVoucher(value: unknown, index: number): Voucher {
  const item = asRecord(value);
  const active = item.is_active ?? item.isActive;
  return {
    id: valueOf(item, ["id", "_id", "voucherId"], String(index)),
    code: valueOf(item, ["code", "voucherCode", "kode"]),
    title: valueOf(item, ["title"], "Voucher tanpa nama"),
    description: valueOf(item, ["description", "desc"]),
    valueAmount: valueOf(item, ["value_amount", "valueAmount"]),
    pointsCost: valueOf(item, ["points_cost", "pointsCost"]),
    isActive: active === true || active === 1 || active === "true",
  };
}

function normalizeVouchers(response: unknown): Voucher[] {
  const root = asRecord(response);
  const data = asRecord(root.data);
  const items = Array.isArray(response)
    ? response
    : Array.isArray(root.vouchers)
      ? root.vouchers
      : Array.isArray(root.data)
        ? root.data
        : Array.isArray(data.vouchers)
          ? data.vouchers
          : null;

  if (!items) {
    throw new Error("Format data voucher dari server tidak dikenali.");
  }
  return items.map(normalizeVoucher);
}

function normalizeRedeemedVoucher(value: unknown, index: number): RedeemedVoucher {
  const item = asRecord(value);
  return {
    redemptionId: valueOf(item, ["redemption_id", "redemptionId"], String(index)),
    voucherId: valueOf(item, ["voucher_id", "voucherId"]),
    code: valueOf(item, ["code"]),
    title: valueOf(item, ["title"], "Voucher"),
    valueAmount: valueOf(item, ["value_amount", "valueAmount"]),
    pointsSpent: valueOf(item, ["points_spent", "pointsSpent"]),
    redeemedAt: valueOf(item, ["redeemed_at", "redeemedAt"]),
  };
}

function normalizeUsers(response: unknown): AdminUser[] {
  const root = asRecord(response);
  if (!Array.isArray(root.users)) {
    throw new Error("Format data pengguna dari server tidak dikenali.");
  }

  return root.users.map((value, index) => {
    const item = asRecord(value);
    const redemptions = Array.isArray(item.redeemed_vouchers)
      ? item.redeemed_vouchers
      : Array.isArray(item.redeemedVouchers)
        ? item.redeemedVouchers
        : [];
    const redeemedVoucherCount = Number(
      item.redeemed_voucher_count ?? item.redeemedVoucherCount ?? redemptions.length,
    );
    return {
      id: valueOf(item, ["id"], String(index)),
      name: valueOf(item, ["name"], "Tanpa nama"),
      email: valueOf(item, ["email"]),
      role: valueOf(item, ["role"], "user"),
      createdAt: valueOf(item, ["created_at", "createdAt"]),
      scoreTotal: valueOf(item, ["score_total", "scoreTotal"], "0"),
      redeemedVoucherCount: Number.isFinite(redeemedVoucherCount)
        ? redeemedVoucherCount
        : redemptions.length,
      redeemedVouchers: redemptions.map(normalizeRedeemedVoucher),
    };
  });
}

function formatDate(value: string) {
  const date = new Date(value);
  return value && !Number.isNaN(date.getTime())
    ? date.toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" })
    : "—";
}

function displayName(user: ApiRecord | null) {
  return user
    ? valueOf(user, ["name", "fullName", "username", "email"], "Admin")
    : "Admin";
}

function Icon({
  name,
  size = 20,
}: {
  name: "grid" | "ticket" | "users" | "plus" | "search" | "bell" | "logout" | "edit" | "close" | "arrow" | "spark" | "menu";
  size?: number;
}) {
  const paths: Record<typeof name, React.ReactNode> = {
    grid: <><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /></>,
    ticket: <><path d="M3 8a2 2 0 0 0 0 4v4a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-4a2 2 0 0 1 0-4V6a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2z" /><path d="M13 5v2m0 4v2m0 4v2" /></>,
    users: <><path d="M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="10" cy="7" r="4" /><path d="M20 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /></>,
    plus: <><path d="M12 5v14M5 12h14" /></>,
    search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></>,
    bell: <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" /><path d="M10 21h4" /></>,
    logout: <><path d="M10 17l5-5-5-5m5 5H3" /><path d="M12 3h6a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-6" /></>,
    edit: <><path d="m15 5 4 4M4 20l4-.8L19 8a2.1 2.1 0 0 0-3-3L5 16z" /><path d="M4 20h16" /></>,
    close: <><path d="m18 6-12 12M6 6l12 12" /></>,
    arrow: <><path d="M5 12h14m-7-7 7 7-7 7" /></>,
    spark: <><path d="m12 3 1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z" /><path d="m19 14 .9 2.1L22 17l-2.1.9L19 20l-.9-2.1L16 17l2.1-.9z" /></>,
    menu: <><path d="M4 6h16M4 12h16M4 18h16" /></>,
  };

  return (
    <svg
      aria-hidden="true"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {paths[name]}
    </svg>
  );
}

export default function Home() {
  const [token, setToken] = useState("");
  const [user, setUser] = useState<ApiRecord | null>(null);
  const [vouchers, setVouchers] = useState<Voucher[]>([]);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [activeSection, setActiveSection] = useState<"overview" | "vouchers" | "users">("overview");
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [usersLoaded, setUsersLoaded] = useState(false);
  const [userSearch, setUserSearch] = useState("");
  const [expandedUserId, setExpandedUserId] = useState<string | null>(null);
  const [checkingSession, setCheckingSession] = useState(true);
  const [loadingVouchers, setLoadingVouchers] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [loginError, setLoginError] = useState("");
  const [dashboardError, setDashboardError] = useState("");
  const [notice, setNotice] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingVoucher, setEditingVoucher] = useState<Voucher | null>(null);
  const [form, setForm] = useState<VoucherForm>(emptyForm);

  const loadDashboard = useCallback(async (authToken: string) => {
    setLoadingVouchers(true);
    setDashboardError("");
    try {
      const [profileResponse, voucherResponse, usersResponse] = await Promise.all([
        apiRequest("/me", authToken),
        apiRequest("/admin/vouchers", authToken),
        apiRequest("/admin/users", authToken),
      ]);
      const profile = asRecord(profileResponse);
      setUser(asRecord(profile.data ?? profile.user ?? profile));
      setVouchers(normalizeVouchers(voucherResponse));
      setUsers(normalizeUsers(usersResponse));
      setUsersLoaded(true);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Tidak dapat memuat dashboard.";
      setDashboardError(message);
      if (message.includes("(401)") || message.toLowerCase().includes("unauthorized")) {
        localStorage.removeItem(TOKEN_KEY);
        setToken("");
        setUser(null);
      }
      throw error;
    } finally {
      setLoadingVouchers(false);
      setCheckingSession(false);
    }
  }, []);

  const loadUsers = useCallback(async (authToken: string) => {
    setLoadingUsers(true);
    setDashboardError("");
    try {
      const response = await apiRequest("/admin/users", authToken);
      setUsers(normalizeUsers(response));
      setUsersLoaded(true);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Tidak dapat memuat daftar pengguna.";
      setDashboardError(message);
      if (message.includes("(401)") || message.toLowerCase().includes("unauthorized")) {
        localStorage.removeItem(TOKEN_KEY);
        setToken("");
        setUser(null);
      }
      throw error;
    } finally {
      setLoadingUsers(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    const savedToken = localStorage.getItem(TOKEN_KEY);
    queueMicrotask(() => {
      if (cancelled) return;
      if (!savedToken) {
        setCheckingSession(false);
        return;
      }
      setToken(savedToken);
      void loadDashboard(savedToken).catch(() => undefined);
    });
    return () => {
      cancelled = true;
    };
  }, [loadDashboard]);

  const filteredVouchers = useMemo(() => {
    const query = search.trim().toLowerCase();
    return vouchers.filter((voucher) => {
      const matchesSearch =
        !query ||
        voucher.title.toLowerCase().includes(query) ||
        voucher.code.toLowerCase().includes(query);
      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "active"
          ? voucher.isActive
          : !voucher.isActive);
      return matchesSearch && matchesStatus;
    });
  }, [search, statusFilter, vouchers]);

  const activeCount = vouchers.filter(
    (voucher) => voucher.isActive,
  ).length;
  const totalRedemptions = users.reduce(
    (total, item) => total + item.redeemedVoucherCount,
    0,
  );
  const totalScore = users.reduce(
    (total, item) => total + (Number(item.scoreTotal) || 0),
    0,
  );
  const overviewVouchers = vouchers.slice(0, 5);
  const recentUsers = users.slice(0, 5);

  const filteredUsers = useMemo(() => {
    const query = userSearch.trim().toLowerCase();
    return users.filter(
      (item) =>
        !query ||
        item.name.toLowerCase().includes(query) ||
        item.email.toLowerCase().includes(query) ||
        item.role.toLowerCase().includes(query),
    );
  }, [userSearch, users]);

  async function showUsers() {
    setActiveSection("users");
    if (token && !usersLoaded) {
      await loadUsers(token).catch(() => undefined);
    }
  }

  function showVouchers() {
    setActiveSection("vouchers");
    setDashboardError("");
  }

  function showOverview() {
    setActiveSection("overview");
    setDashboardError("");
  }

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setLoginError("");
    try {
      const result = await apiRequest("/login", undefined, {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      const nextToken = getToken(result);
      if (!nextToken) {
        const response = asRecord(result);
        const data = asRecord(response.data);
        const message =
          typeof response.message === "string"
            ? response.message
            : typeof data.message === "string"
              ? data.message
              : "Token login tidak ditemukan pada respons server.";
        throw new Error(message);
      }
      localStorage.setItem(TOKEN_KEY, nextToken);
      setToken(nextToken);
      setCheckingSession(true);
      await loadDashboard(nextToken);
    } catch (error) {
      setLoginError(
        error instanceof Error ? error.message : "Login gagal. Silakan coba lagi.",
      );
      if (localStorage.getItem(TOKEN_KEY)) {
        localStorage.removeItem(TOKEN_KEY);
        setToken("");
      }
      setCheckingSession(false);
    } finally {
      setSubmitting(false);
    }
  }

  function openCreateModal() {
    setEditingVoucher(null);
    setForm(emptyForm);
    setModalOpen(true);
  }

  function openEditModal(voucher: Voucher) {
    setEditingVoucher(voucher);
    setForm({
      code: voucher.code,
      title: voucher.title,
      description: voucher.description,
      valueAmount: voucher.valueAmount,
      pointsCost: voucher.pointsCost,
      isActive: voucher.isActive,
    });
    setModalOpen(true);
  }

  async function saveVoucher(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token) return;
    setSubmitting(true);
    setNotice("");
    setDashboardError("");
    const path = editingVoucher
      ? `/admin/vouchers/${encodeURIComponent(editingVoucher.id)}`
      : "/admin/vouchers";
    try {
      await apiRequest(path, token, {
        method: editingVoucher ? "PUT" : "POST",
        body: JSON.stringify({
          code: form.code,
          title: form.title,
          description: form.description,
          value_amount: Number(form.valueAmount),
          points_cost: Number(form.pointsCost),
          is_active: form.isActive,
        }),
      });
      await loadDashboard(token);
      setModalOpen(false);
      setNotice(editingVoucher ? "Voucher berhasil diperbarui." : "Voucher berhasil dibuat.");
    } catch (error) {
      setDashboardError(
        error instanceof Error ? error.message : "Voucher gagal disimpan.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function toggleVoucherStatus(voucher: Voucher) {
    if (!token) return;
    const nextStatus = !voucher.isActive;
    setDashboardError("");
    setNotice("");
    try {
      await apiRequest(
        `/admin/vouchers/${encodeURIComponent(voucher.id)}/status`,
        token,
        {
          method: "PATCH",
          body: JSON.stringify({ is_active: nextStatus }),
        },
      );
      await loadDashboard(token);
      setNotice(`Status voucher ${voucher.code || voucher.title} diubah.`);
    } catch (error) {
      setDashboardError(
        error instanceof Error ? error.message : "Status voucher gagal diubah.",
      );
    }
  }

  function logout() {
    localStorage.removeItem(TOKEN_KEY);
    setToken("");
    setUser(null);
    setVouchers([]);
    setUsers([]);
    setUsersLoaded(false);
    setActiveSection("vouchers");
    setDashboardError("");
    setNotice("");
  }

  if (checkingSession) {
    return (
      <main className="session-screen">
        <div className="session-loader" />
        <p>Menyiapkan dashboard...</p>
      </main>
    );
  }

  if (!token) {
    return (
      <main className="login-layout">
        <section className="login-story">
          <div className="story-topline">
            <div className="brand-mark"><Icon name="ticket" size={21} /></div>
            <span>PLAYPASS <b>ADMIN</b></span>
          </div>
          <div className="story-copy">
            <span className="eyebrow"><span className="eyebrow-dot" /> VOUCHER MANAGEMENT</span>
            <h1>Hadiah kecil.<br /><em>Pengalaman</em><br />yang besar.</h1>
            <p>Kelola voucher game dan berikan lebih banyak alasan untuk kembali bermain.</p>
          </div>
          <div className="story-decoration" aria-hidden="true">
            <div className="orbit orbit-one" />
            <div className="orbit orbit-two" />
            <div className="ticket-art"><Icon name="ticket" size={61} /></div>
            <span className="floating-star star-one">✦</span>
            <span className="floating-star star-two">✳</span>
          </div>
          <div className="story-footer"><span>© 2026 Playpass</span><span>BUILT FOR PLAY</span></div>
        </section>

        <section className="login-panel">
          <div className="login-mobile-brand">
            <div className="brand-mark"><Icon name="ticket" size={20} /></div>
            <span>PLAYPASS <b>ADMIN</b></span>
          </div>
          <div className="login-card">
            <div className="login-icon"><Icon name="spark" size={23} /></div>
            <span className="eyebrow">SELAMAT DATANG KEMBALI</span>
            <h2>Masuk ke akunmu</h2>
            <p className="login-description">Gunakan akun admin untuk melanjutkan ke dashboard.</p>
            <form className="login-form" onSubmit={handleLogin}>
              <label htmlFor="email">Email</label>
              <div className="input-wrap">
                <span className="input-symbol">@</span>
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  placeholder="nama@email.com"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  required
                />
              </div>
              <div className="password-label">
                <label htmlFor="password">Password</label>
              </div>
              <div className="input-wrap">
                <span className="input-symbol lock-symbol">⌑</span>
                <input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  placeholder="Masukkan password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                />
              </div>
              {loginError && <p className="form-error" role="alert">{loginError}</p>}
              <button className="button button-primary login-submit" type="submit" disabled={submitting}>
                {submitting ? "Memproses..." : "Masuk ke dashboard"}
                {!submitting && <Icon name="arrow" size={18} />}
              </button>
            </form>
            <div className="login-secure"><span /> Koneksi aman dan terenkripsi</div>
          </div>
          <div className="login-panel-footer">Butuh bantuan? <a href="mailto:support@playpass.id">Hubungi support</a></div>
        </section>
      </main>
    );
  }

  return (
    <main className="dashboard-layout">
      <aside className="sidebar">
        <a className="brand" href="#" aria-label="Playpass Admin">
          <div className="brand-mark"><Icon name="ticket" size={21} /></div>
          <span>PLAYPASS <b>ADMIN</b></span>
        </a>
        <div className="sidebar-section-label">WORKSPACE</div>
        <nav className="side-nav" aria-label="Navigasi utama">
          <button className={`nav-item ${activeSection === "overview" ? "active" : ""}`} type="button" onClick={showOverview} aria-label="Overview">
            <Icon name="grid" size={18} /> Overview
          </button>
          <button className={`nav-item ${activeSection === "vouchers" ? "active" : ""}`} type="button" onClick={showVouchers} aria-label="Voucher">
            <Icon name="ticket" size={18} /> Voucher <span className="nav-count">{vouchers.length}</span>
          </button>
          <button className={`nav-item ${activeSection === "users" ? "active" : ""}`} type="button" onClick={() => void showUsers()} aria-label="Pengguna">
            <Icon name="users" size={18} /> Pengguna <span className="nav-count">{users.length}</span>
          </button>
        </nav>
        <div className="sidebar-bottom">
          {/* <div className="sidebar-help">
            <div className="help-orbit"><Icon name="spark" size={17} /></div>
            <strong>Perlu bantuan?</strong>
            <p>Tim kami siap membantu pengelolaan voucher.</p>
            <a href="mailto:support@playpass.id">Hubungi support <Icon name="arrow" size={14} /></a>
          </div> */}
          <div className="sidebar-user">
            <div className="avatar">{displayName(user).slice(0, 1).toUpperCase()}</div>
            <div className="user-details"><strong>{displayName(user)}</strong><span>Administrator</span></div>
            <button className="icon-button logout-button" type="button" onClick={logout} aria-label="Keluar"><Icon name="logout" size={18} /></button>
          </div>
        </div>
      </aside>

      <section className="dashboard-main" id="overview">
        <header className="topbar">
          <div className="breadcrumb">Workspace <span>/</span> <strong>{activeSection === "overview" ? "Overview" : activeSection === "users" ? "Pengguna" : "Voucher"}</strong></div>
          <div className="topbar-actions">
            <span className="topbar-date">{new Intl.DateTimeFormat("id-ID", { dateStyle: "full" }).format(new Date())}</span>
            <button className="icon-button notification-button" type="button" aria-label="Notifikasi"><Icon name="bell" size={19} /><i /></button>
            <div className="avatar avatar-small">{displayName(user).slice(0, 1).toUpperCase()}</div>
          </div>
        </header>

        <div className="dashboard-content">
          <div className="page-heading">
            <div>
              <span className="eyebrow"><span className="eyebrow-dot" /> PANEL ADMINISTRATOR</span>
              <h1>{activeSection === "overview" ? "Dashboard" : activeSection === "users" ? "Pengguna" : "Voucher"}</h1>
              <p>{activeSection === "overview" ? "Ringkasan aktivitas pengguna dan voucher di platform." : activeSection === "users" ? "Lihat akun, skor, dan riwayat penukaran voucher." : "Kelola promo dan hadiah untuk komunitas game-mu."}</p>
            </div>
            {activeSection !== "users" && (
              <button className="button button-primary create-button" onClick={openCreateModal} type="button">
                <Icon name="plus" size={18} /> Buat voucher
              </button>
            )}
          </div>

          {(dashboardError || notice) && (
            <div className={dashboardError ? "notice notice-error" : "notice notice-success"} role={dashboardError ? "alert" : "status"}>
              <span>{dashboardError || notice}</span>
              {dashboardError && <button type="button" onClick={() => setDashboardError("")} aria-label="Tutup pesan"><Icon name="close" size={16} /></button>}
            </div>
          )}

          {activeSection === "overview" ? (
            <section className="overview-page">
              <section className="stats-grid overview-stats" aria-label="Ringkasan platform">
                <article className="stat-card">
                  <div className="stat-top"><span>Total pengguna</span><span className="stat-icon purple"><Icon name="users" size={19} /></span></div>
                  <div className="stat-value">{users.length.toLocaleString("id-ID")}</div>
                  <div className="stat-caption">{totalScore.toLocaleString("id-ID")} total skor</div>
                </article>
                <article className="stat-card">
                  <div className="stat-top"><span>Total voucher</span><span className="stat-icon green"><Icon name="ticket" size={19} /></span></div>
                  <div className="stat-value">{vouchers.length.toLocaleString("id-ID")}</div>
                  <div className="stat-caption">{activeCount.toLocaleString("id-ID")} voucher aktif</div>
                </article>
                <article className="stat-card">
                  <div className="stat-top"><span>Total penukaran</span><span className="stat-icon orange"><Icon name="spark" size={18} /></span></div>
                  <div className="stat-value">{totalRedemptions.toLocaleString("id-ID")}</div>
                  <div className="stat-caption">Voucher yang telah ditukar</div>
                </article>
              </section>

              <div className="overview-panels">
                <section className="voucher-section overview-panel">
                  <div className="section-heading">
                    <div><h2>Pengguna terbaru <span>{users.length}</span></h2><p>Skor dan aktivitas pengguna terbaru.</p></div>
                    <button className="details-button" type="button" onClick={() => void showUsers()}>Semua pengguna</button>
                  </div>
                  <div className="overview-list">
                    {loadingUsers ? (
                      <div className="overview-empty"><span className="inline-loader" /> Memuat pengguna...</div>
                    ) : recentUsers.length === 0 ? (
                      <div className="overview-empty">Belum ada data pengguna.</div>
                    ) : recentUsers.map((item) => (
                      <div className="overview-user-row" key={item.id}>
                        <div className="user-cell">
                          <div className="avatar">{item.name.slice(0, 1).toUpperCase()}</div>
                          <div><strong>{item.name}</strong><span>{item.email || "Email tidak tersedia"}</span></div>
                        </div>
                        <div className="overview-user-metrics">
                          <strong>{Number(item.scoreTotal).toLocaleString("id-ID")} <span>skor</span></strong>
                          <span>{item.redeemedVoucherCount.toLocaleString("id-ID")} ditukar</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>

                <section className="voucher-section overview-panel">
                  <div className="section-heading">
                    <div><h2>Voucher <span>{vouchers.length}</span></h2><p>Voucher aktif dan nilai poinnya.</p></div>
                    <button className="details-button" type="button" onClick={showVouchers}>Kelola voucher</button>
                  </div>
                  <div className="overview-list">
                    {loadingVouchers ? (
                      <div className="overview-empty"><span className="inline-loader" /> Memuat voucher...</div>
                    ) : overviewVouchers.length === 0 ? (
                      <div className="overview-empty">Belum ada voucher terdaftar.</div>
                    ) : overviewVouchers.map((voucher) => (
                      <div className="overview-voucher-row" key={voucher.id}>
                        <div className="voucher-icon"><Icon name="ticket" size={17} /></div>
                        <div className="overview-voucher-info">
                          <strong>{voucher.title}</strong>
                          <span>{voucher.code || "Tanpa kode"} · {Number(voucher.pointsCost).toLocaleString("id-ID")} poin</span>
                        </div>
                        <span className={`status-pill ${voucher.isActive ? "is-active" : "is-inactive"}`}>{voucher.isActive ? "Aktif" : "Nonaktif"}</span>
                      </div>
                    ))}
                  </div>
                  <div className="overview-panel-footer">
                    <span>{activeCount.toLocaleString("id-ID")} dari {vouchers.length.toLocaleString("id-ID")} voucher aktif</span>
                    <button type="button" onClick={showVouchers}>Lihat semua <Icon name="arrow" size={14} /></button>
                  </div>
                </section>
              </div>
            </section>
          ) : activeSection === "users" ? (
            <>
              <section className="stats-grid user-stats" aria-label="Ringkasan pengguna">
                <article className="stat-card">
                  <div className="stat-top"><span>Total pengguna</span><span className="stat-icon purple"><Icon name="users" size={19} /></span></div>
                  <div className="stat-value">{users.length.toLocaleString("id-ID")}</div>
                  <div className="stat-caption">Akun terdaftar</div>
                </article>
                <article className="stat-card">
                  <div className="stat-top"><span>Total skor</span><span className="stat-icon green"><Icon name="spark" size={18} /></span></div>
                  <div className="stat-value">{users.reduce((total, item) => total + (Number(item.scoreTotal) || 0), 0).toLocaleString("id-ID")}</div>
                  <div className="stat-caption">Skor seluruh pengguna</div>
                </article>
                <article className="stat-card">
                  <div className="stat-top"><span>Voucher ditukar</span><span className="stat-icon green"><Icon name="ticket" size={18} /></span></div>
                  <div className="stat-value">{users.reduce((total, item) => total + item.redeemedVoucherCount, 0).toLocaleString("id-ID")}</div>
                  <div className="stat-caption">Total penukaran</div>
                </article>
              </section>
              <section className="voucher-section users-section" id="users">
                <div className="section-heading">
                  <div><h2>Semua pengguna <span>{users.length}</span></h2><p>Akun dan aktivitas penukaran voucher pengguna.</p></div>
                </div>
                <div className="table-toolbar">
                  <div className="search-box"><Icon name="search" size={18} /><input type="search" placeholder="Cari nama, email, atau role..." value={userSearch} onChange={(event) => setUserSearch(event.target.value)} aria-label="Cari pengguna" /></div>
                </div>
                <div className="table-wrap">
                  <table className="users-table">
                    <thead><tr><th>PENGGUNA</th><th>ROLE</th><th>SKOR</th><th>DITUKAR</th><th>TERDAFTAR</th><th><span className="sr-only">Detail</span></th></tr></thead>
                    <tbody>
                      {loadingUsers ? (
                        <tr><td colSpan={6} className="table-message"><span className="inline-loader" /> Memuat pengguna...</td></tr>
                      ) : filteredUsers.length === 0 ? (
                        <tr><td colSpan={6} className="table-message">{users.length ? "Tidak ada pengguna yang cocok dengan pencarian." : "Belum ada data pengguna."}</td></tr>
                      ) : filteredUsers.map((item) => (
                        <Fragment key={item.id}>
                          <tr>
                            <td><div className="user-cell"><div className="avatar">{item.name.slice(0, 1).toUpperCase()}</div><div><strong>{item.name}</strong><span>{item.email || "Email tidak tersedia"}</span></div></div></td>
                            <td><span className={`role-pill ${item.role.toLowerCase() === "admin" ? "role-admin" : ""}`}>{item.role}</span></td>
                            <td className="user-score">{Number(item.scoreTotal).toLocaleString("id-ID")}</td>
                            <td>{item.redeemedVoucherCount.toLocaleString("id-ID")} voucher</td>
                            <td>{formatDate(item.createdAt)}</td>
                            <td><button className="details-button" type="button" onClick={() => setExpandedUserId(expandedUserId === item.id ? null : item.id)} aria-expanded={expandedUserId === item.id}>{expandedUserId === item.id ? "Tutup" : "Detail"}</button></td>
                          </tr>
                          {expandedUserId === item.id && (
                            <tr className="redemption-row" key={`${item.id}-redemptions`}>
                              <td colSpan={6}>
                                <div className="redemption-details">
                                  <h3>Voucher ditukar oleh {item.name}</h3>
                                  {item.redeemedVouchers.length === 0 ? (
                                    <p className="empty-redemptions">Pengguna ini belum menukar voucher.</p>
                                  ) : (
                                    <div className="redemption-list">
                                      {item.redeemedVouchers.map((redemption) => (
                                        <div className="redemption-item" key={redemption.redemptionId}>
                                          <div><strong>{redemption.title}</strong><span>{redemption.code || `Voucher #${redemption.voucherId}`}</span></div>
                                          <span>Nilai Rp {Number(redemption.valueAmount).toLocaleString("id-ID")}</span>
                                          <span>{Number(redemption.pointsSpent).toLocaleString("id-ID")} poin</span>
                                          <span>{formatDate(redemption.redeemedAt)}</span>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="table-footer"><span>Menampilkan <strong>{filteredUsers.length}</strong> dari <strong>{users.length}</strong> pengguna</span><span>Data diperbarui langsung dari server</span></div>
              </section>
            </>
          ) : (
          <>
          <section className="stats-grid" aria-label="Ringkasan voucher">
            <article className="stat-card">
              <div className="stat-top"><span>Total voucher</span><span className="stat-icon purple"><Icon name="ticket" size={19} /></span></div>
              <div className="stat-value">{vouchers.length.toLocaleString("id-ID")}</div>
              <div className="stat-caption">Voucher terdaftar</div>
            </article>
            <article className="stat-card">
              <div className="stat-top"><span>Voucher aktif</span><span className="stat-icon green"><span className="status-dot" /></span></div>
              <div className="stat-value">{activeCount.toLocaleString("id-ID")}</div>
              <div className="stat-caption"><span className="caption-positive">Siap digunakan</span></div>
            </article>
            <article className="stat-card stat-highlight">
              <div className="stat-top"><span>Kelola promo</span><span className="stat-icon orange"><Icon name="spark" size={18} /></span></div>
              <div className="stat-feature">Buat momen<br />seru berikutnya.</div>
              <button className="text-link" onClick={openCreateModal} type="button">Buat voucher baru <Icon name="arrow" size={15} /></button>
            </article>
          </section>

          <section className="voucher-section" id="vouchers">
            <div className="section-heading">
              <div><h2>Semua voucher <span>{vouchers.length}</span></h2><p>Daftar voucher yang tersedia di platform.</p></div>
              <button className="button button-secondary mobile-create" type="button" onClick={openCreateModal}><Icon name="plus" size={17} /> Buat voucher</button>
            </div>
            <div className="table-toolbar">
              <div className="search-box"><Icon name="search" size={18} /><input type="search" placeholder="Cari judul atau kode voucher..." value={search} onChange={(event) => setSearch(event.target.value)} aria-label="Cari voucher" /></div>
              <label className="filter-select"><span>Status:</span><select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} aria-label="Filter status"><option value="all">Semua</option><option value="active">Aktif</option><option value="inactive">Nonaktif</option></select></label>
            </div>
            <div className="table-wrap">
              <table>
                <thead><tr><th>VOUCHER</th><th>NILAI</th><th>BIAYA POIN</th><th>STATUS</th><th><span className="sr-only">Aksi</span></th></tr></thead>
                <tbody>
                  {loadingVouchers ? (
                    <tr><td colSpan={5} className="table-message"><span className="inline-loader" /> Memuat voucher...</td></tr>
                  ) : filteredVouchers.length === 0 ? (
                    <tr><td colSpan={5} className="table-message">{vouchers.length ? "Tidak ada voucher yang cocok dengan pencarian." : "Belum ada voucher. Buat voucher pertamamu."}</td></tr>
                  ) : filteredVouchers.map((voucher) => {
                    const isActive = voucher.isActive;
                    return (
                      <tr key={voucher.id}>
                        <td><div className="voucher-cell"><div className="voucher-icon"><Icon name="ticket" size={18} /></div><div><strong>{voucher.title}</strong><span>{voucher.code || "Tanpa kode"}</span></div></div></td>
                        <td className="value-cell">{voucher.valueAmount ? `Rp ${Number(voucher.valueAmount).toLocaleString("id-ID")}` : "—"}</td>
                        <td>{voucher.pointsCost ? `${Number(voucher.pointsCost).toLocaleString("id-ID")} poin` : "—"}</td>
                        <td><button type="button" className={`status-pill ${isActive ? "is-active" : "is-inactive"}`} onClick={() => void toggleVoucherStatus(voucher)} aria-label={`Ubah status ${voucher.title}`}>{isActive ? "Aktif" : "Nonaktif"}</button></td>
                        <td className="action-cell"><button className="icon-button edit-button" type="button" onClick={() => openEditModal(voucher)} aria-label={`Edit ${voucher.title}`}><Icon name="edit" size={17} /></button></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="table-footer"><span>Menampilkan <strong>{filteredVouchers.length}</strong> dari <strong>{vouchers.length}</strong> voucher</span><span>Data diperbarui langsung dari server</span></div>
          </section>
          </>
          )}
          <footer className="dashboard-footer"><span>© 2026 Playpass Admin</span><span>MAKE PLAY MORE REWARDING <i>✦</i></span></footer>
        </div>
      </section>

      {modalOpen && (
        <div className="modal-backdrop" role="presentation" onMouseDown={(event) => {
          if (event.target === event.currentTarget) setModalOpen(false);
        }}>
          <section className="voucher-modal" role="dialog" aria-modal="true" aria-labelledby="modal-title">
            <div className="modal-heading">
              <div><span className="eyebrow">{editingVoucher ? "PERBARUI PROMO" : "PROMO BARU"}</span><h2 id="modal-title">{editingVoucher ? "Edit voucher" : "Buat voucher"}</h2><p>Lengkapi detail voucher untuk komunitasmu.</p></div>
              <button className="icon-button" type="button" onClick={() => setModalOpen(false)} aria-label="Tutup"><Icon name="close" size={20} /></button>
            </div>
            <form className="voucher-form" onSubmit={saveVoucher}>
              <label>Kode voucher<input value={form.code} onChange={(event) => setForm({ ...form, code: event.target.value.toUpperCase() })} placeholder="CONTOH: PLAY2026" required /></label>
              <label>Judul voucher<input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder="Contoh: Bonus Pemain Baru" required /></label>
              <label className="form-full">Deskripsi<textarea value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} placeholder="Ceritakan promo voucher ini..." rows={3} /></label>
              <div className="form-row">
                <label>Nilai voucher<input type="number" min="0" step="any" value={form.valueAmount} onChange={(event) => setForm({ ...form, valueAmount: event.target.value })} placeholder="50000" required /></label>
                <label>Biaya poin<input type="number" min="0" step="any" value={form.pointsCost} onChange={(event) => setForm({ ...form, pointsCost: event.target.value })} placeholder="1000" required /></label>
              </div>
              <label className="active-field"><input type="checkbox" checked={form.isActive} onChange={(event) => setForm({ ...form, isActive: event.target.checked })} /> Voucher aktif</label>
              {dashboardError && <p className="form-error form-full" role="alert">{dashboardError}</p>}
              <div className="modal-actions form-full"><button className="button button-secondary" type="button" onClick={() => setModalOpen(false)}>Batal</button><button className="button button-primary" type="submit" disabled={submitting}>{submitting ? "Menyimpan..." : editingVoucher ? "Simpan perubahan" : "Buat voucher"} {!submitting && <Icon name="arrow" size={17} />}</button></div>
            </form>
          </section>
        </div>
      )}
    </main>
  );
}
