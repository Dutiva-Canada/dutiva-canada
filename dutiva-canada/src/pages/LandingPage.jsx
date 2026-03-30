import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'

/* ─────────────────────────────────────────
   THEME TOKENS
───────────────────────────────────────── */
const THEMES = {
  dark: {
    bg:           '#111111',
    bgCard:       '#191919',
    bgCard2:      '#1e1e1e',
    bgSlate:      '#1e2535',
    bgSlateH:     '#252e42',
    bgInput:      '#191919',
    gold:         '#c49a45',
    goldH:        '#d4aa5a',
    goldDim:      'rgba(196,154,69,0.12)',
    goldBorder:   'rgba(196,154,69,0.35)',
    text:         '#f0ece4',
    textMid:      '#a09880',
    textSoft:     '#6b6660',
    textMuted:    '#55524e',
    border:       'rgba(255,255,255,0.08)',
    navBg:        'rgba(17,17,17,0.92)',
    pillBg:       '#191919',
    pillText:     '#6b6660',
    featBg:       '#191919',
    featBgH:      '#1c1c1c',
    featGap:      'rgba(255,255,255,0.08)',
    statsBg:      '#191919',
    pricingBg:    '#191919',
    pricingFeat:  '#161410',
    aboutBg:      '#191919',
    footerBg:     '#111111',
    glow:         'rgba(196,154,69,0.10)',
    glowB:        'rgba(196,154,69,0.07)',
    shadow:       'none',
  },
  light: {
    bg:           '#f7f4ef',
    bgCard:       '#ffffff',
    bgCard2:      '#f0ece5',
    bgSlate:      '#e8e3da',
    bgSlateH:     '#ddd8ce',
    bgInput:      '#ffffff',
    gold:         '#b8893a',
    goldH:        '#c49a45',
    goldDim:      'rgba(184,137,58,0.10)',
    goldBorder:   'rgba(184,137,58,0.35)',
    text:         '#1a1510',
    textMid:      '#5a4f3e',
    textSoft:     '#8a7f70',
    textMuted:    '#aaa090',
    border:       'rgba(0,0,0,0.07)',
    navBg:        'rgba(247,244,239,0.92)',
    pillBg:       '#edeae4',
    pillText:     '#8a7f70',
    featBg:       '#ffffff',
    featBgH:      '#faf8f5',
    featGap:      'rgba(0,0,0,0.06)',
    statsBg:      '#ffffff',
    pricingBg:    '#ffffff',
    pricingFeat:  '#fffdf8',
    aboutBg:      '#ffffff',
    footerBg:     '#f7f4ef',
    glow:         'rgba(184,137,58,0.08)',
    glowB:        'rgba(184,137,58,0.05)',
    shadow:       '0 2px 20px rgba(0,0,0,0.06)',
  },
}

