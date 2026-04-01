const MODULES = [
  {
    icon: '📢',
    title: 'Ads Optimizer',
    desc: 'AI-powered Google Ads campaign builder. Scrape sites, generate keywords & ad copy, launch campaigns directly to Google Ads.',
    url: '/app',
    color: '#7c3aed',
    tags: ['Google Ads', 'AI Keywords', 'Campaign Builder'],
  },
  {
    icon: '📊',
    title: 'CPA Monitor',
    desc: 'Content pipeline for CPA firms. Scrape top accounting sources, score topics, generate blog posts, publish to WordPress.',
    url: 'https://cpa-monitor-kohl.vercel.app/',
    color: '#2563eb',
    tags: ['Content Pipeline', 'WordPress', 'Trend Analysis'],
  },
  {
    icon: '🌐',
    title: 'Website Automator',
    desc: 'Automated website generation and management for professional service firms. Build, deploy, and maintain client websites.',
    url: 'https://mycpe-website-generator-production.up.railway.app/dashboard',
    color: '#059669',
    tags: ['Website Builder', 'Automation', 'Client Sites'],
  },
];

export default function Landing() {
  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #0f0a1e 0%, #1a1145 40%, #0f0a1e 100%)', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '60px 20px' }}>
      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: 48 }}>
        <div style={{ fontSize: 48, marginBottom: 8 }}>⚡</div>
        <h1 style={{ fontSize: 36, fontWeight: 800, color: '#fff', margin: '0 0 8px', letterSpacing: '-0.5px' }}>
          MyCPE Digital Suite
        </h1>
        <p style={{ fontSize: 16, color: 'rgba(255,255,255,0.5)', margin: 0, maxWidth: 500 }}>
          AI-powered tools for accounting firms. Ads, content, and websites — all in one place.
        </p>
      </div>

      {/* Module Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 24, maxWidth: 1100, width: '100%' }}>
        {MODULES.map((m) => (
          <a
            key={m.title}
            href={m.url}
            style={{
              display: 'block', textDecoration: 'none', color: 'inherit',
              background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 20, padding: '32px 28px', transition: 'all .3s ease',
              cursor: 'pointer', position: 'relative', overflow: 'hidden',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(255,255,255,0.08)';
              e.currentTarget.style.borderColor = m.color;
              e.currentTarget.style.transform = 'translateY(-4px)';
              e.currentTarget.style.boxShadow = `0 20px 40px ${m.color}22`;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(255,255,255,0.04)';
              e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)';
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = 'none';
            }}
          >
            {/* Icon */}
            <div style={{
              width: 56, height: 56, borderRadius: 16,
              background: `${m.color}18`, display: 'flex', alignItems: 'center',
              justifyContent: 'center', fontSize: 28, marginBottom: 20,
            }}>
              {m.icon}
            </div>

            {/* Title */}
            <h2 style={{ fontSize: 22, fontWeight: 700, color: '#fff', margin: '0 0 10px' }}>
              {m.title}
            </h2>

            {/* Description */}
            <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.5)', margin: '0 0 20px', lineHeight: 1.6 }}>
              {m.desc}
            </p>

            {/* Tags */}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {m.tags.map((t) => (
                <span key={t} style={{
                  fontSize: 11, fontWeight: 600, color: m.color,
                  background: `${m.color}15`, padding: '4px 10px',
                  borderRadius: 20, letterSpacing: '0.3px',
                }}>
                  {t}
                </span>
              ))}
            </div>

            {/* Arrow */}
            <div style={{
              position: 'absolute', top: 32, right: 28,
              fontSize: 20, color: 'rgba(255,255,255,0.2)', transition: 'all .3s',
            }}>
              →
            </div>
          </a>
        ))}
      </div>

      {/* Footer */}
      <div style={{ marginTop: 60, textAlign: 'center', color: 'rgba(255,255,255,0.25)', fontSize: 12 }}>
        Powered by MyCPE Digital Marketing
      </div>
    </div>
  );
}
