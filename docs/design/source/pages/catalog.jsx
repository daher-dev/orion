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
                desc="Combinações de ficha técnica + estampa, organizadas por tamanho e cor."
                actions={<button className="btn btn-primary" onClick={() => setNewOpen(true)}><Icon name="shirt" size={14}/> Novo produto</button>}/>
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
                    <span style={{ display: 'inline-flex', gap: 3 }}>
                      {p.colors.slice(0, 4).map((c, i) => (
                        <span key={i} style={{ width: 14, height: 14, borderRadius: 999, background: c, border: '1.5px solid var(--surface)', boxShadow: '0 0 0 1px var(--line)' }}/>
                      ))}
                      {p.colors.length > 4 && <span style={{ fontSize: 11, color: 'var(--ink-3)', marginLeft: 4 }}>+{p.colors.length - 4}</span>}
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

const PALETTE = [
  { hex: '#1f1f1f', name: 'Preto' },
  { hex: '#f4f1ea', name: 'Off-white' },
  { hex: '#7a4b2a', name: 'Marrom' },
  { hex: '#c9b9a3', name: 'Areia' },
  { hex: '#cfb98e', name: 'Bege' },
  { hex: '#7a8a76', name: 'Verde-musgo' },
  { hex: '#3a4a3d', name: 'Verde escuro' },
  { hex: '#6b4a2e', name: 'Caramelo' },
  { hex: '#b03a2e', name: 'Vermelho' },
  { hex: '#2a3b5a', name: 'Azul-marinho' },
];
const SIZES = ['P','M','G','GG','U'];

