// Catalog pages — Products, Specs, Prints

const TONE_BG = {
  warm:  ['#f4d9b8','#c2410c'],
  sand:  ['#efe6d3','#a16207'],
  moss:  ['#d6dfd0','#3a4a3d'],
  bone:  ['#f4f1ea','#7a7160'],
  stone: ['#dfd9cd','#57534e'],
};

const stripeBg = (tone) => {
  const [a, b] = TONE_BG[tone] || TONE_BG.warm;
  return `repeating-linear-gradient(135deg, ${a} 0 8px, ${b}22 8px 16px)`;
};

// Product thumb tinted from the product's own colors — solid, readable
const _hexLum = (hex) => {
  const h = hex.replace('#',''); const v = h.length === 3 ? h.split('').map(c=>c+c).join('') : h;
  const r = parseInt(v.slice(0,2),16)/255, g = parseInt(v.slice(2,4),16)/255, b = parseInt(v.slice(4,6),16)/255;
  return 0.2126*r + 0.7152*g + 0.0722*b;
};
const productBg = (colors = []) => {
  return 'linear-gradient(135deg, color-mix(in oklab, var(--accent) 22%, var(--surface)), color-mix(in oklab, var(--accent) 6%, var(--surface)))';
};
const productInk = (colors = []) => 'var(--accent-edge)';

// Shared color name lookup — seed names plus any configured in Ajustes.
const COLOR_NAMES = { '#1f1f1f': 'Preto', '#7a4b2a': 'Marrom', '#c9b9a3': 'Areia', '#efe6d3': 'Off-white', '#cfb98e': 'Bege', '#7a8a76': 'Verde-musgo', '#3a4a3d': 'Verde escuro', '#6b4a2e': 'Caramelo', '#f4f1ea': 'Branco', '#b03a2e': 'Vermelho', '#2a3b5a': 'Azul-marinho' };
const colorName = (hex) => {
  if (COLOR_NAMES[hex]) return COLOR_NAMES[hex];
  try { const c = window.CatalogConfig.get(); const f = [...c.productColors, ...c.printColors].find(x => x.hex === hex); if (f) return f.name; } catch (e) {}
  return hex;
};
// Default print ink for a material: most-contrasting ink available in the print palette.
const defaultPrintFor = (hex, printColors) => {
  const want = _hexLum(hex) < 0.45 ? '#f4f1ea' : '#1f1f1f';
  if (!printColors || !printColors.length || printColors.some(c => c.hex === want)) return want;
  const lum = _hexLum(hex);
  return printColors.slice().sort((a, b) => Math.abs(_hexLum(b.hex) - lum) - Math.abs(_hexLum(a.hex) - lum))[0].hex;
};
// Live subscription to the configurable catalog options.
function useCatalogConfig() {
  const [cfg, setCfg] = React.useState(window.CatalogConfig.get());
  React.useEffect(() => window.CatalogConfig.subscribe(setCfg), []);
  return cfg;
}

// A garment swatch with the matching print ink(s) shown as inset pip(s).
const ColorPairSwatch = ({ material, prints = [], size = 16 }) => {
  const list = prints.slice(0, 2);
  return (
    <span style={{ position: 'relative', width: size, height: size, borderRadius: 999, background: material, border: '1.5px solid var(--surface)', boxShadow: '0 0 0 1px var(--line)', display: 'inline-block', flexShrink: 0 }}>
      {list.map((pr, i) => (
        <span key={i} style={{ position: 'absolute', right: -2 - i * (size * 0.32), bottom: -2, width: size * 0.5, height: size * 0.5, borderRadius: 999, background: pr, border: '1.5px solid var(--surface)', boxShadow: '0 0 0 1px var(--line)' }}/>
      ))}
    </span>
  );
};

const Products = ({ setRoute }) => {
  const [open, setOpen] = React.useState(null);
  const [newOpen, setNewOpen] = React.useState(false);
  const [search, setSearch] = React.useState('');
  const [sort, setSort] = React.useState({ col: 'name', dir: 'asc' });
  const cmp = makeCmp(sort, { code: p=>p.code, name: p=>p.name, spec: p=>p.spec, print: p=>p.print });
  const rows = ORION_DATA.products.filter(p => {
    if (search) { const q = search.toLowerCase(); if (!p.name.toLowerCase().includes(q) && !p.code.toLowerCase().includes(q)) return false; }
    return true;
  }).slice().sort(cmp);
  return (
    <div className="page">
      <PageHead sub="products" title="Produtos" titleEm="à venda"
                desc="Ficha técnica + estampa, por cor e tamanho."
                actions={<button className="btn btn-primary" onClick={() => setNewOpen(true)}><Icon name="shirt" size={14}/> Novo produto</button>}/>
      <HelpCard id="products" icon="shirt" tone="var(--brand-catalog)" title="Produtos — ficha técnica + estampa, em cores e tamanhos">
        <HelpBody>
          Um <b>produto</b> nasce ao juntar uma <b>ficha técnica</b> (tecido e modelagem) com uma <b>estampa</b>. Cada combinação de <b>cor e tamanho</b> vira uma <b>variação (SKU)</b> — a unidade que estoque, anúncios e produção realmente movimentam.
        </HelpBody>
        <Flow accent="var(--brand-catalog)" steps={[
          { icon: 'file-text', label: 'Ficha + estampa', sub: 'tecido + arte' },
          { icon: 'shirt', label: 'Produto', sub: 'modelo à venda', tone: 'accent' },
          { icon: 'hash', label: 'Variações · SKU', sub: 'cor × tamanho', tone: 'ok' },
        ]}/>
      </HelpCard>
      <div className="card">
        <TableToolbar>
          <SearchInput placeholder="Procurar produto…" value={search} onChange={setSearch}/>
        </TableToolbar>
        <table className="tbl">
          <thead><tr>
            <th style={{width:38}}/>
            <SortHeader id="code" sort={sort} setSort={setSort}>Código</SortHeader>
            <SortHeader id="name" sort={sort} setSort={setSort}>Produto</SortHeader>
            <SortHeader id="spec" sort={sort} setSort={setSort}>Ficha</SortHeader>
            <SortHeader id="print" sort={sort} setSort={setSort}>Estampa</SortHeader>
            <th>Cores</th>
            <th>Tamanhos</th>
            <th style={{width:36}}/>
          </tr></thead>
          <tbody>{rows.map(p => {
              const spec = ORION_DATA.specs.find(s => s.id === p.spec);
              const garment = spec && GARMENT_TYPES.find(g => g.id === spec.tipo);
              const lowStock = p.stock < 12;
              return (
                <tr key={p.id} onClick={() => setOpen(p)}>
                  <td>
                    <span style={{ display: 'grid', placeItems: 'center', width: 28, height: 28, borderRadius: 6, background: productBg(p.colors), color: productInk(p.colors) }}>
                      {garment ? React.cloneElement(GARMENT_GLYPHS[garment.id], { width: 14, height: 14, strokeWidth: 1.5 }) : <Icon name="shirt" size={14}/>}
                    </span>
                  </td>
                  <td className="mono">{p.code}</td>
                  <td style={{color:'var(--ink)',fontWeight:500}}>{p.name}</td>
                  <td><span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: 'var(--ink-2)' }}>{garment ? React.cloneElement(GARMENT_GLYPHS[garment.id], { width: 13, height: 13, strokeWidth: 1.6 }) : <Icon name="file-text" size={12}/>} {p.spec}</span></td>
                  <td><span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: 'var(--ink-2)' }}><Icon name="palette" size={12}/> {p.print}</span></td>
                  <td>
                    <span style={{ display: 'inline-flex', gap: 5, alignItems: 'center' }}>
                      {p.colors.slice(0, 4).map((c, i) => (
                        <ColorPairSwatch key={i} material={c.material} prints={c.prints} size={15}/>
                      ))}
                      {p.colors.length > 4 && <span style={{ fontSize: 11, color: 'var(--ink-3)', marginLeft: 2 }}>+{p.colors.length - 4}</span>}
                    </span>
                  </td>
                  <td><span style={{ fontSize: 11.5, color: 'var(--ink-3)' }}>{p.sizes.join(' · ')}</span></td>
                  <td><Icon name="chevron-right" size={14} style={{ color: 'var(--ink-3)' }}/></td>
                </tr>
              );
            })}</tbody>
        </table>
      </div>

      <Sheet open={!!open} onClose={() => setOpen(null)}
             title={open ? open.name : ''}
             sub={open ? <span className="mono" style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--ink-3)' }}>{open.code}</span> : null}
             footer={<>
               <button className="btn btn-ghost" style={{ color: 'var(--err)', marginRight: 'auto' }}><Icon name="trash-2" size={13}/> Excluir produto</button>
               <button className="btn" onClick={() => setOpen(null)}>Fechar</button>
               <button className="btn"><Icon name="copy" size={13}/> Duplicar</button>
               <button className="btn btn-primary"><Icon name="pencil" size={13}/> Editar</button>
             </>}>
        {open && <ProductDetail p={open} setRoute={setRoute}/>}
      </Sheet>

      <NewProductSheet open={newOpen} onClose={() => setNewOpen(false)}/>
    </div>
  );
};