/* ─────────────────────────────────────────
   TRANSLATIONS
───────────────────────────────────────── */
const T = {
  en: {
    navFeatures:    'Features',
    navPricing:     'Pricing',
    navAbout:       'About',
    navCta:         'Get Early Access',
    heroTagline:    'The bilingual HR co-pilot for Canadian small businesses.',
    heroCta:        'Get Started — Free',
    heroLogin:      'Log in to your account',
    heroOr:         'or',
    pill1: '16 templates', pill2: '14 jurisdictions', pill3: 'EN / FR', pill4: 'ESA calculator', pill5: 'PDF export',
    featLabel:      'How It Works',
    featTitle:      'HR compliance, handled.',
    featSub:        "Whether you're onboarding your first hire or managing a growing team, Dutiva gives you the tools to stay compliant across every Canadian jurisdiction.",
    f1h: 'Jurisdiction-aware templates',    f1p: '16 professionally drafted HR templates calibrated to 14 provincial and federal jurisdictions — always current, never generic.',
    f2h: 'Fully bilingual',                 f2p: 'Every document and workflow is available in English and French — no translation costs, no extra steps.',
    f3h: 'ESA compliance calculator',       f3p: "Calculate notice periods, termination entitlements, and severance obligations accurately under your province's Employment Standards Act.",
    f4h: 'PDF export, ready to send',       f4p: 'Generate professional documents instantly. Download, sign, and send — no formatting required on your end.',
    stat1: 'HR Templates', stat2: 'Jurisdictions', stat3: 'Bilingual', stat4: 'Canadian Business',
    pricingLabel:   'Pricing',
    pricingTitle:   'Simple, transparent pricing.',
    pricingSub:     "We're finalizing our plans. Join the waitlist to be notified the moment pricing goes live — early members get founding rates.",
    tierFree:       'Free', tierPro: 'Pro',
    perMonth:       '/ month',
    freeDesc:       'Everything you need to get started with HR compliance at no cost.',
    proDesc:        'Full access to every template, advanced calculators, and priority support — for growing teams.',
    comingSoon:     'Coming Soon',
    tbd:            'TBD',
    fp1: 'Access to core templates', fp2: 'English & French', fp3: 'Basic ESA calculator', fp4: 'PDF export',
    pp1: 'All 16 HR templates', pp2: 'All 14 jurisdictions', pp3: 'Advanced ESA calculator', pp4: 'Unlimited PDF exports', pp5: 'Priority support',
    joinWaitlist:   'Join Waitlist',
    getNotified:    'Get Notified',
    pricingNote:    'Early waitlist members receive founding pricing — locked in for life.',
    pricingNoteLink:'Join now →',
    wlLabel:        'Early Access',
    wlTitle:        'Be first through the door.',
    wlSub:          'Join the waitlist and get notified at launch. Early members get free access and founding pricing.',
    emailPlaceholder:'your@email.com',
    notifyBtn:      'Notify Me',
    wlNote:         'No spam. Unsubscribe anytime. Your data stays in Canada.',
    perk1: 'Launch day access', perk2: 'Founding member pricing', perk3: 'New feature previews',
    aboutLabel:     'About Dutiva Canada',
    aboutTitle:     'Built in Canada.\nBuilt for Canadian employers.',
    aboutP1:        'Dutiva Canada Inc. is a federally incorporated Canadian business dedicated to making HR compliance accessible to small business owners — without the lawyer fees or the guesswork.',
    aboutP1Bold:    'federally incorporated Canadian business',
    aboutP2:        'Canadian employment law is complicated. It varies by province, changes regularly, and getting it wrong is costly. Dutiva brings together bilingual templates, calculators, and compliance tools in one trusted platform.',
    aboutP2Bold:    'bilingual templates, calculators, and compliance tools',
    aboutP3:        "We're pre-launch and building in public. Join the waitlist and help shape what Dutiva becomes.",
    t1h: 'Federally Incorporated',     t1p: 'Registered under Corporations Canada (ISED). A legitimate Canadian business you can trust.',
    t2h: 'Your Data Stays in Canada',  t2p: "Privacy-first by design. We don't sell your information — full PIPEDA compliance.",
    t3h: 'Clear Refund Policy',        t3p: 'Transparent terms with no surprises. Read our full policy before you buy.',
    t4h: 'Jurisdiction-Accurate',      t4p: 'Templates and calculators updated for federal and provincial employment standards.',
    footerCopy:     '© 2026 Dutiva Canada Inc. All rights reserved.',
    fTerms: 'Terms', fPrivacy: 'Privacy', fAccess: 'Accessibility', fAI: 'AI & Technology', fDisclaim: 'Disclaimer',
    successMsg:     "✓ You're on the list",
  },
  fr: {
    navFeatures:    'Fonctionnalités',
    navPricing:     'Tarifs',
    navAbout:       'À propos',
    navCta:         'Accès anticipé',
    heroTagline:    'Le co-pilote RH bilingue pour les petites entreprises canadiennes.',
    heroCta:        'Commencer — Gratuit',
    heroLogin:      'Se connecter à votre compte',
    heroOr:         'ou',
    pill1: '16 modèles', pill2: '14 juridictions', pill3: 'EN / FR', pill4: 'Calculateur LNT', pill5: 'Export PDF',
    featLabel:      'Comment ça fonctionne',
    featTitle:      'La conformité RH, simplifiée.',
    featSub:        "Que vous intégriez votre premier employé ou gériez une équipe en croissance, Dutiva vous donne les outils pour rester conforme dans toutes les juridictions canadiennes.",
    f1h: 'Modèles adaptés aux juridictions', f1p: '16 modèles RH rédigés par des professionnels, calibrés pour 14 juridictions provinciales et fédérales — toujours à jour, jamais génériques.',
    f2h: 'Entièrement bilingue',             f2p: "Chaque document et flux de travail est disponible en anglais et en français — sans frais de traduction ni étapes supplémentaires.",
    f3h: 'Calculateur de conformité LNT',    f3p: "Calculez les délais de préavis, les indemnités de licenciement et les obligations de départ en vertu de la loi sur les normes du travail de votre province.",
    f4h: 'Export PDF, prêt à envoyer',       f4p: "Générez des documents professionnels instantanément. Téléchargez, signez et envoyez — aucune mise en forme requise de votre côté.",
    stat1: 'Modèles RH', stat2: 'Juridictions', stat3: 'Bilingue', stat4: 'Entreprise canadienne',
    pricingLabel:   'Tarifs',
    pricingTitle:   'Des tarifs simples et transparents.',
    pricingSub:     "Nous finalisons nos forfaits. Rejoignez la liste d'attente pour être informé dès la mise en ligne des tarifs — les membres fondateurs bénéficient de tarifs préférentiels.",
    tierFree:       'Gratuit', tierPro: 'Pro',
    perMonth:       '/ mois',
    freeDesc:       "Tout ce qu'il vous faut pour démarrer avec la conformité RH, sans frais.",
    proDesc:        "Accès complet à tous les modèles, calculateurs avancés et assistance prioritaire — pour les équipes en croissance.",
    comingSoon:     'Bientôt disponible',
    tbd:            'À venir',
    fp1: 'Accès aux modèles de base', fp2: 'Anglais et français', fp3: 'Calculateur LNT de base', fp4: 'Export PDF',
    pp1: 'Les 16 modèles RH', pp2: 'Les 14 juridictions', pp3: 'Calculateur LNT avancé', pp4: 'Exports PDF illimités', pp5: 'Assistance prioritaire',
    joinWaitlist:   'Rejoindre la liste',
    getNotified:    'Être notifié',
    pricingNote:    "Les membres fondateurs bénéficient d'un tarif préférentiel à vie.",
    pricingNoteLink:'Rejoindre →',
    wlLabel:        'Accès anticipé',
    wlTitle:        'Soyez parmi les premiers.',
    wlSub:          "Rejoignez la liste d'attente et soyez informé au lancement. Les premiers membres obtiennent un accès gratuit et des tarifs fondateurs.",
    emailPlaceholder:'votre@courriel.com',
    notifyBtn:      "M'avertir",
    wlNote:         "Pas de spam. Désabonnez-vous à tout moment. Vos données restent au Canada.",
    perk1: 'Accès le jour du lancement', perk2: 'Tarifs membres fondateurs', perk3: 'Aperçu des nouvelles fonctionnalités',
    aboutLabel:     'À propos de Dutiva Canada',
    aboutTitle:     'Conçu au Canada.\nPour les employeurs canadiens.',
    aboutP1:        "Dutiva Canada Inc. est une entreprise canadienne constituée en société fédérale, dédiée à rendre la conformité RH accessible aux propriétaires de petites entreprises — sans les frais d'avocat ni les incertitudes.",
    aboutP1Bold:    'entreprise canadienne constituée en société fédérale',
    aboutP2:        "Le droit du travail canadien est complexe. Il varie selon la province, évolue régulièrement, et les erreurs coûtent cher. Dutiva regroupe modèles bilingues, calculateurs et outils de conformité sur une seule plateforme de confiance.",
    aboutP2Bold:    'modèles bilingues, calculateurs et outils de conformité',
    aboutP3:        "Nous sommes en phase de prélancement et construisons ouvertement. Rejoignez la liste d'attente et contribuez à façonner Dutiva.",
    t1h: 'Constituée en société fédérale',  t1p: "Inscrite auprès de Corporations Canada (ISDE). Une entreprise canadienne légitime en qui vous pouvez avoir confiance.",
    t2h: 'Vos données restent au Canada',   t2p: "La confidentialité est notre priorité. Nous ne vendons pas vos données — conformité totale à la LPRPDE.",
    t3h: 'Politique de remboursement claire',t3p: "Des conditions transparentes, sans mauvaises surprises. Lisez notre politique complète avant d'acheter.",
    t4h: 'Précision juridictionnelle',      t4p: "Modèles et calculateurs mis à jour selon les normes d'emploi fédérales et provinciales.",
    footerCopy:     '© 2026 Dutiva Canada Inc. Tous droits réservés.',
    fTerms: 'Conditions', fPrivacy: 'Confidentialité', fAccess: 'Accessibilité', fAI: 'IA et technologie', fDisclaim: 'Avis légal',
    successMsg:     '✓ Vous êtes inscrit',
  },
}