const NewProductSheet = ({ open, onClose }) => {
  const [nome, setNome] = React.useState('');
  const [specId, setSpecId] = React.useState(ORION_DATA.specs[0]?.id || '');
  const [printId, setPrintId] = React.useState(ORION_DATA.prints[0]?.id || '');
  const [sizes, setSizes] = React.useState(['P','M','G']);
  const [colors, setColors] = React.useState(['#1f1f1f','#f4f1ea']);
  const spec = ORION_DATA.specs.find(s => s.id === specId);
  const print = ORION_DATA.prints.find(p => p.id === printId);
  const garment = spec && GARMENT_TYPES.find(g => g.id === spec.tipo);
  const skuBase = (() => {
    const tag = (nome || 'novo').toUpperCase().replace(/[^A-Z]/g, '').slice(0, 3) || 'NOV';
    return `${garment?.skuPrefix || 'PRD'}-${tag}`;
  })();

  const toggle = (arr, v, set) => set(arr.includes(v) ? arr.filter(x => x !== v) : [...arr, v]);

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
        <SectionTitle>Cores disponíveis</SectionTitle>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 8 }}>
          {PALETTE.map(c => {
            const active = colors.includes(c.hex);
            return (
              <button key={c.hex} type="button" onClick={() => toggle(colors, c.hex, setColors)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '7px 9px', borderRadius: 8,
                  border: active ? '1.5px solid var(--accent)' : '1px solid var(--line)',
                  background: active ? 'var(--accent-soft)' : 'var(--surface)',
                  cursor: 'pointer', textAlign: 'left', position: 'relative',
                }}>
                <span style={{ width: 18, height: 18, borderRadius: 999, background: c.hex, border: '1.5px solid var(--surface)', boxShadow: '0 0 0 1px var(--line)', flexShrink: 0 }}/>
                <span style={{ fontSize: 11.5, color: active ? 'var(--ink)' : 'var(--ink-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</span>
                {active && <Icon name="check" size={11} style={{ color: 'var(--accent)', marginLeft: 'auto', flexShrink: 0 }}/>}
              </button>
            );
          })}
        </div>
        <div style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 8 }}>
          {colors.length} cor{colors.length !== 1 ? 'es' : ''} · {sizes.length} tamanho{sizes.length !== 1 ? 's' : ''} = <strong style={{ color: 'var(--ink-2)' }}>{colors.length * sizes.length} variações</strong>
        </div>
      </div>

      <div style={{ marginBottom: 6 }}>
        <SectionTitle>SKUs gerados</SectionTitle>
        {(() => {
          const COLOR_CODE = { '#1f1f1f':'PRT', '#f4f1ea':'OFF', '#7a4b2a':'MAR', '#c9b9a3':'ARE', '#cfb98e':'BEG', '#7a8a76':'MUS', '#3a4a3d':'VRD', '#6b4a2e':'CAR', '#b03a2e':'VRM', '#2a3b5a':'AZM' };
          const specCode = spec?.id?.toUpperCase() || 'SPEC';
          const printCode = print?.id ? `-${print.id.toUpperCase()}` : '';
          const skus = [];
          for (const sz of sizes) for (const c of colors) skus.push(`${specCode}-${sz}-${COLOR_CODE[c] || 'COR'}${printCode}`);
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
  const COLOR_NAMES = { '#1f1f1f': 'Preto', '#7a4b2a': 'Marrom', '#c9b9a3': 'Areia', '#efe6d3': 'Off-white', '#cfb98e': 'Bege', '#7a8a76': 'Verde-musgo', '#3a4a3d': 'Verde', '#6b4a2e': 'Caramelo', '#f4f1ea': 'Branco', '#b03a2e': 'Vermelho' };
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
          <FormField label="Cores disponíveis">
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {p.colors.map((c, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 10px 6px 6px', background: 'var(--surface-2)', borderRadius: 999 }}>
                  <span style={{ width: 16, height: 16, borderRadius: 999, background: c, border: '1.5px solid var(--surface)', boxShadow: '0 0 0 1px var(--line)' }}/>
                  <span style={{ fontSize: 12, color: 'var(--ink)' }}>{COLOR_NAMES[c] || c}</span>
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
              <thead><tr><th>Cor</th>{p.sizes.map(s => <th key={s} className="num">{s}</th>)}<th className="num">Total</th></tr></thead>
              <tbody>
                {p.colors.map((c, i) => {
                  const rowStocks = p.sizes.map((s, j) => Math.max(0, ((p.stock / (p.colors.length * p.sizes.length)) * (1 + (i + j) % 3 - 1)) | 0));
                  const rowTotal = rowStocks.reduce((a, b) => a + b, 0);
                  return (
                    <tr key={i}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ width: 16, height: 16, borderRadius: 999, background: c, border: '1.5px solid var(--surface)', boxShadow: '0 0 0 1px var(--line)' }}/>
                          <span>{COLOR_NAMES[c] || c}</span>
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

// Inline garment glyphs — minimal line-art that distinguishes each type
const GARMENT_GLYPHS = {
  camiseta: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M8 3 L5 5 L3 8 L5 10 L7 9 L7 21 L17 21 L17 9 L19 10 L21 8 L19 5 L16 3 C16 5 14.5 6 12 6 C9.5 6 8 5 8 3 Z"/></svg>,
  moletom:  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 7 Q12 2 15 7"/><path d="M9 7 L6 8 L3 11 L5.5 13 L7 12 L7 20 Q7 21 8 21 L16 21 Q17 21 17 20 L17 12 L18.5 13 L21 11 L18 8 L15 7"/><path d="M11.2 7 L11.2 11 M12.8 7 L12.8 11"/><path d="M7 18 L17 18"/></svg>,
  regata:   <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M8 3 L6 10 L6 21 L18 21 L18 10 L16 3 L14 3 C14 5 13 6 12 6 C11 6 10 5 10 3 Z"/></svg>,
  blusa:    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M8 3 L4 7 L7 10 L7 21 L17 21 L17 10 L20 7 L16 3 L14 5 L12 4 L10 5 Z"/></svg>,
  calca:    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 3 L19 3 L19 10 L18 21 L14 21 L13 12 L11 12 L10 21 L6 21 L5 10 Z"/><path d="M5 7 L19 7"/></svg>,
  bermuda:  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 4 L19 4 L19 9 L17 16 L13 16 L12 11 L10 11 L9 16 L7 16 L5 9 Z"/><path d="M5 7 L19 7"/></svg>,
};

const GARMENT_TYPES = [
  { id: 'camiseta', label: 'Camiseta', skuPrefix: 'CAM' },
  { id: 'moletom',  label: 'Moletom',  skuPrefix: 'MOL' },
  { id: 'regata',   label: 'Regata',   skuPrefix: 'REG' },
  { id: 'blusa',    label: 'Blusa',    skuPrefix: 'BLU' },
  { id: 'calca',    label: 'Calça',    skuPrefix: 'CAL' },
  { id: 'bermuda',  label: 'Bermuda',  skuPrefix: 'BER' },
];

const FABRIC_TYPES = ['Algodão 30.1', 'Algodão 24.1 penteado', 'Malha PV (67/33)', 'Malha 100% poliéster', 'Moletom flanelado', 'Sarja crua', 'Linho misto', 'Piquet algodão'];
const RIBANA_TYPES = ['Ribana 1×1', 'Ribana 2×1', 'Ribana 2×2', 'Ribana canelada'];
const AVIAMENTO_TYPES = ['Etiqueta interna tecida', 'Etiqueta de composição', 'Etiqueta externa estampada', 'Tag de papel', 'Lacre/sigilo', 'Cordão capuz', 'Zíper', 'Botão', 'Cadarço', 'Elástico'];

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
  const [tipo, setTipo] = React.useState('camiseta');
  const [nome, setNome] = React.useState('');
  const [tecido, setTecido] = React.useState(FABRIC_TYPES[0]);
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

  const garment = GARMENT_TYPES.find(g => g.id === tipo);
  const sku = `${garment.skuPrefix}-XXX`;

  const addAv = () => setAviamentos(a => [...a, { id: Date.now(), tipo: AVIAMENTO_TYPES[0], cost: 0 }]);
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
          <Select value={tecido} onChange={setTecido} options={FABRIC_TYPES}/>
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
              <Select value={av.tipo} onChange={(v) => updateAv(av.id, { tipo: v })} options={AVIAMENTO_TYPES}/>
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
                desc="Receitas de produção: tecido, gramatura, ribana e custo CMT."
                actions={<button className="btn btn-primary" onClick={() => setNewOpen(true)}><Icon name="file-text" size={14}/> Nova ficha</button>}/>
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
                desc="Catálogo de artes aplicadas — DTF, silk, sublimação."
                actions={<button className="btn btn-primary" onClick={() => setNewOpen(true)}><Icon name="palette" size={14}/> Nova estampa</button>}/>
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
               <button className="btn" onClick={() => setOpen(null)}>Fechar</button>
               <button className="btn"><Icon name="download" size={13}/> Baixar arte</button>
               <button className="btn btn-primary"><Icon name="pencil" size={13}/> Editar</button>
             </>}>
        {open && <PrintDetail p={open}/>}
      </Sheet>

      <Sheet open={newOpen} onClose={() => setNewOpen(false)} title="Subir nova arte"
             footer={<>
               <button className="btn" onClick={() => setNewOpen(false)}>Cancelar</button>
               <button className="btn btn-primary" onClick={() => setNewOpen(false)}><Icon name="upload" size={13}/> Salvar estampa</button>
             </>}>
        <div style={{ aspectRatio: '4/3', border: '2px dashed var(--line)', borderRadius: 12, display: 'grid', placeItems: 'center', background: 'var(--surface-2)', cursor: 'default', marginBottom: 14 }}>
          <div style={{ textAlign: 'center', color: 'var(--ink-3)' }}>
            <Icon name="upload-cloud" size={36} style={{ marginBottom: 8, color: 'var(--ink-3)' }}/>
            <div style={{ fontSize: 13, color: 'var(--ink)', fontWeight: 500 }}>Arraste a arte aqui</div>
            <div style={{ fontSize: 11.5, marginTop: 4 }}>PNG, SVG ou PDF · até 20MB</div>
          </div>
        </div>
        <div className="field"><label>Nome da estampa</label><input placeholder="Ex: Aurora — Sol nascente"/></div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div className="field"><label>Técnica</label>
            <Select value="DTF" onChange={() => {}} options={['DTF','Silkscreen','Sublimação']}/>
          </div>
          <div className="field"><label>Custo por unidade</label><NumField value={4.20} onChange={() => {}} step={0.05} min={0} decimals={2} prefix="R$"/></div>
        </div>
        <div className="field"><label>Tag / coleção</label><input placeholder="verão, atemporal, edição limitada…"/></div>
      </Sheet>
    </div>
  );
};

const PrintDetail = ({ p }) => {
  const [a, b] = TONE_BG[p.tone] || TONE_BG.warm;
  const usedBy = ORION_DATA.products.filter(pr => pr.print === p.id);
  return (
    <div>
      <div style={{ aspectRatio: '4 / 3', background: `radial-gradient(circle at 30% 30%, ${a} 0%, ${b} 100%)`, borderRadius: 12, marginBottom: 16, display: 'grid', placeItems: 'center', position: 'relative', overflow: 'hidden' }}>
        <Icon name="palette" size={64} style={{ color: 'rgba(255,255,255,.55)' }}/>
        <div style={{ position: 'absolute', bottom: 12, right: 12, display: 'flex', gap: 6 }}>
          <span className="pill" style={{ background: 'rgba(255,255,255,.85)' }}>{p.technique}</span>
          <span className="pill" style={{ background: 'rgba(255,255,255,.85)' }}>{p.tag}</span>
        </div>
      </div>

      <FormGrid>
        <FormCell icon="brush" label="Técnica">{p.technique}</FormCell>
        <FormCell icon="dollar-sign" label="Custo por unidade">{fmtBRL(p.cost)}</FormCell>
        <FormCell icon="tag" label="Categoria">{p.tag}</FormCell>
        <FormCell icon="droplet" label="Cores aplicadas">{p.technique === 'DTF' ? 'CMYK + branco' : p.technique === 'Sublimação' ? 'CMYK' : '2 cores'}</FormCell>
      </FormGrid>

      <div style={{ borderTop: '1px solid var(--line-soft)', paddingTop: 14, marginTop: 18, marginBottom: 18 }}>
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

Object.assign(window, { Products, Specs, Prints, GARMENT_GLYPHS, GARMENT_TYPES });