const NewProductSheet = ({ open, onClose }) => {
  const cfg = useCatalogConfig();
  const PRODUCT_COLORS = cfg.productColors;
  const PRINT_COLORS = cfg.printColors;
  const SIZES = cfg.sizes;
  const [nome, setNome] = React.useState('');
  const [thumb, setThumb] = React.useState(null);
  const [specId, setSpecId] = React.useState(ORION_DATA.specs[0]?.id || '');
  const [printId, setPrintId] = React.useState(ORION_DATA.prints[0]?.id || '');
  const [sizes, setSizes] = React.useState(['P','M','G']);
  const [colors, setColors] = React.useState([
    { material: '#1f1f1f', prints: ['#f4f1ea'] },
    { material: '#f4f1ea', prints: ['#1f1f1f'] },
  ]);
  const [addingColor, setAddingColor] = React.useState(false);
  const spec = ORION_DATA.specs.find(s => s.id === specId);
  const print = ORION_DATA.prints.find(p => p.id === printId);
  const garment = spec && GARMENT_TYPES.find(g => g.id === spec.tipo);
  const skuBase = (() => {
    const tag = (nome || 'novo').toUpperCase().replace(/[^A-Z]/g, '').slice(0, 3) || 'NOV';
    return `${garment?.skuPrefix || 'PRD'}-${tag}`;
  })();

  const toggle = (arr, v, set) => set(arr.includes(v) ? arr.filter(x => x !== v) : [...arr, v]);
  const addColor = (hex) => { setColors(cs => cs.some(c => c.material === hex) ? cs : [...cs, { material: hex, prints: [defaultPrintFor(hex, PRINT_COLORS)] }]); setAddingColor(false); };
  const removeColor = (hex) => setColors(cs => cs.filter(c => c.material !== hex));
  const togglePrint = (hex, pr) => setColors(cs => cs.map(c => c.material !== hex ? c
    : { ...c, prints: c.prints.includes(pr) ? (c.prints.length > 1 ? c.prints.filter(x => x !== pr) : c.prints) : [...c.prints, pr] }));

  const specOpts = ORION_DATA.specs.map(s => {
    const g = GARMENT_TYPES.find(gt => gt.id === s.tipo);
    return { value: s.id, label: s.name, sub: `${s.id} · ${s.fabric} · ${s.gsm}g`, icon: g ? null : 'file-text', _garment: g };
  });
  const printOpts = ORION_DATA.prints.map(p => ({ value: p.id, label: p.name, sub: `${p.id} · ${p.technique} · ${fmtBRL(p.cost)}` }));

  return (
    <Sheet open={open} onClose={onClose}
      title="Novo produto"
      sub={<span style={{ fontFamily: 'var(--font-mono)', fontSize: 11.5, color: 'var(--ink-3)' }}>{skuBase}</span>}
      footer={<>
        <button className="btn" onClick={onClose}>Cancelar</button>
        <button className="btn btn-primary" onClick={onClose}><Icon name="check" size={13}/> Criar produto</button>
      </>}>

      <div style={{ marginBottom: 22 }}>
        <SectionTitle>Identificação</SectionTitle>
        <div className="field">
          <label>Nome do produto</label>
          <input value={nome} onChange={e => setNome(e.target.value)} placeholder="Ex: Cropped Oversized"/>
        </div>
        <ThumbUpload value={thumb} onChange={setThumb} label="Miniatura do produto" aspect="4 / 5"/>
      </div>

      <div style={{ marginBottom: 22 }}>
        <SectionTitle>Receita</SectionTitle>
        <div className="field">
          <label>Ficha técnica</label>
          <Select searchable value={specId} onChange={setSpecId} options={specOpts}
            renderOption={(o) => (
              <span style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }}>
                <span style={{ width: 26, height: 26, borderRadius: 6, background: 'var(--surface-2)', display: 'grid', placeItems: 'center', color: 'var(--ink-2)', flexShrink: 0 }}>
                  {o._garment ? React.cloneElement(GARMENT_GLYPHS[o._garment.id], { width: 14, height: 14 }) : <Icon name="file-text" size={13}/>}
                </span>
                <span style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--ink)' }}>{o.label}</span>
                  <span style={{ fontSize: 11, color: 'var(--ink-3)' }}>{o.sub}</span>
                </span>
              </span>
            )}/>
          {spec && (
            <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', background: 'var(--surface-2)', borderRadius: 8, fontSize: 12 }}>
              <Icon name="info" size={12} style={{ color: 'var(--ink-3)' }}/>
              <span style={{ color: 'var(--ink-2)' }}>{spec.fabric} · {spec.gsm}g/m²</span>
            </div>
          )}
        </div>
        <div className="field">
          <label>Estampa</label>
          <Select searchable value={printId} onChange={setPrintId} options={printOpts}
            renderOption={(o) => {
              const pr = ORION_DATA.prints.find(x => x.id === o.value);
              const [a, b] = TONE_BG[pr?.tone] || TONE_BG.warm;
              return (
                <span style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }}>
                  <span style={{ width: 26, height: 26, borderRadius: 6, background: `radial-gradient(circle at 30% 30%, ${a}, ${b})`, flexShrink: 0 }}/>
                  <span style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--ink)' }}>{o.label}</span>
                    <span style={{ fontSize: 11, color: 'var(--ink-3)' }}>{o.sub}</span>
                  </span>
                </span>
              );
            }}/>
        </div>
      </div>

      <div style={{ marginBottom: 22 }}>
        <SectionTitle>Tamanhos disponíveis</SectionTitle>
        <div style={{ display: 'flex', gap: 6 }}>
          {SIZES.map(s => {
            const active = sizes.includes(s);
            return (
              <button key={s} type="button" onClick={() => toggle(sizes, s, setSizes)}
                style={{
                  width: 44, height: 44, borderRadius: 8,
                  border: active ? '1.5px solid var(--accent)' : '1px solid var(--line)',
                  background: active ? 'var(--accent-soft)' : 'var(--surface)',
                  color: active ? 'var(--ink)' : 'var(--ink-3)',
                  fontWeight: active ? 600 : 400, fontSize: 13, cursor: 'pointer',
                  fontFamily: 'var(--font-display)',
                }}>{s}</button>
            );
          })}
        </div>
      </div>

      <div style={{ marginBottom: 22 }}>
        <SectionTitle>Cores & estampas</SectionTitle>
        <div style={{ display: 'grid', gap: 1, background: 'var(--line-soft)', border: '1px solid var(--line-soft)', borderRadius: 10, overflow: 'hidden' }}>
          {colors.map(c => (
            <div key={c.material} style={{ background: 'var(--surface)', display: 'flex', alignItems: 'center', gap: 12, padding: '11px 12px' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 132, flexShrink: 0 }}>
                <span style={{ width: 18, height: 18, borderRadius: 999, background: c.material, border: '1.5px solid var(--surface)', boxShadow: '0 0 0 1px var(--line)', flexShrink: 0 }}/>
                <span style={{ fontSize: 13, color: 'var(--ink)', fontWeight: 500 }}>{colorName(c.material)}</span>
              </span>
              <span style={{ display: 'flex', flexDirection: 'column', gap: 5, flex: 1, minWidth: 0 }}>
                <span style={{ fontSize: 10, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '.08em', fontWeight: 600 }}>Estampas ({c.prints.length})</span>
                <span style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                  {PRINT_COLORS.map(pc => {
                    const sel = c.prints.includes(pc.hex);
                    return (
                      <button key={pc.hex} type="button" title={pc.name} onClick={() => togglePrint(c.material, pc.hex)}
                        aria-label={`Estampa ${pc.name}`} aria-pressed={sel}
                        style={{ width: 22, height: 22, borderRadius: 999, background: pc.hex, padding: 0, cursor: 'pointer',
                          border: sel ? '2px solid var(--ink)' : '1px solid var(--line)',
                          boxShadow: sel ? '0 0 0 2px var(--surface), 0 0 0 3px var(--ink)' : 'inset 0 0 0 1px rgba(0,0,0,.04)' }}/>
                    );
                  })}
                </span>
              </span>
              <button type="button" className="btn btn-ghost btn-sm" title="Remover cor" onClick={() => removeColor(c.material)}
                disabled={colors.length <= 1}
                style={{ padding: 6, flexShrink: 0, color: 'var(--ink-3)', opacity: colors.length <= 1 ? 0.4 : 1 }}>
                <Icon name="trash-2" size={14}/>
              </button>
            </div>
          ))}

          <div style={{ background: 'var(--surface)' }}>
            {!addingColor ? (
              <button type="button" onClick={() => setAddingColor(true)}
                disabled={colors.length >= PRODUCT_COLORS.length}
                style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '11px 12px', background: 'transparent', border: 'none', cursor: colors.length >= PRODUCT_COLORS.length ? 'default' : 'pointer', color: 'var(--accent)', fontFamily: 'inherit', fontSize: 12.5, fontWeight: 500, opacity: colors.length >= PRODUCT_COLORS.length ? 0.4 : 1 }}>
                <Icon name="plus" size={14}/> Adicionar cor
              </button>
            ) : (
              <div style={{ padding: '11px 12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span style={{ fontSize: 11, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '.08em', fontWeight: 600 }}>Escolha a cor do material</span>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => setAddingColor(false)} style={{ padding: 4, color: 'var(--ink-3)' }}><Icon name="x" size={14}/></button>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(116px, 1fr))', gap: 8 }}>
                  {PRODUCT_COLORS.filter(pc => !colors.some(c => c.material === pc.hex)).map(pc => (
                    <button key={pc.hex} type="button" onClick={() => addColor(pc.hex)}
                      style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 9px', borderRadius: 8, border: '1px solid var(--line)', background: 'var(--surface)', cursor: 'pointer', textAlign: 'left' }}>
                      <span style={{ width: 18, height: 18, borderRadius: 999, background: pc.hex, border: '1.5px solid var(--surface)', boxShadow: '0 0 0 1px var(--line)', flexShrink: 0 }}/>
                      <span style={{ fontSize: 11.5, color: 'var(--ink-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{pc.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        <div style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 10 }}>
          {colors.length} cor{colors.length !== 1 ? 'es' : ''} · {sizes.filter(s => SIZES.includes(s)).length} tamanho{sizes.filter(s => SIZES.includes(s)).length !== 1 ? 's' : ''} = <strong style={{ color: 'var(--ink-2)' }}>{colors.length * sizes.filter(s => SIZES.includes(s)).length} variações</strong>
        </div>
      </div>

      <div style={{ marginBottom: 6 }}>
        <SectionTitle>SKUs gerados</SectionTitle>
        {(() => {
          const COLOR_CODE = { '#1f1f1f':'PRT', '#f4f1ea':'OFF', '#7a4b2a':'MAR', '#c9b9a3':'ARE', '#cfb98e':'BEG', '#7a8a76':'MUS', '#3a4a3d':'VRD', '#6b4a2e':'CAR', '#b03a2e':'VRM', '#2a3b5a':'AZM' };
          const specCode = spec?.id?.toUpperCase() || 'SPEC';
          const printCode = print?.id ? `-${print.id.toUpperCase()}` : '';
          const skus = [];
          for (const sz of sizes.filter(s => SIZES.includes(s))) for (const c of colors) skus.push(`${specCode}-${sz}-${COLOR_CODE[c.material] || 'COR'}${printCode}`);
          if (!skus.length) return <div style={{ padding: '12px 14px', background: 'var(--surface-2)', borderRadius: 8, fontSize: 12, color: 'var(--ink-3)' }}>Selecione tamanhos e cores para gerar os SKUs.</div>;
          return (
            <div style={{ background: 'var(--surface-2)', borderRadius: 8, overflow: 'hidden', border: '1px solid var(--line)' }}>
              <div style={{ padding: '8px 14px', display:'flex', alignItems:'center', justifyContent:'space-between', borderBottom: '1px solid var(--line-soft)', fontSize: 11, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '.08em', fontWeight: 600 }}>
                <span>{skus.length} SKU{skus.length !== 1 ? 's' : ''}</span>
                <span style={{ fontFamily: 'var(--font-mono)', textTransform: 'none', letterSpacing: 0, fontWeight: 400 }}>&lt;ficha&gt;-&lt;tam&gt;-&lt;cor&gt;{printCode && <>-&lt;estampa&gt;</>}</span>
              </div>
              <div style={{ maxHeight: 180, overflowY: 'auto', padding: '6px 0' }}>
                {skus.map(sku => (
                  <div key={sku} style={{ padding: '4px 14px', fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--ink)', letterSpacing: '.03em', display:'flex', alignItems:'center', gap: 8 }}>
                    <Icon name="hash" size={11} style={{ color: 'var(--ink-3)' }}/>{sku}
                  </div>
                ))}
              </div>
            </div>
          );
        })()}
      </div>
    </Sheet>
  );
};

const FormField = ({ label, children }) => (
  <div>
    <label style={{ fontSize: 11, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '.08em', fontWeight: 600, display: 'block', marginBottom: 6 }}>{label}</label>
    {children}
  </div>
);

const ProductDetail = ({ p, setRoute }) => {
  const [tab, setTab] = React.useState('overview');
  const orders = ORION_DATA.orders.filter(o => o.items.some(it => it.product === p.name));
  const ads = ORION_DATA.ads.filter(a => a.product === p.name);
  const spec = ORION_DATA.specs.find(s => s.id === p.spec);
  const print = ORION_DATA.prints.find(pr => pr.id === p.print);
  const totalCost = (spec?.cmt || 0) + (print?.cost || 0);
  return (
    <div>
      <div style={{ height: 120, borderRadius: 10, marginBottom: 16, background: stripeBg(p.thumb), display: 'flex', alignItems: 'flex-end', padding: 14 }}>
        <span className="pill ok"><Icon name="boxes" size={10}/> {p.stock} em estoque</span>
      </div>

      <div className="tabs" style={{ display: 'flex', gap: 4, borderBottom: '1px solid var(--line-soft)', marginBottom: 16 }}>
        {[
          { id: 'overview', label: 'Visão geral' },
          { id: 'variations', label: `Variações (${p.colors.length * p.sizes.length})` },
          { id: 'orders', label: `Pedidos (${orders.length})` },
          { id: 'ads', label: `Anúncios (${ads.length})` },
          { id: 'cost', label: 'Custo' },
        ].map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
                  className="btn btn-ghost btn-sm"
                  style={{ borderRadius: 0, borderBottom: tab === t.id ? '2px solid var(--accent)' : '2px solid transparent', color: tab === t.id ? 'var(--ink)' : 'var(--ink-3)', fontWeight: tab === t.id ? 500 : 400, padding: '8px 10px' }}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'overview' && (
        <div style={{ display: 'grid', gap: 14 }}>
          <FormGrid>
            <FormCell icon="hash" label="Código"><span className="mono" style={{ fontFamily: 'var(--font-mono)' }}>{p.code}</span></FormCell>
            <FormCell icon="file-text" label="Ficha técnica" link onClick={() => setRoute('specs')}>{p.spec}</FormCell>
            <FormCell icon="palette" label="Estampa" link onClick={() => setRoute('prints')}>{p.print}</FormCell>
            <FormCell icon="boxes" label="Estoque total">{p.stock}</FormCell>
          </FormGrid>
          <FormField label="Cores · material e estampas">
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {p.colors.map((c, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 12px 6px 8px', background: 'var(--surface-2)', borderRadius: 10 }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    <span style={{ width: 16, height: 16, borderRadius: 999, background: c.material, border: '1.5px solid var(--surface)', boxShadow: '0 0 0 1px var(--line)' }}/>
                    <span style={{ fontSize: 12.5, color: 'var(--ink)' }}>{colorName(c.material)}</span>
                  </span>
                  <Icon name="arrow-right" size={11} style={{ color: 'var(--ink-3)' }}/>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                    {(c.prints || []).map((pr, j) => (
                      <span key={j} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <span style={{ width: 13, height: 13, borderRadius: 999, background: pr, border: '1.5px solid var(--surface)', boxShadow: '0 0 0 1px var(--line)' }}/>
                        <span style={{ fontSize: 11.5, color: 'var(--ink-2)' }}>{colorName(pr)}</span>
                      </span>
                    ))}
                  </span>
                </div>
              ))}
            </div>
          </FormField>
          <FormField label="Tamanhos">
            <div style={{ display: 'flex', gap: 6 }}>
              {p.sizes.map(s => <span key={s} className="pill">{s}</span>)}
            </div>
          </FormField>
        </div>
      )}

      {tab === 'variations' && (
        <div>
          <div style={{ overflow: 'auto', border: '1px solid var(--line-soft)', borderRadius: 8 }}>
            <table className="tbl" style={{ marginBottom: 0 }}>
              <thead><tr><th>Cor</th><th>Estampa</th>{p.sizes.map(s => <th key={s} className="num">{s}</th>)}<th className="num">Total</th></tr></thead>
              <tbody>
                {p.colors.map((c, i) => {
                  const rowStocks = p.sizes.map((s, j) => Math.max(0, ((p.stock / (p.colors.length * p.sizes.length)) * (1 + (i + j) % 3 - 1)) | 0));
                  const rowTotal = rowStocks.reduce((a, b) => a + b, 0);
                  return (
                    <tr key={i}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ width: 16, height: 16, borderRadius: 999, background: c.material, border: '1.5px solid var(--surface)', boxShadow: '0 0 0 1px var(--line)' }}/>
                          <span>{colorName(c.material)}</span>
                        </div>
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                          {(c.prints || []).map((pr, j) => (
                            <span key={j} style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--ink-2)' }}>
                              <span style={{ width: 13, height: 13, borderRadius: 999, background: pr, border: '1.5px solid var(--surface)', boxShadow: '0 0 0 1px var(--line)' }}/>
                              <span style={{ fontSize: 12 }}>{colorName(pr)}</span>
                            </span>
                          ))}
                        </div>
                      </td>
                      {rowStocks.map((n, j) => (
                        <td key={j} className="num">
                          <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 6, background: n < 4 ? 'color-mix(in oklab, var(--err) 12%, var(--surface))' : 'var(--surface-2)', color: n < 4 ? 'var(--err)' : 'var(--ink)', fontWeight: 500, minWidth: 36 }}>{n}</span>
                        </td>
                      ))}
                      <td className="num" style={{ color: 'var(--ink)', fontWeight: 500 }}>{rowTotal}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div style={{ marginTop: 10, fontSize: 11, color: 'var(--ink-3)', display: 'flex', alignItems: 'center', gap: 6 }}>
            <Icon name="alert-triangle" size={11} style={{ color: 'var(--err)' }}/> Variações em vermelho estão abaixo do estoque mínimo (4 un).
          </div>
        </div>
      )}

      {tab === 'orders' && (
        <div>
          {orders.length ? orders.map(o => {
            const it = o.items.find(i => i.product === p.name);
            return (
              <div key={o.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderBottom: '1px solid var(--line-soft)' }}>
                <FabricThumb tone={it.thumb} size={28}/>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 500, color: 'var(--ink)', fontSize: 13 }}>#{o.id}</div>
                  <div style={{ fontSize: 11, color: 'var(--ink-3)' }}>{it.variant} · {o.placedAt}</div>
                </div>
                <ChannelChip id={o.channel}/>
                <StatusPill s={o.status}/>
                <span className="num" style={{ fontVariantNumeric: 'tabular-nums', color: 'var(--ink-3)', minWidth: 30, textAlign: 'right' }}>×{it.qty}</span>
              </div>
            );
          }) : <Empty title="Nenhum pedido" desc="Este produto ainda não foi vendido." icon="shopping-bag"/>}
        </div>
      )}

      {tab === 'ads' && (
        <div style={{ display: 'grid', gap: 8 }}>
          {ads.length ? ads.map(a => {
            const ch = ORION_DATA.channels[a.channel];
            return (
              <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 12, background: 'var(--surface-2)', borderRadius: 10 }}>
                <span style={{ width: 32, height: 32, borderRadius: 8, background: ch.color, color: ch.fg || '#fff', display: 'grid', placeItems: 'center', fontSize: 11, fontWeight: 700 }}>{ch.short}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 500, color: 'var(--ink)', fontSize: 13 }}>{a.title}</div>
                  <div style={{ fontSize: 11, color: 'var(--ink-3)' }}>{ch.name} · {a.orders30d} pedidos em 30d</div>
                </div>
                <StatusPill s={a.status}/>
              </div>
            );
          }) : <Empty title="Sem anúncios" desc="Crie um anúncio para começar a vender este produto." icon="megaphone"/>}
        </div>
      )}

      {tab === 'cost' && (
        <div>
          <div style={{ display: 'grid', gap: 1, background: 'var(--line-soft)', border: '1px solid var(--line-soft)', borderRadius: 10, overflow: 'hidden' }}>
            {[
              { label: 'Ficha técnica (CMT)', sub: spec?.name, value: spec?.cmt || 0, icon: 'file-text' },
              { label: 'Estampa', sub: print?.name, value: print?.cost || 0, icon: 'palette' },
              { label: 'Embalagem', sub: 'Saco kraft + tag', value: 1.20, icon: 'package' },
            ].map(r => (
              <div key={r.label} style={{ background: 'var(--surface)', display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px' }}>
                <Icon name={r.icon} size={14} style={{ color: 'var(--ink-3)' }}/>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12.5, color: 'var(--ink)' }}>{r.label}</div>
                  <div style={{ fontSize: 11, color: 'var(--ink-3)' }}>{r.sub}</div>
                </div>
                <div className="num" style={{ fontWeight: 500, color: 'var(--ink)' }}>{fmtBRL(r.value)}</div>
              </div>
            ))}
            <div style={{ background: 'var(--surface-2)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px' }}>
              <span style={{ fontSize: 11, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '.08em', fontWeight: 600 }}>Custo total por unidade</span>
              <span style={{ fontFamily: 'var(--font-display)', fontSize: 22, color: 'var(--ink)' }}>{fmtBRL(totalCost + 1.20)}</span>
            </div>
          </div>
          <div style={{ marginTop: 12, padding: 12, background: 'color-mix(in oklab, var(--accent) 8%, var(--surface))', borderRadius: 8, fontSize: 12, color: 'var(--ink-2)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <Icon name="trending-up" size={14}/> Margem sugerida (4×): <strong style={{ marginLeft: 'auto', color: 'var(--ink)' }}>{fmtBRL((totalCost + 1.20) * 4)}</strong>
          </div>
        </div>
      )}
    </div>
  );
};

