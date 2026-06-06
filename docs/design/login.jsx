// Orion — Login screen. Focused, single-column. Mark is a constellation
// traced as a t-shirt silhouette with Orion's belt as the chest emblem.
// Depends on: React, Icon (icons.jsx), TweaksPanel + helpers (tweaks-panel.jsx).

const LOGIN_DEFAULTS = /*EDITMODE-BEGIN*/{
  "mode": "signin",
  "accent": "#1e40af",
  "socials": true
}/*EDITMODE-END*/;

// ───────── Provider marks ─────────
const GoogleMark = () => (
  <svg width="16" height="16" viewBox="0 0 48 48" aria-hidden="true">
    <path fill="#4285F4" d="M45.12 24.5c0-1.56-.14-3.06-.4-4.5H24v8.51h11.84c-.51 2.75-2.06 5.08-4.39 6.64v5.52h7.11c4.16-3.83 6.56-9.47 6.56-16.17z"/>
    <path fill="#34A853" d="M24 46c5.94 0 10.92-1.97 14.56-5.33l-7.11-5.52c-1.97 1.32-4.49 2.1-7.45 2.1-5.73 0-10.58-3.87-12.31-9.07H4.34v5.7C7.96 41.07 15.4 46 24 46z"/>
    <path fill="#FBBC05" d="M11.69 28.18C11.25 26.86 11 25.45 11 24s.25-2.86.69-4.18v-5.7H4.34C2.85 17.09 2 20.45 2 24c0 3.55.85 6.91 2.34 9.88l7.35-5.7z"/>
    <path fill="#EA4335" d="M24 10.75c3.23 0 6.13 1.11 8.41 3.29l6.31-6.31C34.91 4.18 29.93 2 24 2 15.4 2 7.96 6.93 4.34 14.12l7.35 5.7C13.42 14.62 18.27 10.75 24 10.75z"/>
  </svg>
);
const MicrosoftMark = () => (
  <svg width="14" height="14" viewBox="0 0 22 22" aria-hidden="true">
    <rect x="0"  y="0"  width="10" height="10" fill="#F25022"/>
    <rect x="12" y="0"  width="10" height="10" fill="#7FBA00"/>
    <rect x="0"  y="12" width="10" height="10" fill="#00A4EF"/>
    <rect x="12" y="12" width="10" height="10" fill="#FFB900"/>
  </svg>
);
const AppleMark = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">
    <path d="M16.365 1.43c0 1.14-.42 2.23-1.18 3.06-.76.84-2 .15-2 .15-.04-1.04.42-2.08 1.13-2.84.78-.83 1.99-1.46 2.05-.37zM20.5 17.2c-.6 1.4-1.32 2.78-2.47 2.8-1.13.02-1.5-.67-3-.67s-1.9.65-3 .69c-1.18.05-2.07-1.5-2.7-2.92-1.28-2.92-2.27-8.26.95-11.43.79-.78 2.18-1.27 3.6-1.29 1.18-.02 2.3.68 3 .68.7 0 2.1-.83 3.55-.71.6.03 2.3.24 3.4 1.84-.09.06-2.04 1.18-2 3.5.04 2.76 2.45 3.69 2.48 3.7-.02.07-.39 1.32-1.29 2.5z"/>
  </svg>
);