/* ─────────────────────────────────────────
   GLOBAL STYLES (injected once)
───────────────────────────────────────── */
const GLOBAL_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;500;600&family=DM+Sans:wght@300;400;500;600&display=swap');
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  html { scroll-behavior: smooth; }
  body { font-family: 'DM Sans', sans-serif; line-height: 1.6; overflow-x: hidden; }
  @keyframes fadeUp {
    from { opacity: 0; transform: translateY(20px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  .du-reveal { opacity: 0; transform: translateY(22px); transition: opacity 0.6s ease, transform 0.6s ease; }
  .du-reveal.visible { opacity: 1; transform: none; }
  .du-d1 { transition-delay: 0.1s; }
  .du-d2 { transition-delay: 0.2s; }
  .du-d3 { transition-delay: 0.3s; }
  .du-fade-up { animation: fadeUp 0.7s ease both; }
  .du-fade-up-1 { animation: fadeUp 0.7s 0.07s ease both; }
  .du-fade-up-2 { animation: fadeUp 0.7s 0.13s ease both; }
  .du-fade-up-3 { animation: fadeUp 0.7s 0.19s ease both; }
  .du-fade-up-4 { animation: fadeUp 0.7s 0.25s ease both; }
  /* ── Max-width container ── */
  .du-inner { max-width: 1200px; margin: 0 auto; width: 100%; padding-left: 24px; padding-right: 24px; box-sizing: border-box; }
  /* ── Hamburger button ── */
  .du-hamburger { display: none; align-items: center; justify-content: center; cursor: pointer; background: transparent; border: 1px solid transparent; border-radius: 8px; padding: 6px 8px; }
  /* ── Mobile nav drawer ── */
  .du-mobile-nav { display: none; flex-direction: column; position: fixed; top: 64px; left: 0; right: 0; z-index: 99; padding: 16px 24px 24px; gap: 4px; border-bottom-width: 1px; border-bottom-style: solid; }
  .du-mobile-nav.open { display: flex !important; }
  /* ── Mobile breakpoints ── */
  @media (max-width: 860px) {
    .du-nav-links { display: none !important; }
    .du-hamburger { display: flex !important; }
  }
  @media (max-width: 720px) {
    .du-about-grid { grid-template-columns: 1fr !important; gap: 48px !important; }
    .du-stat { border-right: none !important; border-bottom-width: 1px !important; border-bottom-style: solid !important; }
    .du-stat:last-child { border-bottom: none !important; }
    .du-pricing-grid { grid-template-columns: 1fr !important; max-width: 400px !important; }
    .du-section { padding: 72px 0 !important; }
    .du-hero { padding: 110px 0 72px !important; }
    .du-inner { padding-left: 20px !important; padding-right: 20px !important; }
    .du-footer-inner { flex-direction: column !important; align-items: flex-start !important; }
  }
  /* ── Desktop breakpoints ── */
  @media (min-width: 1024px) {
    .du-hero-inner { flex-direction: row !important; text-align: left !important; align-items: center !important; gap: 80px !important; justify-content: space-between !important; }
    .du-hero-text { align-items: flex-start !important; }
    .du-hero-cta { align-items: flex-start !important; max-width: 400px !important; }
    .du-hero-pills { justify-content: flex-start !important; }
    .du-hero-side { display: flex !important; }
    .du-features-grid { grid-template-columns: repeat(2, 1fr) !important; }
  }
`

/* ─────────────────────────────────────────
   HOOK: useReveal
───────────────────────────────────────── */
function useReveal() {
  useEffect(() => {
    const els = document.querySelectorAll('.du-reveal')
    const obs = new IntersectionObserver(entries => {
      entries.forEach(e => { if (e.isIntersecting) e.target.classList.add('visible') })
    }, { threshold: 0.1 })
    els.forEach(el => obs.observe(el))
    return () => obs.disconnect()
  }, [])
}

/* ─────────────────────────────────────────
   MAIN COMPONENT
───────────────────────────────────────── */
export default function LandingPage() {
  const navigate = useNavigate()

  // Theme
  const getInitialTheme = () => {
    const saved = localStorage.getItem('dutiva-theme')
    if (saved) return saved
    return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark'
  }
  const [theme, setTheme] = useState(getInitialTheme)
  const t = THEMES[theme]

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark'
    setTheme(next)
    localStorage.setItem('dutiva-theme', next)
  }

  // Language
  const [lang, setLang] = useState(() => localStorage.getItem('dutiva-lang') || 'en')
  const x = T[lang]

  const switchLang = (l) => {
    setLang(l)
    localStorage.setItem('dutiva-lang', l)
  }

  // Mobile nav
  const [mobileNavOpen, setMobileNavOpen] = useState(false)

  // Waitlist
  const [email, setEmail]       = useState('')
  const [submitted, setSubmitted] = useState(false)

  const handleSignup = (e) => {
    e.preventDefault()
    // TODO: replace with Kit API call when account is ready
    // e.g. POST to https://api.convertkit.com/v3/forms/FORM_ID/subscribe
    setSubmitted(true)
  }

  // Inject global CSS once
  useEffect(() => {
    if (document.getElementById('dutiva-global-css')) return
    const style = document.createElement('style')
    style.id = 'dutiva-global-css'
    style.textContent = GLOBAL_CSS
    document.head.appendChild(style)
  }, [])

  // Update body background on theme change
  useEffect(() => {
    document.body.style.backgroundColor = t.bg
    document.body.style.color = t.text
    document.documentElement.style.background = t.bg
  }, [theme, t.bg, t.text])

  useReveal()

  /* ── Shared style helpers ── */
  const trans = 'background-color 0.35s ease, color 0.35s ease, border-color 0.35s ease'
  const sectionBase = { padding: '96px 0', transition: trans, backgroundColor: t.bg }

  return (
    <div style={{ backgroundColor: t.bg, color: t.text, fontFamily: "'DM Sans', sans-serif", transition: trans, minHeight: '100vh' }}>

      {/* ══ NAV ══ */}
      <nav className="du-nav" style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
        backgroundColor: t.navBg, backdropFilter: 'blur(16px)',
        borderBottom: `1px solid ${t.border}`, transition: trans,
      }}>
        {/* Nav inner */}
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 24px', height: 64, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <a href="#hero" style={{ textDecoration: 'none', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 2 }}>
            <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 22, fontWeight: 500, color: t.text, lineHeight: 1, transition: 'color 0.35s ease' }}>
              Duti<span style={{ color: t.gold }}>va</span>
            </div>
            <div style={{ fontSize: 8, fontWeight: 600, letterSpacing: '0.2em', textTransform: 'uppercase', color: t.gold, border: `1px solid ${t.goldBorder}`, padding: '1px 6px', borderRadius: 2, lineHeight: 1.7, transition: trans }}>
              Canada
            </div>
          </a>

          <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
            <div className="du-nav-links" style={{ display: 'flex', alignItems: 'center', gap: 22 }}>
              {[['#features', x.navFeatures], ['#pricing', x.navPricing], ['#about', x.navAbout]].map(([href, label]) => (
                <a key={href} href={href} style={{ textDecoration: 'none', fontSize: 13, fontWeight: 400, color: t.textMid, letterSpacing: '0.02em', transition: 'color 0.2s' }}
                  onMouseEnter={e => e.target.style.color = t.text}
                  onMouseLeave={e => e.target.style.color = t.textMid}>
                  {label}
                </a>
              ))}
              <a href="#waitlist" style={{ backgroundColor: t.gold, color: '#111', padding: '8px 20px', borderRadius: 100, fontWeight: 600, fontSize: 13, textDecoration: 'none', transition: 'background-color 0.2s', whiteSpace: 'nowrap' }}
                onMouseEnter={e => e.currentTarget.style.backgroundColor = t.goldH}
                onMouseLeave={e => e.currentTarget.style.backgroundColor = t.gold}>
                {x.navCta}
              </a>
            </div>

            {/* Controls */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {/* Language */}
              <div style={{ display: 'flex', border: `1px solid ${t.border}`, borderRadius: 100, overflow: 'hidden', transition: 'border-color 0.35s ease' }}>
                {['en', 'fr'].map(l => (
                  <button key={l} onClick={() => switchLang(l)} style={{
                    background: lang === l ? t.gold : 'transparent',
                    color: lang === l ? '#111' : t.textSoft,
                    border: 'none', cursor: 'pointer',
                    fontFamily: "'DM Sans', sans-serif", fontSize: 12, fontWeight: 600,
                    letterSpacing: '0.05em', padding: '5px 12px',
                    transition: 'background-color 0.2s, color 0.2s',
                  }}>
                    {l.toUpperCase()}
                  </button>
                ))}
              </div>
              {/* Theme */}
              <button onClick={toggleTheme} title="Toggle light/dark mode" style={{
                background: 'transparent', border: `1px solid ${t.border}`, borderRadius: 100,
                cursor: 'pointer', width: 34, height: 28, display: 'flex', alignItems: 'center',
                justifyContent: 'center', fontSize: 14, color: t.textSoft,
                transition: 'border-color 0.35s ease, background-color 0.2s',
              }}
                onMouseEnter={e => e.currentTarget.style.backgroundColor = t.border}
                onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}>
                {theme === 'dark' ? '🌙' : '☀️'}
              </button>
              {/* Hamburger */}
              <button className="du-hamburger" onClick={() => setMobileNavOpen(o => !o)}
                style={{ borderColor: mobileNavOpen ? t.gold : t.border, color: t.textSoft, transition: trans }}>
                <svg width="18" height="14" viewBox="0 0 18 14" fill="none">
                  {mobileNavOpen
                    ? <><line x1="1" y1="1" x2="17" y2="13" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/><line x1="17" y1="1" x2="1" y2="13" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></>
                    : <><line x1="0" y1="1" x2="18" y2="1" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/><line x1="0" y1="7" x2="18" y2="7" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/><line x1="0" y1="13" x2="18" y2="13" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></>
                  }
                </svg>
              </button>
            </div>
          </div>
        </div>

        {/* Mobile nav drawer */}
        <div className={`du-mobile-nav${mobileNavOpen ? ' open' : ''}`}
          style={{ backgroundColor: t.navBg, backdropFilter: 'blur(16px)', borderBottomColor: t.border, transition: trans }}>
          {[['#features', x.navFeatures], ['#pricing', x.navPricing], ['#about', x.navAbout]].map(([href, label]) => (
            <a key={href} href={href} onClick={() => setMobileNavOpen(false)}
              style={{ textDecoration: 'none', fontSize: 15, fontWeight: 400, color: t.textMid, padding: '12px 0', borderBottom: `1px solid ${t.border}`, transition: 'color 0.2s' }}>
              {label}
            </a>
          ))}
          <a href="#waitlist" onClick={() => setMobileNavOpen(false)}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: 12, backgroundColor: t.gold, color: '#111', padding: '12px 20px', borderRadius: 100, fontWeight: 600, fontSize: 14, textDecoration: 'none' }}>
            {x.navCta}
          </a>
        </div>
      </nav>

      {/* ══ HERO ══ */}
      <section id="hero" className="du-hero" style={{
        minHeight: '100vh', backgroundColor: t.bg,
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        padding: '130px 0 90px', textAlign: 'center', position: 'relative', overflow: 'hidden',
        transition: trans,
      }}>
        {/* Glow */}
        <div style={{ position: 'absolute', top: -180, left: '50%', transform: 'translateX(-50%)', width: 800, height: 500, borderRadius: '50%', background: `radial-gradient(ellipse, ${t.glow} 0%, transparent 65%)`, pointerEvents: 'none', zIndex: 0, transition: 'background 0.35s ease' }} />
        {/* Desktop: 2-col hero inner */}
        <div className="du-hero-inner du-inner" style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>

          {/* Left / text side */}
          <div className="du-hero-text" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1 }}>
            <div className="du-fade-up" style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 'clamp(64px, 12vw, 108px)', fontWeight: 500, lineHeight: 1, letterSpacing: '-0.01em', color: t.text, marginBottom: 12, transition: 'color 0.35s ease' }}>
              Duti<span style={{ color: t.gold }}>va</span>
            </div>
            <div className="du-fade-up-1" style={{ display: 'inline-block', fontSize: 10, fontWeight: 600, letterSpacing: '0.22em', textTransform: 'uppercase', color: t.gold, border: `1px solid ${t.goldBorder}`, padding: '4px 14px', borderRadius: 3, marginBottom: 32, transition: trans }}>
              Canada
            </div>
            <p className="du-fade-up-2" style={{ fontSize: 'clamp(16px, 1.8vw, 19px)', color: t.textMid, fontWeight: 300, maxWidth: 480, lineHeight: 1.75, marginBottom: 44, transition: 'color 0.35s ease' }}>
              {x.heroTagline}
            </p>

            <div className="du-hero-cta du-fade-up-3" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, width: '100%', maxWidth: 400 }}>
              <a href="#waitlist" style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: t.gold, color: '#111', padding: '16px 32px', borderRadius: 100, fontSize: 15, fontWeight: 600, textDecoration: 'none', border: 'none', cursor: 'pointer', transition: 'background-color 0.2s, transform 0.15s' }}
                onMouseEnter={e => { e.currentTarget.style.backgroundColor = t.goldH; e.currentTarget.style.transform = 'translateY(-1px)' }}
                onMouseLeave={e => { e.currentTarget.style.backgroundColor = t.gold; e.currentTarget.style.transform = 'translateY(0)' }}>
                {x.heroCta}
              </a>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14, width: '100%', color: t.textMuted, fontSize: 13 }}>
                <div style={{ flex: 1, height: 1, backgroundColor: t.border }} />
                {x.heroOr}
                <div style={{ flex: 1, height: 1, backgroundColor: t.border }} />
              </div>
              <button onClick={() => navigate('/login')} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: t.bgSlate, color: t.text, padding: '16px 32px', borderRadius: 100, fontSize: 15, fontWeight: 500, border: 'none', cursor: 'pointer', transition: 'background-color 0.2s, color 0.35s ease' }}
                onMouseEnter={e => e.currentTarget.style.backgroundColor = t.bgSlateH}
                onMouseLeave={e => e.currentTarget.style.backgroundColor = t.bgSlate}>
                {x.heroLogin}
              </button>
            </div>

            <div className="du-hero-pills du-fade-up-4" style={{ marginTop: 44, display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              {[x.pill1, x.pill2, x.pill3, x.pill4, x.pill5].map(p => (
                <span key={p} style={{ fontSize: 12, color: t.pillText, backgroundColor: t.pillBg, border: `1px solid ${t.border}`, padding: '5px 14px', borderRadius: 100, letterSpacing: '0.02em', transition: trans }}>
                  {p}
                </span>
              ))}
            </div>
          </div>

          {/* Right / desktop feature panel — hidden on mobile */}
          <div className="du-hero-side" style={{ display: 'none', flex: '0 0 420px', flexDirection: 'column', gap: 12 }}>
            {[
              ['⚖️', x.f1h, x.f1p],
              ['🌐', x.f2h, x.f2p],
              ['📄', x.f4h, x.f4p],
            ].map(([icon, h, p]) => (
              <div key={h} style={{ backgroundColor: t.bgCard, border: `1px solid ${t.border}`, borderRadius: 14, padding: '20px 22px', display: 'flex', gap: 14, alignItems: 'flex-start', transition: trans }}>
                <div style={{ width: 36, height: 36, borderRadius: 9, backgroundColor: t.goldDim, border: `1px solid ${t.goldBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0 }}>{icon}</div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: t.text, marginBottom: 4 }}>{h}</div>
                  <div style={{ fontSize: 12, color: t.textMid, lineHeight: 1.55 }}>{p}</div>
                </div>
              </div>
            ))}
            <div style={{ backgroundColor: t.bgCard, border: `1px solid ${t.goldBorder}`, borderRadius: 14, padding: '18px 22px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', transition: trans }}>
              <div style={{ fontSize: 13, color: t.textMid }}>Jurisdictions covered</div>
              <div style={{ display: 'flex', gap: 6 }}>
                {['ON','QC','BC','AB','FED'].map(p => (
                  <span key={p} style={{ fontSize: 10, fontWeight: 700, color: t.gold, backgroundColor: t.goldDim, border: `1px solid ${t.goldBorder}`, padding: '3px 7px', borderRadius: 4 }}>{p}</span>
                ))}
                <span style={{ fontSize: 10, fontWeight: 700, color: t.textSoft, padding: '3px 7px' }}>+9</span>
              </div>
            </div>
          </div>

        </div>
      </section>

      {/* ══ FEATURES ══ */}
      <section id="features" className="du-section du-reveal" style={{ ...sectionBase, borderTop: `1px solid ${t.border}` }}>
        <div className="du-inner">
          <div style={{ maxWidth: 580, marginBottom: 64 }}>
            <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.2em', textTransform: 'uppercase', color: t.gold, marginBottom: 16 }}>{x.featLabel}</div>
            <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 'clamp(30px, 4vw, 48px)', fontWeight: 500, lineHeight: 1.15, color: t.text, marginBottom: 18 }}>{x.featTitle}</h2>
            <p style={{ fontSize: 16, color: t.textMid, fontWeight: 300, lineHeight: 1.8 }}>{x.featSub}</p>
          </div>
          <div className="du-features-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', border: `1px solid ${t.border}`, borderRadius: 16, overflow: 'hidden', gap: 1, backgroundColor: t.featGap, boxShadow: t.shadow }}>
            {[[1, x.f1h, x.f1p], [2, x.f2h, x.f2p], [3, x.f3h, x.f3p], [4, x.f4h, x.f4p]].map(([n, h, p]) => (
              <FeatureCard key={n} num={`0${n}`} title={h} desc={p} t={t} />
            ))}
          </div>
        </div>
      </section>

      {/* ══ STATS ══ */}
      <section style={{ backgroundColor: t.statsBg, borderTop: `1px solid ${t.border}`, borderBottom: `1px solid ${t.border}`, padding: '64px 0', boxShadow: t.shadow, transition: trans }}>
        <div className="du-inner">
        <div style={{ display: 'flex', alignItems: 'stretch', justifyContent: 'center', flexWrap: 'wrap' }}>
          {[['16', x.stat1], ['14', x.stat2], ['EN/FR', x.stat3], ['🍁', x.stat4]].map(([val, label], i) => (
            <div key={label} className={`du-stat du-reveal${i > 0 ? ` du-d${i}` : ''}`}
              style={{ flex: 1, minWidth: 150, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: '28px 20px', borderRight: `1px solid ${t.border}`, transition: trans }}>
              <strong style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 44, fontWeight: 500, color: t.gold, lineHeight: 1 }}>{val}</strong>
              <span style={{ fontSize: 12, color: t.textSoft, letterSpacing: '0.06em', textTransform: 'uppercase' }}>{label}</span>
            </div>
          ))}
        </div>
        </div>
      </section>

      {/* ══ PRICING ══ */}
      <section id="pricing" className="du-section du-reveal" style={{ ...sectionBase, borderTop: `1px solid ${t.border}` }}>
        <div className="du-inner">
        <div style={{ maxWidth: 560, marginBottom: 56 }}>
          <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.2em', textTransform: 'uppercase', color: t.gold, marginBottom: 16 }}>{x.pricingLabel}</div>
          <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 'clamp(30px, 4vw, 48px)', fontWeight: 500, lineHeight: 1.15, color: t.text, marginBottom: 18 }}>{x.pricingTitle}</h2>
          <p style={{ fontSize: 16, color: t.textMid, fontWeight: 300, lineHeight: 1.8 }}>{x.pricingSub}</p>
        </div>
        <div className="du-pricing-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 20, maxWidth: 860 }}>
          {/* Free */}
          <div style={{ backgroundColor: t.pricingBg, border: `1px solid ${t.border}`, borderRadius: 16, padding: '40px 36px', display: 'flex', flexDirection: 'column', gap: 24, boxShadow: t.shadow, transition: trans }}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, letterSpacing: '0.14em', textTransform: 'uppercase', color: t.textSoft, marginBottom: 8 }}>{x.tierFree}</div>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4 }}>
                <span style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 52, fontWeight: 500, color: t.text, lineHeight: 1 }}>$0</span>
                <span style={{ fontSize: 14, color: t.textMuted, paddingBottom: 8 }}>{x.perMonth}</span>
              </div>
            </div>
            <p style={{ fontSize: 14, color: t.textMid, fontWeight: 300, lineHeight: 1.65 }}>{x.freeDesc}</p>
            <div style={{ height: 1, backgroundColor: t.border }} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {[x.fp1, x.fp2, x.fp3, x.fp4].map(f => <PricingFeature key={f} text={f} t={t} />)}
            </div>
            <a href="#waitlist" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '13px 24px', borderRadius: 100, fontSize: 14, fontWeight: 600, textDecoration: 'none', backgroundColor: 'transparent', color: t.textMid, border: `1px solid ${t.border}`, transition: 'border-color 0.2s, color 0.2s' }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = t.textSoft; e.currentTarget.style.color = t.text }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = t.border; e.currentTarget.style.color = t.textMid }}>
              {x.joinWaitlist}
            </a>
          </div>
          {/* Pro */}
          <div style={{ backgroundColor: t.pricingFeat, border: `1px solid ${t.goldBorder}`, borderRadius: 16, padding: '40px 36px', display: 'flex', flexDirection: 'column', gap: 24, position: 'relative', boxShadow: t.shadow, transition: trans }}>
            <div style={{ position: 'absolute', top: -12, left: '50%', transform: 'translateX(-50%)', backgroundColor: t.gold, color: '#111', fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', padding: '4px 14px', borderRadius: 100, whiteSpace: 'nowrap' }}>
              {x.comingSoon}
            </div>
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, letterSpacing: '0.14em', textTransform: 'uppercase', color: t.textSoft, marginBottom: 8 }}>{x.tierPro}</div>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4 }}>
                <span style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 36, fontWeight: 500, color: t.textSoft, lineHeight: 1, fontStyle: 'italic' }}>{x.tbd}</span>
              </div>
            </div>
            <p style={{ fontSize: 14, color: t.textMid, fontWeight: 300, lineHeight: 1.65 }}>{x.proDesc}</p>
            <div style={{ height: 1, backgroundColor: t.border }} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {[x.pp1, x.pp2, x.pp3, x.pp4, x.pp5].map(f => <PricingFeature key={f} text={f} t={t} />)}
            </div>
            <a href="#waitlist" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '13px 24px', borderRadius: 100, fontSize: 14, fontWeight: 600, textDecoration: 'none', backgroundColor: t.gold, color: '#111', transition: 'background-color 0.2s, transform 0.15s' }}
              onMouseEnter={e => { e.currentTarget.style.backgroundColor = t.goldH; e.currentTarget.style.transform = 'translateY(-1px)' }}
              onMouseLeave={e => { e.currentTarget.style.backgroundColor = t.gold; e.currentTarget.style.transform = 'translateY(0)' }}>
              {x.getNotified}
            </a>
          </div>
        </div>
        <p className="du-reveal" style={{ textAlign: 'center', fontSize: 13, color: t.textMuted, marginTop: 32 }}>
          {x.pricingNote}{' '}
          <a href="#waitlist" style={{ color: t.gold, textDecoration: 'none' }}>{x.pricingNoteLink}</a>
        </p>
        </div>
      </section>

      {/* ══ WAITLIST ══ */}
      <section id="waitlist" style={{ backgroundColor: t.bg, borderTop: `1px solid ${t.border}`, padding: '120px 0', textAlign: 'center', position: 'relative', overflow: 'hidden', transition: trans }}>
        <div style={{ position: 'absolute', bottom: -200, left: '50%', transform: 'translateX(-50%)', width: 700, height: 400, borderRadius: '50%', background: `radial-gradient(ellipse, ${t.glowB} 0%, transparent 65%)`, pointerEvents: 'none' }} />
        <div className="du-inner" style={{ position: 'relative', zIndex: 1 }}>
        <div style={{ maxWidth: 520, margin: '0 auto' }}>
          <div className="du-reveal" style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.2em', textTransform: 'uppercase', color: t.gold, marginBottom: 16 }}>{x.wlLabel}</div>
          <h2 className="du-reveal du-d1" style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 'clamp(30px, 4vw, 48px)', fontWeight: 500, lineHeight: 1.15, color: t.text, marginBottom: 18 }}>{x.wlTitle}</h2>
          <p className="du-reveal du-d2" style={{ fontSize: 16, color: t.textMid, fontWeight: 300, lineHeight: 1.8, marginBottom: 48 }}>{x.wlSub}</p>

          {/* ── Kit embed goes here ──
              When ready: replace this form with:
              <script async data-uid="XXXXXXXX" src="https://YOUR_ACCOUNT.ck.page/XXXXXXXX/index.js"></script>
          */}
          <form className="du-reveal du-d3" onSubmit={handleSignup} style={{ display: 'flex', backgroundColor: t.bgInput, border: `1px solid ${t.border}`, borderRadius: 100, padding: '5px 5px 5px 22px', maxWidth: 460, margin: '0 auto', boxShadow: t.shadow, transition: trans }}>
            <input
              type="email" required
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder={x.emailPlaceholder}
              disabled={submitted}
              style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', fontSize: 14, fontFamily: "'DM Sans', sans-serif", color: t.text, minWidth: 0 }}
            />
            <button type="submit" disabled={submitted} style={{ backgroundColor: submitted ? '#3a6b4a' : t.gold, color: submitted ? '#fff' : '#111', border: 'none', borderRadius: 100, padding: '11px 22px', fontSize: 13, fontWeight: 600, fontFamily: "'DM Sans', sans-serif", cursor: submitted ? 'default' : 'pointer', whiteSpace: 'nowrap', transition: 'background-color 0.2s' }}>
              {submitted ? x.successMsg : x.notifyBtn}
            </button>
          </form>

          <p className="du-reveal" style={{ marginTop: 14, fontSize: 12, color: t.textMuted }}>{x.wlNote}</p>
          <div className="du-reveal" style={{ display: 'flex', justifyContent: 'center', gap: 28, flexWrap: 'wrap', marginTop: 52, paddingTop: 44, borderTop: `1px solid ${t.border}` }}>
            {[x.perk1, x.perk2, x.perk3].map(p => (
              <div key={p} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 5, height: 5, borderRadius: '50%', backgroundColor: t.gold, flexShrink: 0 }} />
                <span style={{ fontSize: 13, color: t.textMid }}>{p}</span>
              </div>
            ))}
          </div>
        </div>
        </div>
      </section>

      {/* ══ ABOUT ══ */}
      <section id="about" className="du-section" style={{ backgroundColor: t.aboutBg, borderTop: `1px solid ${t.border}`, padding: '96px 0', boxShadow: t.shadow, transition: trans }}>
        <div className="du-inner">
        <div className="du-reveal">
          <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.2em', textTransform: 'uppercase', color: t.gold, marginBottom: 16 }}>{x.aboutLabel}</div>
          <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 'clamp(30px, 4vw, 48px)', fontWeight: 500, lineHeight: 1.15, color: t.text, marginBottom: 18 }}>
            {x.aboutTitle.split('\n').map((line, i) => <span key={i}>{line}{i === 0 && <br />}</span>)}
          </h2>
        </div>
        <div className="du-about-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 80, alignItems: 'start', marginTop: 56 }}>
          <div className="du-reveal">
            <AboutPara text={x.aboutP1} bold={x.aboutP1Bold} t={t} />
            <AboutPara text={x.aboutP2} bold={x.aboutP2Bold} t={t} />
            <p style={{ fontSize: 15, color: t.textMid, fontWeight: 300, lineHeight: 1.9 }}>{x.aboutP3}</p>
          </div>
          <div className="du-reveal du-d1">
            {[
              ['🍁', x.t1h, x.t1p],
              ['🔒', x.t2h, x.t2p],
              ['📄', x.t3h, x.t3p],
              ['⚖️', x.t4h, x.t4p],
            ].map(([icon, h, p], i) => (
              <div key={h} style={{ display: 'flex', alignItems: 'flex-start', gap: 18, padding: '22px 0', borderTop: i === 0 ? `1px solid ${t.border}` : 'none', borderBottom: `1px solid ${t.border}`, transition: 'border-color 0.35s ease' }}>
                <div style={{ width: 38, height: 38, borderRadius: 9, backgroundColor: t.goldDim, border: `1px solid ${t.goldBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0, transition: trans }}>
                  {icon}
                </div>
                <div>
                  <strong style={{ display: 'block', fontSize: 14, fontWeight: 600, color: t.text, marginBottom: 3 }}>{h}</strong>
                  <span style={{ fontSize: 13, color: t.textMid, lineHeight: 1.55 }}>{p}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
        </div>
      </section>

      {/* ══ FOOTER ══ */}
      <footer style={{ backgroundColor: t.footerBg, borderTop: `1px solid ${t.border}`, padding: '36px 0', transition: trans }}>
        <div className="du-footer-inner du-inner" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 20 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 17, fontWeight: 500, color: t.text }}>
            Duti<span style={{ color: t.gold }}>va</span> Canada Inc.
          </div>
          <div style={{ fontSize: 12, color: t.textMuted }}>{x.footerCopy}</div>
        </div>
        <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
          {[['/terms', x.fTerms], ['/privacy', x.fPrivacy], ['/accessibility', x.fAccess], ['/ai-technology', x.fAI], ['/disclaimer', x.fDisclaim]].map(([href, label]) => (
            <a key={href} href={href} style={{ fontSize: 12, color: t.textMuted, textDecoration: 'underline', textUnderlineOffset: 3, transition: 'color 0.2s' }}
              onMouseEnter={e => e.target.style.color = t.textMid}
              onMouseLeave={e => e.target.style.color = t.textMuted}>
              {label}
            </a>
          ))}
        </div>
        </div>
      </footer>
    </div>
  )
}

/* ─────────────────────────────────────────
   SUB-COMPONENTS
───────────────────────────────────────── */
function FeatureCard({ num, title, desc, t }) {
  const [hovered, setHovered] = useState(false)
  return (
    <div onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
      style={{ backgroundColor: hovered ? t.featBgH : t.featBg, padding: '40px 34px', display: 'flex', flexDirection: 'column', gap: 14, transition: 'background-color 0.2s' }}>
      <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 34, fontWeight: 400, color: t.gold, opacity: 0.5, lineHeight: 1 }}>{num}</div>
      <h3 style={{ fontSize: 16, fontWeight: 600, color: t.text }}>{title}</h3>
      <p style={{ fontSize: 14, color: t.textMid, fontWeight: 300, lineHeight: 1.75 }}>{desc}</p>
    </div>
  )
}

function PricingFeature({ text, t }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, fontSize: 14, color: t.textMid }}>
      <span style={{ color: t.gold, fontSize: 12, flexShrink: 0, marginTop: 2 }}>✦</span>
      <span>{text}</span>
    </div>
  )
}

function AboutPara({ text, bold, t }) {
  const parts = text.split(bold)
  return (
    <p style={{ fontSize: 15, color: t.textMid, fontWeight: 300, lineHeight: 1.9, marginBottom: 20 }}>
      {parts[0]}<strong style={{ color: t.text, fontWeight: 500 }}>{bold}</strong>{parts[1]}
    </p>
  )
}