const FormGrid = ({ children }) => (
  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1, background: 'var(--line-soft)', border: '1px solid var(--line-soft)', borderRadius: 10, overflow: 'hidden' }}>{children}</div>
);
const FormCell = ({ icon, label, children, link, onClick }) => (
  <div onClick={onClick} style={{ background: 'var(--surface)', padding: '12px 14px', cursor: link ? 'default' : 'auto' }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10.5, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '.08em', fontWeight: 600, marginBottom: 4 }}>
      <Icon name={icon} size={11}/> {label}
    </div>
    <div style={{ color: 'var(--ink)', fontSize: 13.5, display: 'flex', alignItems: 'center', gap: 6 }}>
      {children}
      {link && <Icon name="external-link" size={11} style={{ color: 'var(--ink-3)' }}/>}
    </div>
  </div>
);

// Inline garment glyphs — minimal line-art that distinguishes each type.
// This is the ICON LIBRARY the user picks from in Ajustes › Catálogo.
// Values are raw <svg> so call-sites can React.cloneElement({width,height,strokeWidth}).
const lucideGlyph = (name) => {
  const lib = (typeof window !== 'undefined') ? window.lucide : null;
  let children = [];
  if (lib && lib.icons) {
    const pascal = name.split('-').map(s => s[0].toUpperCase() + s.slice(1)).join('');
    const node = lib.icons[pascal];
    if (Array.isArray(node)) children = (node.length === 3 && Array.isArray(node[2])) ? node[2] : node;
    else if (node && Array.isArray(node.children)) children = node.children;
  }
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      {children.map((c, i) => React.createElement(c[0], { key: i, ...c[1] }))}
    </svg>
  );
};

