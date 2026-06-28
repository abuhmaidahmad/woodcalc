import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getUser, logout } from '../api/auth';

// ─── Icon Components ───────────────────────────────────────────────
function Icon({ d }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d={d} />
    </svg>
  );
}

const ICONS = {
  projects:    "M3 7h18M3 12h18M3 17h18",
  orders:      "M6 2h12l4 6-10 14L2 8z",
  design:      "M12 2l3.09 6.26L22 9.27l-5 4.87L18.18 21 12 17.77 5.82 21 7 14.14 2 9.27l6.91-1.01z",
  quotes:      "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z M14 2v6h6",
  incoming:    "M22 12h-4l-3 9L9 3l-3 9H2",
  production:  "M2 20h20M4 20V10l8-8 8 8v10",
  revenue:     "M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6",
  verify:      "M9 12l2 2 4-4m6 2a9 9 0 1 1-18 0 9 9 0 0 1 18 0z",
  clients:     "M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2 M23 21v-2a4 4 0 0 0-3-3.87 M16 3.13a4 4 0 0 1 0 7.75",
  proposals:   "M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.79 19.79 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z",
  commission:  "M3 3h18v18H3z M3 9h18 M9 21V9",
  materials:   "M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z",
};

// ─── Card Component ─────────────────────────────────────────────────
function DashCard({ icon, title, description, cta, ctaAction, accent, badge }) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      style={{
        ...styles.card,
        boxShadow: hovered ? '0 8px 32px rgba(0,0,0,0.10)' : '0 2px 8px rgba(0,0,0,0.06)',
        transform: hovered ? 'translateY(-2px)' : 'translateY(0)',
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div style={{ ...styles.iconWrap, background: accent + '18', color: accent }}>
        <Icon d={ICONS[icon]} />
      </div>
      {badge && (
        <span style={{ ...styles.badge, background: accent + '18', color: accent }}>
          {badge}
        </span>
      )}
      <h3 style={styles.cardTitle}>{title}</h3>
      <p style={styles.cardDesc}>{description}</p>
      {cta && (
        <button
          onClick={ctaAction}
          style={{ ...styles.ctaBtn, color: accent, borderColor: accent + '40' }}
        >
          {cta} →
        </button>
      )}
    </div>
  );
}

// ─── Role Configs ────────────────────────────────────────────────────
function getCards(userType, navigate, isVerified) {
  switch (userType) {
    case 'customer':
      return [
        {
          icon: 'projects', title: 'My Projects',
          description: 'Your saved cabinet configurations and active designs.',
          cta: 'View projects', ctaAction: () => navigate('/customers'),
          accent: '#C8902A',
        },
        {
          icon: 'orders', title: 'Order History',
          description: 'Track the status of your placed orders.',
          cta: 'View orders', ctaAction: () => navigate('/orders'),
          accent: '#2A7AC8',
        },
        {
          icon: 'design', title: 'Start New Design',
          description: 'Launch the Kitchen Planner and configure your cabinets.',
          cta: 'Open planner', ctaAction: () => navigate('/kitchen-planner'),
          accent: '#2AC87A',
        },
        {
          icon: 'quotes', title: 'Saved Quotes',
          description: 'Review and share your saved cabinet proposals.',
          cta: 'View quotes', ctaAction: () => navigate('/quotes'),
          accent: '#C82A7A',
        },
      ];

    case 'architect':
      return [
        {
          icon: 'clients', title: 'My Client Projects',
          description: 'All active and completed projects for your clients.',
          cta: 'View projects', ctaAction: () => navigate('/customers'),
          accent: '#C8902A',
        },
        {
          icon: 'proposals', title: 'Proposals Sent',
          description: 'Track proposals you have sent to clients.',
          cta: 'View proposals', ctaAction: () => navigate('/proposals'),
          accent: '#2A7AC8',
        },
        {
          icon: 'design', title: 'Start New Design',
          description: 'Launch the Kitchen Planner for a new client project.',
          cta: 'Open planner', ctaAction: () => navigate('/kitchen-planner'),
          accent: '#2AC87A',
        },
        {
          icon: 'commission', title: 'Commissions',
          description: 'Track your earnings and commission history.',
          cta: 'View earnings', ctaAction: () => navigate('/commissions'),
          accent: '#C82A7A',
        },
      ];

    case 'manufacturer':
      return [
        {
          icon: 'incoming', title: 'Incoming Orders',
          description: 'New cabinet orders waiting for your confirmation.',
          cta: 'View orders', ctaAction: () => navigate('/orders'),
          accent: '#C8902A',
        },
        {
          icon: 'production', title: 'Production Board',
          description: 'Track active production jobs and station progress.',
          cta: 'Open board', ctaAction: () => navigate('/production'),
          accent: '#2A7AC8',
        },
        {
          icon: 'revenue', title: 'Revenue',
          description: 'Monthly earnings and payment summaries.',
          cta: 'View revenue', ctaAction: () => navigate('/revenue'),
          accent: '#2AC87A',
        },
        {
          icon: 'verify',
          title: isVerified ? 'Account Verified' : 'Verification Pending',
          description: isVerified
            ? 'Your trade license has been verified. Full access unlocked.'
            : 'Your documents are under review. Some features are limited until verified.',
          cta: isVerified ? null : 'Upload documents',
          ctaAction: () => navigate('/verification'),
          accent: isVerified ? '#2AC87A' : '#E8A020',
          badge: isVerified ? '✓ Verified' : 'Pending',
        },
      ];

    case 'supplier':
      return [
        {
          icon: 'materials', title: 'Materials Catalog',
          description: 'Manage your listed materials and pricing.',
          cta: 'Manage catalog', ctaAction: () => navigate('/catalog'),
          accent: '#C8902A',
        },
        {
          icon: 'incoming', title: 'Incoming Orders',
          description: 'Material orders placed by manufacturers.',
          cta: 'View orders', ctaAction: () => navigate('/orders'),
          accent: '#2A7AC8',
        },
        {
          icon: 'revenue', title: 'Revenue',
          description: 'Monthly earnings and payment summaries.',
          cta: 'View revenue', ctaAction: () => navigate('/revenue'),
          accent: '#2AC87A',
        },
        {
          icon: 'verify',
          title: isVerified ? 'Account Verified' : 'Verification Pending',
          description: isVerified
            ? 'Your trade license has been verified. Full access unlocked.'
            : 'Your documents are under review. Some features are limited until verified.',
          cta: isVerified ? null : 'Upload documents',
          ctaAction: () => navigate('/verification'),
          accent: isVerified ? '#2AC87A' : '#E8A020',
          badge: isVerified ? '✓ Verified' : 'Pending',
        },
      ];

    default:
      return [];
  }
}