// ───────── Brand mark: t-shirt outlined in stars, Orion's belt at chest ─────────
const ShirtConstellation = ({ size = 110, twinkle = true, animate = true }) => {
  // Outline of a t-shirt — 11 stars traversed in order.
  const outline = [
    { id: 'collar-l',    x: 42, y: 20, r: 2.0 },
    { id: 'shoulder-l',  x: 23, y: 25, r: 2.4 },
    { id: 'sleeve-l',    x: 12, y: 43, r: 1.7 },
    { id: 'armpit-l',    x: 32, y: 41, r: 1.4 },
    { id: 'hem-l',       x: 28, y: 86, r: 2.4 },
    { id: 'hem-r',       x: 72, y: 86, r: 2.4 },
    { id: 'armpit-r',    x: 68, y: 41, r: 1.4 },
    { id: 'sleeve-r',    x: 88, y: 43, r: 1.7 },
    { id: 'shoulder-r',  x: 77, y: 25, r: 2.4 },
    { id: 'collar-r',    x: 58, y: 20, r: 2.0 },
    { id: 'neckline',    x: 50, y: 26, r: 1.3 },
  ];
  const belt = [
    { id: 'mintaka', x: 40, y: 56, r: 1.8 },
    { id: 'alnilam', x: 50, y: 58, r: 2.1 },
    { id: 'alnitak', x: 60, y: 56, r: 1.8 },
  ];
  const outlineOrder = [
    'collar-l','shoulder-l','sleeve-l','armpit-l','hem-l',
    'hem-r','armpit-r','sleeve-r','shoulder-r','collar-r',
    'neckline','collar-l',
  ];
  const all = [...outline, ...belt];

  // Refs for rAF-driven position updates (avoids React re-renders;
  // keeps SMIL twinkle uninterrupted)
  const dotRefs    = React.useRef([]);
  const haloRefs   = React.useRef([]);
  const outlineRef = React.useRef(null);
  const beltRef    = React.useRef(null);

  React.useEffect(() => {
    if (!animate) return;
    let raf;
    // Per-star phase so the constellation drifts organically, not in lockstep
    const phases = all.map((_, i) => ({
      px: i * 1.73 + 0.4,
      py: i * 2.11 + 1.1,
      fx: 0.42 + (i % 3) * 0.08,
      fy: 0.36 + (i % 4) * 0.06,
    }));
    const amp = 0.55; // SVG units in a 100-unit viewBox = ~0.55% drift

    const tick = () => {
      const t = performance.now() / 1000;
      const animated = all.map((s, i) => {
        const ph = phases[i];
        return {
          id: s.id,
          x: s.x + Math.sin(t * ph.fx + ph.px) * amp,
          y: s.y + Math.cos(t * ph.fy + ph.py) * amp,
        };
      });
      const byId = {};
      animated.forEach(p => { byId[p.id] = p; });

      // Move each star's halo + dot
      animated.forEach((p, i) => {
        const dot  = dotRefs.current[i];
        const halo = haloRefs.current[i];
        if (dot)  { dot.setAttribute('cx', p.x);  dot.setAttribute('cy', p.y); }
        if (halo) { halo.setAttribute('cx', p.x); halo.setAttribute('cy', p.y); }
      });

      // Re-stitch the outline polyline
      if (outlineRef.current) {
        outlineRef.current.setAttribute(
          'points',
          outlineOrder.map(id => `${byId[id].x},${byId[id].y}`).join(' ')
        );
      }
      // Re-stitch the belt polyline
      if (beltRef.current) {
        beltRef.current.setAttribute(
          'points',
          belt.map(s => `${byId[s.id].x},${byId[s.id].y}`).join(' ')
        );
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [animate]);

  return (
    <svg width={size} height={size} viewBox="0 0 100 105" aria-hidden="true"
         style={{ display: 'block', overflow: 'visible' }}>
      <defs>
        <radialGradient id="orion-glow" cx="50%" cy="55%" r="55%">
          <stop offset="0%"   stopColor="currentColor" stopOpacity="0.10"/>
          <stop offset="100%" stopColor="currentColor" stopOpacity="0"/>
        </radialGradient>
      </defs>
      <circle cx="50" cy="55" r="50" fill="url(#orion-glow)"/>

      {/* T-shirt outline */}
      <polyline ref={outlineRef}
        points={outlineOrder.map(id => {
          const s = all.find(x => x.id === id);
          return `${s.x},${s.y}`;
        }).join(' ')}
        fill="none" stroke="currentColor" strokeWidth="0.4"
        strokeLinecap="round" strokeLinejoin="round" opacity="0.45"/>

      {/* Belt */}
      <polyline ref={beltRef}
        points={belt.map(p => `${p.x},${p.y}`).join(' ')}
        fill="none" stroke="currentColor" strokeWidth="0.4"
        strokeLinecap="round" opacity="0.55"/>

      {/* Stars */}
      {all.map((s, i) => (
        <g key={s.id}>
          <circle
            ref={el => { haloRefs.current[i] = el; }}
            cx={s.x} cy={s.y} r={s.r * 2.2}
            fill="currentColor" opacity="0.08"/>
          <circle
            ref={el => { dotRefs.current[i] = el; }}
            cx={s.x} cy={s.y} r={s.r}
            fill="currentColor">
            {twinkle && (
              <animate attributeName="opacity"
                       values="1;0.5;1" dur={`${2.6 + (i % 5) * 0.5}s`}
                       repeatCount="indefinite" begin={`${(i % 7) * 0.35}s`}/>
            )}
          </circle>
        </g>
      ))}
    </svg>
  );
};

// ───────── Provider row ─────────
const ProviderRow = () => {
  const providers = [
    { id: 'google',    label: 'Google',    Mark: GoogleMark },
    { id: 'microsoft', label: 'Microsoft', Mark: MicrosoftMark },
    { id: 'apple',     label: 'Apple',     Mark: AppleMark },
  ];
  return (
    <div className="prov-row">
      {providers.map(p => (
        <button key={p.id} className="prov-btn" type="button"
                aria-label={`Continuar com ${p.label}`}
                onClick={e => e.preventDefault()}>
          <span className="prov-mark"><p.Mark/></span>
          <span className="prov-label">{p.label}</span>
        </button>
      ))}
    </div>
  );
};

// ───────── Form (mode-aware) ─────────
const ModeCopy = {
  signin: { title: 'Entrar',           sub: '',                                          cta: 'Entrar',            switchTo: 'signup', switchTxt: 'Ainda não tem conta?', switchCta: 'Criar acesso' },
  signup: { title: 'Criar conta',      sub: 'Em menos de um minuto.',                         cta: 'Criar conta',       switchTo: 'signin', switchTxt: 'Já tem conta?',         switchCta: 'Entrar' },
  magic:  { title: 'Link por e-mail',  sub: 'Sem senha — mandamos um link de acesso.',        cta: 'Enviar link',       switchTo: 'signin', switchTxt: 'Prefere a senha?',      switchCta: 'Voltar ao login' },
  forgot: { title: 'Recuperar acesso', sub: 'Enviamos as instruções para o seu e-mail.',      cta: 'Enviar instruções', switchTo: 'signin', switchTxt: 'Lembrou a senha?',      switchCta: 'Voltar ao login' },
};

const Form = ({ mode, socials, setTweak }) => {
  const copy = ModeCopy[mode];
  const [showPw, setShowPw] = React.useState(false);
  const [email, setEmail]   = React.useState('felipe@undergroundsp.com.br');
  const [pw, setPw]         = React.useState('••••••••••');
  const showPassword = mode === 'signin' || mode === 'signup';
  const showName     = mode === 'signup';
  const showForgot   = mode === 'signin';
  const showSocials  = socials && (mode === 'signin' || mode === 'signup');
  const showMagicHint = mode === 'signin';

  return (
    <form className="lf-form" onSubmit={e => e.preventDefault()}>
      <header className="lf-head">
        <h1 className="lf-title">{copy.title}</h1>
        {copy.sub && <p className="lf-sub">{copy.sub}</p>}
      </header>

      {showSocials && (
        <>
          <ProviderRow/>
          <div className="lf-or">
            <span className="lf-or-line"/>
            <span className="lf-or-text">ou com e-mail</span>
            <span className="lf-or-line"/>
          </div>
        </>
      )}

      {showName && (
        <label className="lf-field">
          <span className="lf-lab">Seu nome</span>
          <input type="text" className="lf-inp" defaultValue="Felipe Andrade" autoComplete="name"/>
        </label>
      )}

      <label className="lf-field">
        <span className="lf-lab">E-mail</span>
        <input type="email" className="lf-inp"
               value={email} onChange={e => setEmail(e.target.value)}
               autoComplete="email"
               placeholder="voce@suaconfeccao.com.br"/>
      </label>

      {showPassword && (
        <label className="lf-field">
          <span className="lf-lab-row">
            <span className="lf-lab">Senha</span>
            {showForgot && (
              <button type="button" className="lf-link-mini"
                      onClick={() => setTweak('mode', 'forgot')}>
                Esqueci a senha
              </button>
            )}
          </span>
          <span className="lf-inp-wrap">
            <input type={showPw ? 'text' : 'password'} className="lf-inp"
                   value={pw} onChange={e => setPw(e.target.value)}
                   autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}/>
            <button type="button" className="lf-eye"
                    onClick={() => setShowPw(v => !v)}
                    aria-label={showPw ? 'Ocultar senha' : 'Mostrar senha'}>
              <Icon name={showPw ? 'eye-off' : 'eye'} size={15}/>
            </button>
          </span>
          {mode === 'signup' && (
            <span className="lf-help">Mínimo 8 caracteres, com pelo menos um número.</span>
          )}
        </label>
      )}

      {mode === 'signup' && (
        <label className="lf-check">
          <span className="lf-check-box"><Icon name="check" size={11}/></span>
          <span>Concordo com os <a href="#">Termos</a> e a <a href="#">Privacidade</a>.</span>
        </label>
      )}

      <button type="submit" className="lf-submit">
        <span>{copy.cta}</span>
        <Icon name="arrow-right" size={16}/>
      </button>

      {showMagicHint && (
        <button type="button" className="lf-magic"
                onClick={() => setTweak('mode', 'magic')}>
          <Icon name="sparkles" size={15}/>
          <span>Receber um link por e-mail</span>
        </button>
      )}

      {(mode === 'magic' || mode === 'forgot') && (
        <div className="lf-switch">
          <button type="button" className="lf-link"
                  onClick={() => setTweak('mode', 'signin')}>
            <Icon name="arrow-left" size={13}/>
            <span>Voltar ao login</span>
          </button>
        </div>
      )}
    </form>
  );
};

// ───────── Root ─────────
function LoginApp() {
  const [t, setTweak] = useTweaks(LOGIN_DEFAULTS);
  React.useEffect(() => {
    document.documentElement.style.setProperty('--accent', t.accent);
  }, [t.accent]);

  return (
    <div className="lf-shell">
      {/* Background watermark — constellation traced as a t-shirt */}
      <div className="lf-watermark" aria-hidden="true">
        <ShirtConstellation size={900} twinkle={true}/>
      </div>

      {/* Brand chip — top left */}
      <div className="lf-brand-chip">
        <span className="lf-chip-mark"><ShirtConstellation size={28} twinkle={false}/></span>
        <span className="lf-chip-text">
          <span className="lf-chip-name">Orion</span>
          <span className="lf-chip-sub">SaaS para confecção</span>
        </span>
      </div>

      {/* Floating card */}
      <div className="lf-card">
        <Form mode={t.mode} socials={t.socials} setTweak={setTweak}/>
      </div>

      <footer className="lf-foot">
        <a href="#">Termos</a>
        <span className="lf-foot-sep">·</span>
        <a href="#">Privacidade</a>
        <span className="lf-foot-sep">·</span>
        <a href="#">Suporte</a>
        <span className="lf-foot-lang">PT-BR</span>
      </footer>

      <TweaksPanel>
        <TweakSection label="Estado da tela"/>
        <TweakSelect label="Modo" value={t.mode}
                     options={[
                       { value: 'signin', label: 'Entrar' },
                       { value: 'signup', label: 'Criar conta' },
                       { value: 'magic',  label: 'Link mágico' },
                       { value: 'forgot', label: 'Recuperar senha' },
                     ]}
                     onChange={v => setTweak('mode', v)}/>
        <TweakToggle label="Provedores sociais"
                     value={t.socials}
                     onChange={v => setTweak('socials', v)}/>
        <TweakSection label="Marca"/>
        <TweakColor label="Cor de destaque"
                    value={t.accent}
                    options={['#1e40af','#2563eb','#c2410c','#0f766e','#7e5bef','#1f1b15']}
                    onChange={v => setTweak('accent', v)}/>
      </TweaksPanel>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<LoginApp/>);