const GARMENT_ICON_LIBRARY = {
  camiseta: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M8 3 L5 5 L3 8 L5 10 L7 9 L7 21 L17 21 L17 9 L19 10 L21 8 L19 5 L16 3 C16 5 14.5 6 12 6 C9.5 6 8 5 8 3 Z"/></svg>,
  moletom:  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 7 Q12 2 15 7"/><path d="M9 7 L6 8 L3 11 L5.5 13 L7 12 L7 20 Q7 21 8 21 L16 21 Q17 21 17 20 L17 12 L18.5 13 L21 11 L18 8 L15 7"/><path d="M11.2 7 L11.2 11 M12.8 7 L12.8 11"/><path d="M7 18 L17 18"/></svg>,
  regata:   <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M8 3 L6 10 L6 21 L18 21 L18 10 L16 3 L14 3 C14 5 13 6 12 6 C11 6 10 5 10 3 Z"/></svg>,
  blusa:    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M8 3 L4 7 L7 10 L7 21 L17 21 L17 10 L20 7 L16 3 L14 5 L12 4 L10 5 Z"/></svg>,
  calca:    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 3 L19 3 L19 10 L18 21 L14 21 L13 12 L11 12 L10 21 L6 21 L5 10 Z"/><path d="M5 7 L19 7"/></svg>,
  bermuda:  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 4 L19 4 L19 9 L17 16 L13 16 L12 11 L10 11 L9 16 L7 16 L5 9 Z"/><path d="M5 7 L19 7"/></svg>,
  shirt:        lucideGlyph('shirt'),
  bag:          lucideGlyph('shopping-bag'),
  cap:          lucideGlyph('crown'),
  shoe:         lucideGlyph('footprints'),
  glasses:      lucideGlyph('glasses'),
  hat:          lucideGlyph('hard-hat'),
  baby:         lucideGlyph('baby'),
  gem:          lucideGlyph('gem'),
  package:      lucideGlyph('package'),
  tag:          lucideGlyph('tag'),
};

// GARMENT_TYPES / GARMENT_GLYPHS are derived from the live catalog config so
// every call-site (sales, produção, estoque…) reflects Ajustes › Catálogo.
const buildGarmentGlyphs = (types) => {
  const m = { ...GARMENT_ICON_LIBRARY };
  (types || []).forEach(t => { if (t && t.id) m[t.id] = GARMENT_ICON_LIBRARY[t.icon] || GARMENT_ICON_LIBRARY.camiseta; });
  return m;
};

let GARMENT_TYPES  = window.CatalogConfig.get().garmentTypes;
let GARMENT_GLYPHS = buildGarmentGlyphs(GARMENT_TYPES);
let FABRIC_TYPES   = window.CatalogConfig.get().fabricTypes;
let AVIAMENTO_TYPES = window.CatalogConfig.get().aviamentos;
const RIBANA_TYPES = ['Ribana 1×1', 'Ribana 2×1', 'Ribana 2×2', 'Ribana canelada'];

window.CatalogConfig.subscribe((c) => {
  GARMENT_TYPES   = c.garmentTypes;
  GARMENT_GLYPHS  = buildGarmentGlyphs(c.garmentTypes);
  FABRIC_TYPES    = c.fabricTypes;
  AVIAMENTO_TYPES = c.aviamentos;
  Object.assign(window, { GARMENT_TYPES, GARMENT_GLYPHS });
});

const SectionTitle = ({ children }) => (
  <div style={{ fontSize: 11, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '.1em', fontWeight: 600, marginBottom: 12, paddingBottom: 8, borderBottom: '1px solid var(--line-soft)' }}>{children}</div>
);

const TypePicker = ({ value, onChange }) => (
  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
    {GARMENT_TYPES.map(g => {
      const active = value === g.id;
      return (
        <button key={g.id} type="button" onClick={() => onChange(g.id)}
          style={{
            border: active ? '1.5px solid var(--accent)' : '1px solid var(--line)',
            background: active ? 'var(--accent-soft)' : 'var(--surface)',
            color: active ? 'var(--ink)' : 'var(--ink-2)',
            borderRadius: 8, padding: '10px 8px',
            display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer',
            fontSize: 12.5, fontWeight: active ? 500 : 400,
          }}>
          {GARMENT_GLYPHS[g.id]} {g.label}
        </button>
      );
    })}
  </div>
);

const NewSpecSheet = ({ open, onClose }) => {
  const cfg = useCatalogConfig();
  const FABRIC_OPTS = cfg.fabricTypes;
  const AVIAMENTO_OPTS = cfg.aviamentos;
  const [tipo, setTipo] = React.useState(cfg.garmentTypes[0]?.id || 'camiseta');
  const [nome, setNome] = React.useState('');
  const [tecido, setTecido] = React.useState(FABRIC_OPTS[0]);
  const [gsm, setGsm] = React.useState(165);
  const [consumo, setConsumo] = React.useState(0.18);
  const [usaRibana, setUsaRibana] = React.useState(true);
  const [ribanaTipo, setRibanaTipo] = React.useState(RIBANA_TYPES[0]);
  const [ribanaPct, setRibanaPct] = React.useState(10);
  const [aviamentos, setAviamentos] = React.useState([
    { id: 1, tipo: 'Etiqueta interna tecida', cost: 0.42 },
    { id: 2, tipo: 'Etiqueta de composição',  cost: 0.18 },
  ]);
  const [mao, setMao] = React.useState(7.50);
  const [preco, setPreco] = React.useState(0);

  const garment = cfg.garmentTypes.find(g => g.id === tipo) || cfg.garmentTypes[0];
  const sku = `${garment?.skuPrefix || 'PRD'}-XXX`;

  const addAv = () => setAviamentos(a => [...a, { id: Date.now(), tipo: AVIAMENTO_OPTS[0], cost: 0 }]);
  const removeAv = (id) => setAviamentos(a => a.filter(x => x.id !== id));
  const updateAv = (id, patch) => setAviamentos(a => a.map(x => x.id === id ? { ...x, ...patch } : x));

  // Compute estimated cost
  const aviamentosTotal = aviamentos.reduce((s, a) => s + (+a.cost || 0), 0);
  const custoTotal = aviamentosTotal + (+mao || 0);
  const margem = preco > 0 ? ((preco - custoTotal) / preco) * 100 : 0;

  return (
    <Sheet open={open} onClose={onClose}
      title="Nova ficha técnica"
      sub={<span style={{ fontFamily: 'var(--font-mono)', fontSize: 11.5, color: 'var(--ink-3)' }}>{sku}</span>}
      footer={<>
        <button className="btn" onClick={onClose}>Cancelar</button>
        <button className="btn btn-primary" onClick={onClose}><Icon name="check" size={13}/> Criar ficha</button>
      </>}>

      <div style={{ marginBottom: 22 }}>
        <SectionTitle>Identificação</SectionTitle>
        <div className="field">
          <label>Nome da ficha</label>
          <input value={nome} onChange={e => setNome(e.target.value)} placeholder="Ex: Cropped Oversized"/>
        </div>
        <div className="field">
          <label>Tipo de peça</label>
          <TypePicker value={tipo} onChange={setTipo}/>
        </div>
      </div>

      <div style={{ marginBottom: 22 }}>
        <SectionTitle>Tecido principal</SectionTitle>
        <div className="field">
          <label>Tipo de tecido</label>
          <Select value={tecido} onChange={setTecido} options={FABRIC_OPTS}/>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div className="field">
            <label>Gramatura</label>
            <NumField value={gsm} onChange={setGsm} step={5} min={0} suffix="g/m²"/>
          </div>
          <div className="field">
            <label>Peso</label>
            <NumField value={consumo} onChange={setConsumo} step={0.01} min={0} decimals={2} suffix="kg/peça"/>
          </div>
        </div>
      </div>

      <div style={{ marginBottom: 22 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, paddingBottom: 8, borderBottom: '1px solid var(--line-soft)' }}>
          <span style={{ fontSize: 11, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '.08em', fontWeight: 600, display:'inline-flex', alignItems:'center', gap:6 }}>
            <Icon name="underline" size={11}/>Ribana
          </span>
          <div role="radiogroup" aria-label="Esta ficha usa ribana"
               style={{ display: 'inline-flex', background: 'var(--surface-2)', border: '1px solid var(--line)', borderRadius: 999, padding: 2 }}>
            {[{v:true,l:'Sim'},{v:false,l:'Não'}].map(opt => {
              const active = usaRibana === opt.v;
              return (
                <button key={opt.l} type="button" role="radio" aria-checked={active} onClick={() => setUsaRibana(opt.v)}
                  style={{
                    fontFamily: 'inherit', fontSize: 12, fontWeight: 600,
                    padding: '4px 14px', borderRadius: 999, border: 'none', cursor: 'pointer',
                    background: active ? 'var(--surface)' : 'transparent',
                    color: active ? (opt.v ? 'var(--ok)' : 'var(--ink-2)') : 'var(--ink-3)',
                    boxShadow: active ? '0 1px 2px rgba(0,0,0,.06), 0 0 0 1px var(--line)' : 'none',
                    transition: 'all .15s',
                  }}>{opt.l}</button>
              );
            })}
          </div>
        </div>
        {usaRibana && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div className="field" style={{ marginBottom: 0 }}>
              <label>Tipo</label>
              <Select value={ribanaTipo} onChange={setRibanaTipo} options={RIBANA_TYPES}/>
            </div>
            <div className="field" style={{ marginBottom: 0 }}>
              <label style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline' }}>
                <span>% peso</span>
                <span style={{ fontSize: 12, color: 'var(--ink-2)', fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>
                  {ribanaPct}%
                </span>
              </label>
              <div style={{ position: 'relative', height: 36, display:'flex', alignItems:'center' }}>
                <div style={{ position:'absolute', left:9, right:9, top:'50%', height:6, marginTop:-3, borderRadius:999, background:'var(--surface-2)', boxShadow:'inset 0 1px 2px rgba(0,0,0,.06)' }}/>
                <div style={{ position:'absolute', left:9, top:'50%', height:6, marginTop:-3, borderRadius:999, width:`calc((100% - 18px) * ${ribanaPct/30})`, background:'var(--accent)' }}/>
                <input type="range" min={0} max={30} step={1} value={ribanaPct} onChange={e => setRibanaPct(+e.target.value)}
                  style={{ position:'relative', width:'100%', appearance:'none', background:'transparent', height:36, margin:0, cursor:'pointer' }}
                  className="ribana-slider"/>
              </div>
            </div>
          </div>
        )}
      </div>

      <div style={{ marginBottom: 22 }}>
        <SectionTitle>Aviamentos</SectionTitle>
        <div style={{ display: 'grid', gap: 8 }}>
          {aviamentos.map(av => (
            <div key={av.id} style={{ display: 'grid', gridTemplateColumns: '1fr 110px 28px', gap: 8, alignItems: 'center' }}>
              <Select value={av.tipo} onChange={(v) => updateAv(av.id, { tipo: v })} options={AVIAMENTO_OPTS}/>
              <NumField value={av.cost} onChange={(v) => updateAv(av.id, { cost: v })} step={0.05} min={0} decimals={2} prefix="R$"/>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => removeAv(av.id)} title="Remover" style={{ padding: 6 }}>
                <Icon name="x" size={14}/>
              </button>
            </div>
          ))}
        </div>
        <button type="button" className="btn btn-ghost btn-sm" onClick={addAv} style={{ marginTop: 10, color: 'var(--accent)' }}>
          <Icon name="plus" size={13}/> Adicionar aviamento
        </button>
      </div>

      <div style={{ marginBottom: 18 }}>
        <SectionTitle>Custo & preço</SectionTitle>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div className="field">
            <label>Mão-de-obra</label>
            <NumField value={mao} onChange={setMao} step={0.5} min={0} decimals={2} prefix="R$"/>
          </div>
          <div className="field">
            <label>Preço de venda</label>
            <NumField value={preco} onChange={setPreco} step={1} min={0} decimals={2} prefix="R$"/>
          </div>
        </div>
        <div style={{ background: 'var(--surface-2)', borderRadius: 8, padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12.5 }}>
          <span style={{ color: 'var(--ink-2)' }}>Custo total estimado <span style={{ color: 'var(--ink-3)', fontSize: 11 }}>(aviamentos + mão-de-obra)</span></span>
          <span style={{ fontFamily: 'var(--font-display)', fontSize: 16, color: 'var(--ink)' }}>{fmtBRL(custoTotal)}</span>
        </div>
        {preco > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12, color: 'var(--ink-3)', marginTop: 8, padding: '0 14px' }}>
            <span>Margem bruta</span>
            <span style={{ color: margem > 50 ? 'var(--ok)' : margem > 30 ? 'var(--ink-2)' : 'var(--warn)', fontWeight: 500 }}>{margem.toFixed(1)}%</span>
          </div>
        )}
      </div>
    </Sheet>
  );
};