// ─── Role Labels ─────────────────────────────────────────────────────
const ROLE_LABELS = {
  customer: 'Customer',
  architect: 'Architect / Designer',
  manufacturer: 'Manufacturer',
  supplier: 'Supplier',
};

const ROLE_COLORS = {
  customer: '#C8902A',
  architect: '#2A7AC8',
  manufacturer: '#2AC87A',
  supplier: '#C82A7A',
};

// ─── Dashboard Page ──────────────────────────────────────────────────
export default function Dashboard() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);

  useEffect(() => {
    const u = getUser();
    if (!u) {
      navigate('/login');
      return;
    }
    setUser(u);
  }, []);

  if (!user) return null;

  const cards = getCards(user.user_type, navigate, user.is_verified);
  const roleColor = ROLE_COLORS[user.user_type] || '#C8902A';

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div style={styles.page}>
      {/* Top Bar */}
      <div style={styles.topBar}>
        <div style={styles.topLeft}>
          <div style={styles.logoMark}>W</div>
          <span style={styles.logoText}>WoodCalc</span>
        </div>
        <div style={styles.topRight}>
          <div style={styles.userInfo}>
            <div style={{ ...styles.avatar, background: roleColor }}>
              {user.first_name?.[0]?.toUpperCase() || 'U'}
            </div>
            <div>
              <div style={styles.userName}>
                {user.first_name} {user.last_name}
              </div>
              <div style={{ ...styles.roleTag, color: roleColor }}>
                {ROLE_LABELS[user.user_type]}
              </div>
            </div>
          </div>
          <button style={styles.logoutBtn} onClick={handleLogout}>
            Sign out
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div style={styles.content}>
        <div style={styles.greeting}>
          <h1 style={styles.greetingTitle}>
            Welcome back, {user.first_name} 👋
          </h1>
          <p style={styles.greetingSubtitle}>
            Here's what's happening with your account.
          </p>
        </div>

        {/* Cards Grid */}
        <div style={styles.grid}>
          {cards.map((card, i) => (
            <DashCard key={i} {...card} />
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────
const styles = {
  page: {
    minHeight: '100vh',
    background: '#F7F4F0',
    fontFamily: "'Inter', sans-serif",
  },
  topBar: {
    background: '#1A1A1A',
    padding: '0 32px',
    height: 64,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  topLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
  },
  logoMark: {
    width: 32,
    height: 32,
    background: '#C8902A',
    borderRadius: 8,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 16,
    fontWeight: 800,
    color: '#fff',
  },
  logoText: {
    color: '#fff',
    fontWeight: 700,
    fontSize: 16,
  },
  topRight: {
    display: 'flex',
    alignItems: 'center',
    gap: 20,
  },
  userInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#fff',
    fontWeight: 700,
    fontSize: 14,
  },
  userName: {
    color: '#fff',
    fontSize: 13,
    fontWeight: 600,
    lineHeight: 1.3,
  },
  roleTag: {
    fontSize: 11,
    fontWeight: 500,
    lineHeight: 1.3,
  },
  logoutBtn: {
    background: 'transparent',
    border: '1px solid rgba(255,255,255,0.2)',
    color: '#999',
    borderRadius: 6,
    padding: '6px 14px',
    fontSize: 13,
    cursor: 'pointer',
  },
  content: {
    maxWidth: 960,
    margin: '0 auto',
    padding: '48px 24px',
  },
  greeting: {
    marginBottom: 36,
  },
  greetingTitle: {
    fontSize: 28,
    fontWeight: 700,
    color: '#1A1A1A',
    margin: '0 0 6px',
  },
  greetingSubtitle: {
    fontSize: 15,
    color: '#666',
    margin: 0,
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
    gap: 20,
  },
  card: {
    background: '#fff',
    borderRadius: 14,
    padding: '24px',
    border: '1.5px solid #E0DAD4',
    transition: 'box-shadow 0.2s, transform 0.2s',
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
    position: 'relative',
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 10,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    top: 16,
    right: 16,
    fontSize: 11,
    fontWeight: 600,
    padding: '3px 8px',
    borderRadius: 20,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: 700,
    color: '#1A1A1A',
    margin: 0,
  },
  cardDesc: {
    fontSize: 13,
    color: '#666',
    margin: 0,
    lineHeight: 1.5,
    flex: 1,
  },
  ctaBtn: {
    background: 'transparent',
    border: '1.5px solid',
    borderRadius: 7,
    padding: '7px 14px',
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
    marginTop: 4,
    alignSelf: 'flex-start',
  },
};