const Specs = () => {
  const [open, setOpen] = React.useState(null);
  const [newOpen, setNewOpen] = React.useState(false);
  const [search, setSearch] = React.useState('');
  const [filter, setFilter] = React.useState('all');
  const [sort, setSort] = React.useState({ col: 'name', dir: 'asc' });
  const cmp = makeCmp(sort, { id: s=>s.id, name: s=>s.name, fabric: s=>s.fabric, gsm: s=>s.gsm, ribana: s=>s.ribanaUsa?s.ribanaPct:0, preco: s=>s.preco });
  const rows = ORION_DATA.specs.filter(s => {
    if (filter === 'ribana' && !s.ribanaUsa) return false;
    if (search) { const q = search.toLowerCase(); if (!s.name.toLowerCase().includes(q) && !s.id.toLowerCase().includes(q) && !s.fabric.toLowerCase().includes(q)) return false; }
    return true;
  }).slice().sort(cmp);
  return (
    <div className="page">
      <PageHead sub="specs" title="Fichas técnicas"
                desc="Tecido, gramatura, ribana e custo CMT."
                actions={<button className="btn btn-primary" onClick={() => setNewOpen(true)}><Icon name="file-text" size={14}/> Nova ficha</button>}/>
      <HelpCard id="specs" icon="file-text" tone="var(--brand-catalog)" title="Fichas técnicas — a receita de produção de cada peça">
        <HelpBody>
          A ficha é a <b>receita</b>: tecido, <b>gramatura</b>, ribana, consumo por tamanho e o <b>custo CMT</b>. É ela que diz ao Corte quanto de tecido usar e à gestão quanto cada peça custa para produzir.
        </HelpBody>
        <Flow accent="var(--brand-catalog)" steps={[
          { icon: 'file-text', label: 'Ficha técnica', sub: 'tecido & custo', tone: 'accent' },
          { icon: 'shirt', label: 'Base do produto', sub: 'a modelagem' },
          { icon: 'scissors', label: 'Corte usa', sub: 'consumo p/ tam', tone: 'ok' },
        ]}/>
      </HelpCard>
      <div className="card">
        <TableToolbar>
          <SearchInput placeholder="Procurar ficha…" value={search} onChange={setSearch}/>
          <Seg value={filter} onChange={setFilter} options={[
            { value: 'all', label: 'Todas' },
            { value: 'ribana', label: 'Com ribana' },
          ]}/>
        </TableToolbar>
        <table className="tbl">
          <thead><tr><th style={{width:38}}/>
            <SortHeader id="id" sort={sort} setSort={setSort}>Código</SortHeader>
            <SortHeader id="name" sort={sort} setSort={setSort}>Nome</SortHeader>
            <SortHeader id="fabric" sort={sort} setSort={setSort}>Tecido</SortHeader>
            <SortHeader id="gsm" sort={sort} setSort={setSort} num>GSM</SortHeader>
            <SortHeader id="ribana" sort={sort} setSort={setSort}>Ribana</SortHeader>
            <SortHeader id="preco" sort={sort} setSort={setSort} num>Preço</SortHeader>
            <th style={{width:36}}/></tr></thead>
          <tbody>
            {rows.map(s => {
              const sg = GARMENT_TYPES.find(g => g.id === s.tipo);
              return (
              <tr key={s.id} onClick={() => setOpen(s)}>
                <td><span style={{ display:'grid', placeItems:'center', width: 28, height: 28, borderRadius: 6, background: 'var(--surface-2)', color: 'var(--ink-2)' }}>{sg ? React.cloneElement(GARMENT_GLYPHS[sg.id], { width: 14, height: 14, strokeWidth: 1.5 }) : <Icon name="file-text" size={13}/>}</span></td>
                <td className="mono">{s.id}</td>
                <td style={{ color: 'var(--ink)', fontWeight: 500 }}>{s.name}</td>
                <td>{s.fabric}</td>
                <td className="num">{s.gsm}</td>
                <td>{s.ribanaUsa ? <span style={{display:'inline-flex',alignItems:'center',gap:6}}><Icon name="underline" size={12} style={{color:'var(--ink-3)'}}/>{s.ribanaTipo} · {s.ribanaPct}%</span> : <span style={{color:'var(--ink-3)'}}>—</span>}</td>
                <td className="num">{fmtBRL(s.preco)}</td>
                <td><Icon name="chevron-right" size={14} style={{ color: 'var(--ink-3)' }}/></td>
              </tr>
            );})}
          </tbody>
        </table>
      </div>

      <Sheet open={!!open} onClose={() => setOpen(null)}
             title={open ? open.name : ''}
             sub={open ? <span className="mono" style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--ink-3)' }}>{open.id}</span> : null}
             footer={<>
               <button className="btn btn-ghost" style={{ color: 'var(--err)', marginRight: 'auto' }}><Icon name="trash-2" size={13}/> Excluir ficha</button>
               <button className="btn" onClick={() => setOpen(null)}>Fechar</button>
               <button className="btn btn-primary"><Icon name="pencil" size={13}/> Editar ficha</button>
             </>}>
        {open && <SpecDetail s={open}/>}
      </Sheet>

      <NewSpecSheet open={newOpen} onClose={() => setNewOpen(false)}/>
    </div>
  );
};

const SpecDetail = ({ s }) => {
  const usedBy = ORION_DATA.products.filter(p => p.spec === s.id);
  const garment = GARMENT_TYPES.find(g => g.id === s.tipo);
  const aviamentosTotal = (s.aviamentos || []).reduce((sum, a) => sum + (a.cost || 0), 0);
  const custoTotal = aviamentosTotal + (s.mao || 0);
  const margem = s.preco > 0 ? ((s.preco - custoTotal) / s.preco) * 100 : 0;
  return (
    <div>
      {/* Hero with garment glyph + fabric */}
      <div style={{ background: 'var(--surface-2)', borderRadius: 12, padding: 18, marginBottom: 18, position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: 0, right: 0, bottom: 0, width: 120, opacity: .22,
          background: `repeating-linear-gradient(45deg, var(--ink) 0 1px, transparent 1px ${Math.max(3, s.gsm / 30)}px)` }}/>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--ink-2)', marginBottom: 10 }}>
          {garment && GARMENT_GLYPHS[garment.id]}
          <span style={{ fontSize: 11, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '.1em', fontWeight: 600 }}>{garment?.label || 'Peça'}</span>
        </div>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 22, color: 'var(--ink)', marginBottom: 16 }}>{s.fabric}</div>
        <div style={{ display: 'flex', gap: 28, flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: 10.5, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '.08em', fontWeight: 600 }}>Gramatura</div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 24, color: 'var(--ink)', lineHeight: 1, marginTop: 4 }}>{s.gsm}<span style={{ fontSize: 12, color: 'var(--ink-3)', marginLeft: 4 }}>g/m²</span></div>
          </div>
          <div>
            <div style={{ fontSize: 10.5, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '.08em', fontWeight: 600 }}>Consumo</div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 24, color: 'var(--ink)', lineHeight: 1, marginTop: 4 }}>{fmt(s.consumo, 2)}<span style={{ fontSize: 12, color: 'var(--ink-3)', marginLeft: 4 }}>kg/peça</span></div>
          </div>
          <div>
            <div style={{ fontSize: 10.5, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '.08em', fontWeight: 600, display:'flex', alignItems:'center', gap:4 }}><Icon name="underline" size={11}/>Ribana</div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 24, color: 'var(--ink)', lineHeight: 1, marginTop: 4 }}>{s.ribanaUsa ? `${s.ribanaPct}%` : '—'}</div>
            {s.ribanaUsa && <div style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 2 }}>{s.ribanaTipo}</div>}
          </div>
        </div>
      </div>

      {/* Aviamentos list */}
      <div style={{ marginBottom: 18 }}>
        <div style={{ fontSize: 11, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '.08em', fontWeight: 600, marginBottom: 10 }}>Aviamentos ({(s.aviamentos||[]).length})</div>
        <div style={{ border: '1px solid var(--line-soft)', borderRadius: 8, overflow: 'hidden' }}>
          {(s.aviamentos || []).map((a, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', borderBottom: i < s.aviamentos.length - 1 ? '1px solid var(--line-soft)' : 'none', background: i % 2 ? 'var(--surface)' : 'transparent', fontSize: 13 }}>
              <span style={{ color: 'var(--ink)' }}>{a.tipo}</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--ink-2)' }}>{fmtBRL(a.cost)}</span>
            </div>
          ))}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: 'var(--surface-2)', fontSize: 12.5 }}>
            <span style={{ color: 'var(--ink-2)', fontWeight: 500 }}>Subtotal aviamentos</span>
            <span style={{ fontFamily: 'var(--font-display)', fontSize: 14, color: 'var(--ink)' }}>{fmtBRL(aviamentosTotal)}</span>
          </div>
        </div>
      </div>

      {/* Custo & preço */}
      <div style={{ marginBottom: 18 }}>
        <div style={{ fontSize: 11, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '.08em', fontWeight: 600, marginBottom: 10 }}>Custo & preço</div>
        <FormGrid>
          <FormCell icon="hammer" label="Mão-de-obra">{fmtBRL(s.mao)}</FormCell>
          <FormCell icon="package" label="Aviamentos">{fmtBRL(aviamentosTotal)}</FormCell>
          <FormCell icon="calculator" label="Custo total">{fmtBRL(custoTotal)}</FormCell>
          <FormCell icon="tag" label="Preço de venda">{fmtBRL(s.preco)}</FormCell>
        </FormGrid>
        {s.preco > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 10, padding: '10px 14px', background: 'var(--surface-2)', borderRadius: 8, fontSize: 13 }}>
            <span style={{ color: 'var(--ink-2)' }}>Margem bruta</span>
            <span style={{ fontFamily: 'var(--font-display)', fontSize: 18, color: margem > 50 ? 'var(--ok)' : margem > 30 ? 'var(--ink)' : 'var(--warn)' }}>{margem.toFixed(1)}%</span>
          </div>
        )}
      </div>

      <FormGrid>
        <FormCell icon="clock" label="Última edição">{s.updated}</FormCell>
      </FormGrid>

      <div style={{ borderTop: '1px solid var(--line-soft)', paddingTop: 14, marginTop: 18 }}>
        <div style={{ fontSize: 11, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '.08em', fontWeight: 600, marginBottom: 10 }}>Produtos que usam esta ficha</div>
        {usedBy.length ? usedBy.map(p => (
          <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0' }}>
            <FabricThumb tone={p.thumb} size={28}/>
            <span style={{ flex: 1, color: 'var(--ink)', fontWeight: 500 }}>{p.name}</span>
            <span className="mono" style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ink-3)' }}>{p.code}</span>
          </div>
        )) : <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>Nenhum produto usa esta ficha ainda.</div>}
      </div>
    </div>
  );
};

// A single ink chip that doubles as a tiny PNG-status indicator.
// Filled solid = PNG enviado · dashed ring + dot = PNG pendente.
const InkChip = ({ ink, png, size = 18, title }) => {
  const pending = png !== 'ok';
  return (
    <span title={title} style={{ position: 'relative', display: 'inline-block', width: size, height: size, flexShrink: 0 }}>
      <span style={{ display: 'block', width: size, height: size, borderRadius: 999, background: ink,
        border: pending ? '1.5px dashed var(--warn)' : '1.5px solid var(--surface)',
        boxShadow: pending ? 'none' : '0 0 0 1px var(--line)', opacity: pending ? 0.55 : 1 }}/>
      {pending && <span style={{ position: 'absolute', right: -2, bottom: -2, width: size * 0.42, height: size * 0.42, borderRadius: 999, background: 'var(--warn)', border: '1.5px solid var(--surface)' }}/>}
    </span>
  );
};

// Helpers for the front/back PNG model.
// Sides are a PROPERTY OF THE PRINT (p.sides) — every color carries exactly those
// sides. A side object is {file,png}; png:"ok" = uploaded, else pending.
const SIDE_LABEL = { front: 'Frente', back: 'Costas' };
const printSides = (p) => (p && p.sides && p.sides.length) ? p.sides : ['front'];
const varPendingSides = (p, v) => printSides(p).filter(s => !v[s] || v[s].png !== 'ok').length;
const varIsReady = (p, v) => varPendingSides(p, v) === 0;
const printPendingPngs = (p) => (p.variations || []).reduce((n, v) => n + varPendingSides(p, v), 0);

// Row of ink chips for a print's color variations + a pending-PNG badge.
const VariationPips = ({ print }) => {
  const variations = print.variations || [];
  const pending = printPendingPngs(print);
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      <span style={{ display: 'inline-flex', gap: 5 }}>
        {variations.slice(0, 4).map(v => <InkChip key={v.id} ink={v.ink} png={varIsReady(print, v) ? 'ok' : 'pendente'} size={16} title={`${v.name} · ${varIsReady(print, v) ? 'PNGs ok' : varPendingSides(print, v) + ' PNG pendente(s)'}`}/>)}
        {variations.length > 4 && <span style={{ fontSize: 11, color: 'var(--ink-3)', alignSelf: 'center' }}>+{variations.length - 4}</span>}
      </span>
      {pending > 0 && (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, padding: '1px 7px', borderRadius: 999, background: 'color-mix(in oklab, var(--warn) 14%, var(--surface))', color: 'var(--warn)', fontSize: 10.5, fontWeight: 600 }}>
          <Icon name="alert-circle" size={10}/> {pending} PNG
        </span>
      )}
    </span>
  );
};

const Prints = () => {
  const [open, setOpen] = React.useState(null);
  const [newOpen, setNewOpen] = React.useState(false);
  const [search, setSearch] = React.useState('');
  const [tech, setTech] = React.useState('all');
  const [sort, setSort] = React.useState({ col: 'id', dir: 'asc' });
  const cmp = makeCmp(sort, { id: p=>p.id, name: p=>p.name, technique: p=>p.technique, cost: p=>p.cost, tag: p=>p.tag });
  const techs = ['all', ...Array.from(new Set(ORION_DATA.prints.map(p => p.technique)))];
  const rows = ORION_DATA.prints.filter(p => {
    if (search) { const q = search.toLowerCase(); if (!p.name.toLowerCase().includes(q) && !p.id.toLowerCase().includes(q) && !(p.tag||'').toLowerCase().includes(q)) return false; }
    if (tech !== 'all' && p.technique !== tech) return false;
    return true;
  }).slice().sort(cmp);
  return (
    <div className="page">
      <PageHead sub="prints" title="Estampas" titleEm="& artes"
                desc="Artes aplicadas — DTF, silk e sublimação."
                actions={<button className="btn btn-primary" onClick={() => setNewOpen(true)}><Icon name="palette" size={14}/> Nova estampa</button>}/>
      <HelpCard id="prints" icon="palette" tone="var(--brand-catalog)" title="Estampas — o catálogo de artes que vão na peça">
        <HelpBody>
          Cada <b>estampa</b> guarda a <b>arte</b> e o <b>método</b> de aplicação — DTF, silk ou sublimação — com posição e tamanho de impressão. É o que o Montador encaixa na folha e o que a etiqueta de cada peça mostra.
        </HelpBody>
        <Flow accent="var(--brand-catalog)" steps={[
          { icon: 'image', label: 'Arte enviada', sub: 'arquivo .png' },
          { icon: 'palette', label: 'Estampa', sub: 'método & tamanho', tone: 'accent' },
          { icon: 'shirt', label: 'Aplicada', sub: 'no produto', tone: 'ok' },
        ]}/>
      </HelpCard>
      <div className="card">
        <TableToolbar>
          <SearchInput placeholder="Procurar estampa…" value={search} onChange={setSearch}/>
          <Seg value={tech} onChange={setTech} options={techs.map(t => ({ value: t, label: t === 'all' ? 'Todas' : t }))}/>
        </TableToolbar>
        <table className="tbl">
          <thead><tr>
            <th style={{width:38}}/>
            <SortHeader id="id" sort={sort} setSort={setSort}>Código</SortHeader>
            <SortHeader id="name" sort={sort} setSort={setSort}>Nome</SortHeader>
            <SortHeader id="technique" sort={sort} setSort={setSort}>Técnica</SortHeader>
            <th>Variações de cor</th>
            <SortHeader id="cost" sort={sort} setSort={setSort} align="num">Custo/un</SortHeader>
            <SortHeader id="tag" sort={sort} setSort={setSort}>Tag</SortHeader>
            <th style={{width:36}}/>
          </tr></thead>
          <tbody>{rows.map(p => {
            const [a, b] = TONE_BG[p.tone] || TONE_BG.warm;
            return (
              <tr key={p.id} onClick={() => setOpen(p)}>
                <td><span style={{ display:'grid', placeItems:'center', width: 28, height: 28, borderRadius: 6, background: `radial-gradient(circle at 30% 30%, ${a}, ${b})`, color: 'rgba(255,255,255,.85)' }}><Icon name="palette" size={13}/></span></td>
                <td className="mono">{p.id}</td>
                <td style={{color:'var(--ink)',fontWeight:500}}>{p.name}</td>
                <td>{p.technique}</td>
                <td><VariationPips print={p}/></td>
                <td className="num">{fmtBRL(p.cost)}</td>
                <td><span style={{ display:'inline-flex', alignItems:'center', gap: 4, padding: '2px 8px', background: 'var(--surface-2)', borderRadius: 999, fontSize: 11, color: 'var(--ink-2)' }}><Icon name="tag" size={10}/>{p.tag}</span></td>
                <td><Icon name="chevron-right" size={14} style={{ color: 'var(--ink-3)' }}/></td>
              </tr>
            );
          })}</tbody>
        </table>
      </div>

      <Sheet open={!!open} onClose={() => setOpen(null)}
             title={open ? open.name : ''}
             sub={open ? <span className="mono" style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--ink-3)' }}>{open.id}</span> : null}
             footer={<>
               <button className="btn btn-ghost" style={{ color: 'var(--err)', marginRight: 'auto' }}><Icon name="trash-2" size={13}/> Excluir estampa</button>
               <button className="btn" onClick={() => setOpen(null)}>Fechar</button>
               <button className="btn"><Icon name="download" size={13}/> Baixar arte</button>
               <button className="btn btn-primary"><Icon name="pencil" size={13}/> Editar</button>
             </>}>
        {open && <PrintDetail p={open}/>}
      </Sheet>

      <NewPrintSheet open={newOpen} onClose={() => setNewOpen(false)}/>
    </div>
  );
};

// Art preview tile for one print variation — the recolored art on a tinted ground.
const VariationArt = ({ tone, ink, png, size = 'lg' }) => {
  const [a, b] = TONE_BG[tone] || TONE_BG.warm;
  const pending = png !== 'ok';
  const big = size === 'lg';
  return (
    <div style={{ aspectRatio: big ? '4 / 3' : '1 / 1', borderRadius: big ? 12 : 9, position: 'relative', overflow: 'hidden',
      background: pending ? 'var(--surface-2)' : `radial-gradient(circle at 30% 30%, ${a} 0%, ${b} 100%)`,
      border: pending ? '2px dashed var(--line)' : 'none',
      display: 'grid', placeItems: 'center' }}>
      {pending ? (
        <div style={{ textAlign: 'center', color: 'var(--ink-3)', padding: 8 }}>
          <Icon name="image-off" size={big ? 30 : 18} style={{ marginBottom: big ? 6 : 2 }}/>
          {big && <div style={{ fontSize: 11.5 }}>PNG não enviado</div>}
        </div>
      ) : (
        <Icon name="palette" size={big ? 56 : 22} style={{ color: ink === '#f4f1ea' || ink === '#efe6d3' ? 'rgba(255,255,255,.85)' : 'rgba(255,255,255,.6)' }}/>
      )}
    </div>
  );
};

// One side (frente/costas) of a variation: art preview + status + upload/replace.
// onUpload/onClear manage the FILE; onRemoveSide drops the side from the whole print.
const SidePngTile = ({ tone, ink, side, label, onUpload, onClear, onRemoveSide, removable }) => {
  const pending = side.png !== 'ok';
  return (
    <div style={{ flex: 1, minWidth: 0, border: '1px solid var(--line-soft)', borderRadius: 9, overflow: 'hidden', background: 'var(--surface)' }}>
      <div style={{ position: 'relative' }}>
        <VariationArt tone={tone} ink={ink} png={side.png} size="sm"/>
        <span style={{ position: 'absolute', top: 5, left: 5, padding: '1px 6px', borderRadius: 999, background: 'rgba(0,0,0,.45)', color: '#fff', fontSize: 9.5, fontWeight: 600, letterSpacing: '.04em', textTransform: 'uppercase' }}>{label}</span>
        {onRemoveSide && (
          <button type="button" title={`Remover ${label.toLowerCase()} de todas as cores`} onClick={onRemoveSide} disabled={!removable}
            style={{ position: 'absolute', top: 4, right: 4, width: 20, height: 20, borderRadius: 999, border: 'none', background: 'rgba(0,0,0,.45)', color: '#fff', display: 'grid', placeItems: 'center', cursor: removable ? 'pointer' : 'not-allowed', opacity: removable ? 1 : 0.4 }}>
            <Icon name="x" size={12}/>
          </button>
        )}
      </div>
      <div style={{ padding: '7px 8px' }}>
        {pending ? (
          <button type="button" onClick={onUpload} className="btn btn-sm" style={{ width: '100%', justifyContent: 'center', borderColor: 'var(--warn)', color: 'var(--warn)', padding: '5px 6px', fontSize: 11.5 }}>
            <Icon name="upload" size={12}/> Subir PNG
          </button>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <Icon name="check-circle-2" size={12} style={{ color: 'var(--ok)', flexShrink: 0 }}/>
            <span className="mono" style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{side.file}</span>
            <button type="button" onClick={onClear} className="btn btn-ghost btn-sm" title="Substituir arquivo" style={{ padding: 3, color: 'var(--ink-3)' }}><Icon name="refresh-cw" size={11}/></button>
          </div>
        )}
      </div>
    </div>
  );
};

// Side helpers shared by detail + new sheet.
const orderSides = (arr) => ['front', 'back'].filter(s => arr.includes(s));
const slug = (s) => (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
const sideFileName = (printName, varName, side) => `${slug(printName) || 'estampa'}_${slug(varName) || 'cor'}_${side === 'front' ? 'frente' : 'costas'}.png`;
const mkPendingSide = () => ({ file: null, png: 'pendente' });
const normalizeVar = (v) => ({ ...v, front: v.front || mkPendingSide(), back: v.back || mkPendingSide() });

const PrintDetail = ({ p }) => {
  const usedBy = ORION_DATA.products.filter(pr => pr.print === p.id);
  const [sides, setSides] = React.useState(() => printSides(p));
  const [vars, setVars] = React.useState(() => (p.variations || []).map(normalizeVar));

  const view = { ...p, sides, variations: vars };
  const pendingPngs = printPendingPngs(view);
  const primary = vars.find(v => varIsReady(view, v)) || vars[0];
  const primarySide = primary ? (primary[sides[0]] || mkPendingSide()) : mkPendingSide();

  const addSide = (s) => setSides(prev => orderSides([...prev, s]));
  const removeSide = (s) => setSides(prev => prev.length > 1 ? prev.filter(x => x !== s) : prev);
  const uploadSide = (id, side) => setVars(vs => vs.map(v => v.id === id ? { ...v, [side]: { file: sideFileName(p.name, v.name, side), png: 'ok' } } : v));
  const clearSide = (id, side) => setVars(vs => vs.map(v => v.id === id ? { ...v, [side]: mkPendingSide() } : v));

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <VariationArt tone={p.tone} ink={primary?.ink} png={primarySide.png} size="lg"/>
      </div>

      <FormGrid>
        <FormCell icon="brush" label="Técnica">{p.technique}</FormCell>
        <FormCell icon="dollar-sign" label="Custo por unidade">{fmtBRL(p.cost)}</FormCell>
        <FormCell icon="tag" label="Categoria">{p.tag}</FormCell>
        <FormCell icon="layers" label="Variações de cor">{vars.length}{pendingPngs > 0 && <span style={{ color: 'var(--warn)', fontSize: 12 }}> · {pendingPngs} PNG pendente{pendingPngs !== 1 ? 's' : ''}</span>}</FormCell>
      </FormGrid>

      <div style={{ borderTop: '1px solid var(--line-soft)', paddingTop: 14, marginTop: 18, marginBottom: 18 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
          <span style={{ fontSize: 11, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '.08em', fontWeight: 600 }}>Variações de cor & arquivos PNG</span>
          <button className="btn btn-ghost btn-sm" style={{ color: 'var(--accent)', padding: '4px 8px' }}><Icon name="plus" size={13}/> Variação</button>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <span style={{ fontSize: 11, color: 'var(--ink-3)' }}>Lados:</span>
          {orderSides(sides).map(s => (
            <span key={s} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '2px 4px 2px 9px', borderRadius: 999, background: 'var(--surface-2)', border: '1px solid var(--line)', fontSize: 11.5, color: 'var(--ink-2)', fontWeight: 500 }}>
              {SIDE_LABEL[s]}
              <button type="button" onClick={() => removeSide(s)} disabled={sides.length <= 1} title="Remover deste estampa (todas as cores)"
                style={{ width: 16, height: 16, borderRadius: 999, border: 'none', background: 'transparent', color: 'var(--ink-3)', display: 'grid', placeItems: 'center', cursor: sides.length <= 1 ? 'not-allowed' : 'pointer', opacity: sides.length <= 1 ? 0.4 : 1 }}><Icon name="x" size={11}/></button>
            </span>
          ))}
          {['front', 'back'].filter(s => !sides.includes(s)).map(s => (
            <button key={s} type="button" onClick={() => addSide(s)} className="btn btn-ghost btn-sm" style={{ color: 'var(--accent)', padding: '2px 8px', fontSize: 11.5 }}><Icon name="plus" size={11}/> {SIDE_LABEL[s]}</button>
          ))}
        </div>
        <div style={{ display: 'grid', gap: 10 }}>
          {vars.map(v => (
            <div key={v.id} style={{ border: '1px solid var(--line-soft)', borderRadius: 11, padding: 11, background: 'var(--surface)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <InkChip ink={v.ink} png={varIsReady(view, v) ? 'ok' : 'pendente'} size={17}/>
                <span style={{ fontSize: 13, color: 'var(--ink)', fontWeight: 600, flex: 1 }}>{v.name}</span>
                <span style={{ fontSize: 10.5, color: varIsReady(view, v) ? 'var(--ok)' : 'var(--warn)', fontWeight: 600 }}>
                  {varIsReady(view, v) ? 'Completo' : `${varPendingSides(view, v)} pendente${varPendingSides(view, v) !== 1 ? 's' : ''}`}
                </span>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                {orderSides(sides).map(s => (
                  <SidePngTile key={s} tone={p.tone} ink={v.ink} side={v[s] || mkPendingSide()} label={SIDE_LABEL[s]}
                    onUpload={() => uploadSide(v.id, s)} onClear={() => clearSide(v.id, s)}
                    onRemoveSide={() => removeSide(s)} removable={sides.length > 1}/>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ borderTop: '1px solid var(--line-soft)', paddingTop: 14, marginBottom: 18 }}>
        <div style={{ fontSize: 11, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '.08em', fontWeight: 600, marginBottom: 10 }}>Especificações de aplicação</div>
        <div style={{ display: 'grid', gap: 8 }}>
          {[
            { icon: 'maximize', label: 'Tamanho da arte', value: p.technique === 'DTF' ? '28×35cm' : '24×30cm' },
            { icon: 'thermometer', label: 'Temperatura', value: '160°C' },
            { icon: 'clock', label: 'Tempo de prensa', value: '15s' },
            { icon: 'shirt', label: 'Posição padrão', value: 'Centro frontal · 8cm da gola' },
          ].map(f => (
            <div key={f.label} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', background: 'var(--surface-2)', borderRadius: 8 }}>
              <Icon name={f.icon} size={13} style={{ color: 'var(--ink-3)' }}/>
              <span style={{ fontSize: 12.5, color: 'var(--ink-2)', flex: 1 }}>{f.label}</span>
              <span style={{ fontSize: 12.5, color: 'var(--ink)', fontWeight: 500 }}>{f.value}</span>
            </div>
          ))}
        </div>
      </div>

      <div style={{ borderTop: '1px solid var(--line-soft)', paddingTop: 14 }}>
        <div style={{ fontSize: 11, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '.08em', fontWeight: 600, marginBottom: 10 }}>Produtos que usam esta estampa</div>
        {usedBy.length ? usedBy.map(pr => (
          <div key={pr.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0' }}>
            <FabricThumb tone={pr.thumb} size={28}/>
            <span style={{ flex: 1, color: 'var(--ink)', fontWeight: 500 }}>{pr.name}</span>
            <span className="mono" style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ink-3)' }}>{pr.code}</span>
          </div>
        )) : <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>Nenhum produto usa esta estampa ainda.</div>}
      </div>
    </div>
  );
};

const NewPrintSheet = ({ open, onClose }) => {
  const cfg = useCatalogConfig();
  const PRINT_COLORS = cfg.printColors;
  const [nome, setNome] = React.useState('');
  const [tech, setTech] = React.useState(cfg.techniques[0] || 'DTF');
  const [cost, setCost] = React.useState(4.20);
  const [tag, setTag] = React.useState('');
  const [sides, setSides] = React.useState(['front']);
  const [vars, setVars] = React.useState([
    { id: 1, ink: PRINT_COLORS[0]?.hex || '#1f1f1f', name: PRINT_COLORS[0]?.name || 'Preto', front: mkPendingSide(), back: mkPendingSide() },
  ]);
  const [adding, setAdding] = React.useState(false);

  const addSide = (s) => setSides(prev => orderSides([...prev, s]));
  const removeSide = (s) => setSides(prev => prev.length > 1 ? prev.filter(x => x !== s) : prev);
  // New colors inherit the SAME sides — they're a print-level property, so no
  // per-color setup; just empty slots for whatever sides the print already uses.
  const addVar = (pc) => { setVars(vs => vs.some(v => v.ink === pc.hex) ? vs : [...vs, { id: Date.now(), ink: pc.hex, name: pc.name, front: mkPendingSide(), back: mkPendingSide() }]); setAdding(false); };
  const removeVar = (id) => setVars(vs => vs.filter(v => v.id !== id));
  const uploadSide = (id, side) => setVars(vs => vs.map(v => v.id === id ? { ...v, [side]: { file: sideFileName(nome, v.name, side), png: 'ok' } } : v));
  const clearSide = (id, side) => setVars(vs => vs.map(v => v.id === id ? { ...v, [side]: mkPendingSide() } : v));

  const view = { sides, variations: vars };
  const ready = vars.filter(v => varIsReady(view, v)).length;
  const allReady = vars.every(v => varIsReady(view, v));
  const available = PRINT_COLORS.filter(pc => !vars.some(v => v.ink === pc.hex));

  return (
    <Sheet open={open} onClose={onClose} title="Nova estampa"
      sub={<span style={{ fontFamily: 'var(--font-mono)', fontSize: 11.5, color: 'var(--ink-3)' }}>EST-XXX</span>}
      footer={<>
        <button className="btn" onClick={onClose}>Cancelar</button>
        <button className="btn btn-primary" onClick={onClose} disabled={!allReady}><Icon name="check" size={13}/> Salvar estampa</button>
      </>}>

      <div style={{ marginBottom: 22 }}>
        <SectionTitle>Identificação</SectionTitle>
        <div className="field"><label>Nome da estampa</label><input value={nome} onChange={e => setNome(e.target.value)} placeholder="Ex: Aurora — Sol nascente"/></div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div className="field"><label>Técnica</label>
            <Select value={tech} onChange={setTech} options={cfg.techniques}/>
          </div>
          <div className="field"><label>Custo por unidade</label><NumField value={cost} onChange={setCost} step={0.05} min={0} decimals={2} prefix="R$"/></div>
        </div>
        <div className="field" style={{ marginBottom: 0 }}><label>Tag / coleção</label><input value={tag} onChange={e => setTag(e.target.value)} placeholder="verão, atemporal, edição limitada…"/></div>
      </div>

      <div style={{ marginBottom: 6 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, paddingBottom: 8, borderBottom: '1px solid var(--line-soft)' }}>
          <span style={{ fontSize: 11, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '.1em', fontWeight: 600 }}>Variações de cor & PNG</span>
          <span style={{ fontSize: 11, color: allReady ? 'var(--ok)' : 'var(--warn)', fontWeight: 600 }}>{ready}/{vars.length} cor(es) completas</span>
        </div>
        <p style={{ fontSize: 11.5, color: 'var(--ink-3)', margin: '0 0 12px', lineHeight: 1.5 }}>
          Os lados valem para <strong style={{ color: 'var(--ink-2)' }}>todas as cores</strong> — defina aqui se a arte vai na frente, nas costas, ou ambos. Depois suba um PNG por lado em cada cor.
        </p>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14, padding: '9px 11px', background: 'var(--surface-2)', borderRadius: 9 }}>
          <span style={{ fontSize: 11, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '.06em', fontWeight: 600 }}>Lados</span>
          {orderSides(sides).map(s => (
            <span key={s} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 5px 3px 10px', borderRadius: 999, background: 'var(--surface)', border: '1px solid var(--line)', fontSize: 12, color: 'var(--ink)', fontWeight: 500 }}>
              {SIDE_LABEL[s]}
              <button type="button" onClick={() => removeSide(s)} disabled={sides.length <= 1} title="Remover este lado de todas as cores"
                style={{ width: 17, height: 17, borderRadius: 999, border: 'none', background: 'transparent', color: 'var(--ink-3)', display: 'grid', placeItems: 'center', cursor: sides.length <= 1 ? 'not-allowed' : 'pointer', opacity: sides.length <= 1 ? 0.4 : 1 }}><Icon name="x" size={12}/></button>
            </span>
          ))}
          {['front', 'back'].filter(s => !sides.includes(s)).map(s => (
            <button key={s} type="button" onClick={() => addSide(s)} className="btn btn-ghost btn-sm" style={{ color: 'var(--accent)', padding: '3px 9px', fontSize: 12 }}><Icon name="plus" size={12}/> {SIDE_LABEL[s]}</button>
          ))}
        </div>

        <div style={{ display: 'grid', gap: 8 }}>
          {vars.map(v => {
            const sideTile = (s) => {
              const side = v[s] || mkPendingSide();
              const pend = side.png !== 'ok';
              return (
                <div key={s} style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 10, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '.06em', fontWeight: 600, marginBottom: 4 }}>{SIDE_LABEL[s]}</div>
                  {pend ? (
                    <button type="button" onClick={() => uploadSide(v.id, s)}
                      style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '8px 10px', border: '1.5px dashed var(--line)', borderRadius: 8, background: 'var(--surface-2)', cursor: 'pointer', color: 'var(--ink-2)', fontFamily: 'inherit', fontSize: 12, fontWeight: 500 }}>
                      <Icon name="upload-cloud" size={14}/> Subir PNG
                    </button>
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 9px', background: 'color-mix(in oklab, var(--ok) 9%, var(--surface))', borderRadius: 8 }}>
                      <Icon name="check-circle-2" size={13} style={{ color: 'var(--ok)', flexShrink: 0 }}/>
                      <span className="mono" style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5, color: 'var(--ink-2)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{side.file}</span>
                      <button type="button" onClick={() => clearSide(v.id, s)} title="Remover arquivo" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-3)', padding: 0, display: 'inline-flex' }}><Icon name="x" size={12}/></button>
                    </div>
                  )}
                </div>
              );
            };
            return (
              <div key={v.id} style={{ border: '1px solid var(--line-soft)', borderRadius: 10, padding: 11, background: 'var(--surface)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                  <InkChip ink={v.ink} png={varIsReady(view, v) ? 'ok' : 'pendente'} size={20}/>
                  <span style={{ fontSize: 13, color: 'var(--ink)', fontWeight: 500, flex: 1 }}>{v.name}</span>
                  <span style={{ fontSize: 10.5, color: varIsReady(view, v) ? 'var(--ok)' : 'var(--warn)', fontWeight: 600 }}>
                    {varIsReady(view, v) ? 'Completo' : `${varPendingSides(view, v)} pendente${varPendingSides(view, v) !== 1 ? 's' : ''}`}
                  </span>
                  <button type="button" className="btn btn-ghost btn-sm" title="Remover variação" onClick={() => removeVar(v.id)} disabled={vars.length <= 1} style={{ padding: 5, flexShrink: 0, color: 'var(--ink-3)', opacity: vars.length <= 1 ? 0.4 : 1 }}><Icon name="trash-2" size={14}/></button>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  {orderSides(sides).map(s => sideTile(s))}
                </div>
              </div>
            );
          })}
        </div>

        <div style={{ marginTop: 8 }}>
          {!adding ? (
            <button type="button" onClick={() => setAdding(true)} disabled={!available.length}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '8px 2px', background: 'transparent', border: 'none', cursor: available.length ? 'pointer' : 'default', color: 'var(--accent)', fontFamily: 'inherit', fontSize: 12.5, fontWeight: 500, opacity: available.length ? 1 : 0.4 }}>
              <Icon name="plus" size={14}/> Adicionar variação de cor
            </button>
          ) : (
            <div style={{ border: '1px solid var(--line)', borderRadius: 10, padding: 11, marginTop: 4 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ fontSize: 11, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '.08em', fontWeight: 600 }}>Cor da tinta</span>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => setAdding(false)} style={{ padding: 4, color: 'var(--ink-3)' }}><Icon name="x" size={14}/></button>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(116px, 1fr))', gap: 8 }}>
                {available.map(pc => (
                  <button key={pc.hex} type="button" onClick={() => addVar(pc)}
                    style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 9px', borderRadius: 8, border: '1px solid var(--line)', background: 'var(--surface)', cursor: 'pointer', textAlign: 'left' }}>
                    <InkChip ink={pc.hex} png="ok" size={18}/>
                    <span style={{ fontSize: 11.5, color: 'var(--ink-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{pc.name}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </Sheet>
  );
};

Object.assign(window, { Products, Specs, Prints, GARMENT_GLYPHS, GARMENT_TYPES, GARMENT_ICON_LIBRARY });
