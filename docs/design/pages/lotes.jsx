// Pedidos — Lotes tab (list + detail + Montador DTF) and Mapeamento tab.
// Loaded before pages/separacao.jsx; shares helpers via window (FF, EstampaThumb…).

const LFF = () => ORION_DATA.fulfillment;

// status → semantic color, used to tint the lote's layers glyph
const LOTE_STATUS_COLOR = {
  aberto:      { fg: 'var(--ink-2)', bg: 'var(--surface-2)', line: 'var(--line)' },
  em_producao: { fg: 'var(--warn)',  bg: 'var(--warn-bg)',   line: 'color-mix(in oklab, var(--warn) 24%, var(--surface))' },
  despachado:  { fg: 'var(--ok)',    bg: 'var(--ok-bg)',     line: 'color-mix(in oklab, var(--ok) 24%, var(--surface))' },
};
const LoteGlyph = ({ status, size = 38 }) => {
  const c = LOTE_STATUS_COLOR[status] || LOTE_STATUS_COLOR.aberto;
  return (
    <span style={{ width: size, height: size, borderRadius: 9, background: c.bg, color: c.fg,
      border: `1px solid ${c.line}`, display: 'grid', placeItems: 'center', flexShrink: 0 }}>
      <Icon name="layers" size={Math.round(size * 0.46)} strokeWidth={1.7}/>
    </span>
  );
};

// PNG-status badge for an estampa
const PngBadge = ({ png }) => {
  const ok = png === 'ok';
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px', borderRadius: 999, fontSize: 11, fontWeight: 500,
      color: ok ? 'var(--ok)' : 'var(--warn)', background: ok ? 'var(--ok-bg)' : 'var(--warn-bg)',
      border: `1px solid color-mix(in oklab, ${ok ? 'var(--ok)' : 'var(--warn)'} 25%, var(--surface))` }}>
      <Icon name="image" size={11}/> {ok ? 'PNG ok' : 'PNG pendente'}
    </span>
  );
};

// amber/garment pill: "Camiseta/Cropped/Bolsa ecobag"
const GarmentTag = ({ garments }) => (
  <span style={{ display: 'inline-flex', alignItems: 'center', padding: '2px 9px', borderRadius: 999, fontSize: 11.5, fontWeight: 500,
    color: 'var(--warn)', background: 'var(--warn-bg)', border: '1px solid color-mix(in oklab, var(--warn) 22%, var(--surface))' }}>
    {(garments || []).join(' / ')}
  </span>
);

const loteColors = (lote, code, orders) => {
  const cs = [...new Set((orders || []).filter(o => o.lote === lote.id).flatMap(o => o.items.filter(it => it.estampa === code).map(it => it.color)))];
  return cs.length ? cs : ['Unico'];
};

const StatCard = ({ label, value, accent }) => (
  <div style={{ flex: 1, minWidth: 0, padding: '16px 18px', borderRadius: 'var(--radius-lg)',
    background: accent ? 'var(--accent-soft)' : 'var(--surface)', border: `1px solid ${accent ? 'color-mix(in oklab, var(--accent) 22%, var(--surface))' : 'var(--line)'}` }}>
    <div style={{ fontSize: 10.5, color: accent ? 'var(--accent-edge)' : 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '.09em', fontWeight: 600 }}>{label}</div>
    <div style={{ fontFamily: 'var(--font-display)', fontSize: 34, lineHeight: 1.05, marginTop: 6, color: accent ? 'var(--accent)' : 'var(--ink)', fontVariantNumeric: 'tabular-nums' }}>{value}</div>
  </div>
);

// ───────── Montador DTF confirmation ─────────
const MontadorModal = ({ open, onClose, lote, onConfirm }) => {
  if (!open || !lote) return null;
  const toSend = lote.estampas;
  const items = toSend.reduce((s, e) => s + e.items, 0);
  const pendingPng = toSend.filter(e => (LFF().estampas[e.code] || {}).png !== 'ok');
  return (
    <Modal open={open} onClose={onClose}
      title={<span style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
        <span style={{ width: 32, height: 32, borderRadius: 9, background: 'var(--accent-soft)', color: 'var(--accent)', display: 'grid', placeItems: 'center', flexShrink: 0 }}><Icon name="send" size={16}/></span>
        <span>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 17 }}>Enviar estampas para o Montador DTF</div>
          <div style={{ fontSize: 12, color: 'var(--ink-3)', fontWeight: 400, marginTop: 1 }}>{toSend.length} estampa{toSend.length === 1 ? '' : 's'} · {items} {items === 1 ? 'item' : 'itens'} — {lote.id}</div>
        </span>
      </span>}
      footer={<>
        <button className="btn" onClick={onClose}>Cancelar</button>
        <button className="btn btn-primary" onClick={() => { onConfirm(); onClose(); }}><Icon name="send" size={14}/> Enviar {toSend.length} estampa{toSend.length === 1 ? '' : 's'}</button>
      </>}>
      <div style={{ fontSize: 13, color: 'var(--ink-2)', marginBottom: 14 }}>
        Os arquivos PNG serão enviados ao Montador DTF para gerar a folha de gangsheet. O lote avança para <b style={{ color: 'var(--ink)' }}>Em produção</b>.
      </div>
      <div style={{ border: '1px solid var(--line-soft)', borderRadius: 10, overflow: 'hidden' }}>
        {toSend.map((e, i) => {
          const est = LFF().estampas[e.code] || {};
          return (
            <div key={e.code} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', borderBottom: i < toSend.length - 1 ? '1px solid var(--line-soft)' : 'none' }}>
              <EstampaThumb code={e.code} size={34}/>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, color: 'var(--ink)', fontWeight: 500 }}><span style={{ fontFamily: 'var(--font-mono)' }}>{e.code}</span> · {est.name}</div>
                <div style={{ fontSize: 11.5, color: 'var(--ink-3)', marginTop: 2 }}>{e.items} {e.items === 1 ? 'item' : 'itens'}</div>
              </div>
              <PngBadge png={est.png}/>
            </div>
          );
        })}
      </div>
      {pendingPng.length > 0 && (
        <div style={{ display: 'flex', gap: 8, marginTop: 12, padding: '10px 12px', borderRadius: 8, background: 'var(--warn-bg)', border: '1px solid color-mix(in oklab, var(--warn) 22%, var(--surface))', fontSize: 12.5, color: 'var(--warn)' }}>
          <Icon name="alert-triangle" size={14} style={{ flexShrink: 0, marginTop: 1 }}/>
          <span><b>{pendingPng.length}</b> estampa{pendingPng.length === 1 ? '' : 's'} ainda sem PNG aprovado. O montador receberá um aviso para tratar antes de imprimir.</span>
        </div>
      )}
    </Modal>
  );
};

// ───────── Lote detail ─────────
const LoteDetail = ({ lote, orders, onBack, setLotes, openEtiquetas, removeFromLote, showToast }) => {
  const [montador, setMontador] = React.useState(false);
  const [showOrders, setShowOrders] = React.useState(false);
  const necessario = lote.estampas.length;
  const aImprimir = lote.estampas.reduce((s, e) => s + e.toPrint, 0);
  const itensEstampas = lote.estampas.reduce((s, e) => s + e.items, 0);
  const loteOrders = orders.filter(o => o.lote === lote.id);

  const patch = (fn) => setLotes(ls => ls.map(l => l.id === lote.id ? fn(l) : l));
  const toggleMontar = (e) => {
    if (!e.montado) window.StockStore.printEstampa(e.code, e.items, lote.id); // imprime: −papel, +impressos
    patch(l => ({ ...l, estampas: l.estampas.map(x => x.code === e.code ? { ...x, montado: !x.montado, toPrint: !x.montado ? 0 : x.items } : x) }));
  };
  const confirmMontador = () => {
    patch(l => ({ ...l, status: 'em_producao', estampas: l.estampas.map(e => ({ ...e, enviado: true, montado: true, toPrint: 0 })) }));
    showToast(`Estampas enviadas ao Montador DTF · ${lote.id} em produção`);
  };
  const despachar = () => { patch(l => ({ ...l, status: 'despachado' })); showToast(`${lote.id} despachado`); };

  return (
    <div>
      {/* header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 18 }}>
        <button className="btn btn-ghost" onClick={onBack}><Icon name="arrow-left" size={15}/> Voltar</button>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontFamily: 'var(--font-display)', fontSize: 26, color: 'var(--ink)', lineHeight: 1 }}>{lote.num}</span>
            <StatusPill s={lote.status}/>
          </div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12.5, color: 'var(--ink-3)', marginTop: 4 }}>{lote.id}</div>
        </div>
        <div style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--ink-3)' }}>Criado em {lote.created}</div>
      </div>

      {/* stats */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        <StatCard label="Pedidos" value={lote.pedidos}/>
        <StatCard label="Peças" value={lote.pecas}/>
        <StatCard label="Necessário" value={necessario}/>
        <StatCard label="A imprimir" value={aImprimir} accent/>
      </div>

      {/* actions */}
      <div className="card card-pad" style={{ marginBottom: 18, display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        <button className="btn btn-primary" onClick={() => showToast('Ajustes do lote salvos')}><Icon name="save" size={14}/> Salvar ajustes</button>
        <button className="btn" style={{ background: 'var(--ink)', color: 'var(--ink-inv)', borderColor: 'var(--ink)' }} onClick={() => openEtiquetas(piecesFromLote(lote, orders))}>
          <Icon name="printer" size={14}/> Imprimir etiquetas do lote
        </button>
        {lote.status === 'aberto' && (
          <button className="btn btn-primary" onClick={() => setMontador(true)}><Icon name="send" size={14}/> Enviar estampas para o Montador DTF</button>
        )}
        {lote.status === 'em_producao' && (
          <button className="btn btn-primary" onClick={despachar}><Icon name="truck" size={14}/> Marcar como despachado</button>
        )}
        {lote.status === 'despachado' && (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 13, color: 'var(--ok)', fontWeight: 500 }}><Icon name="check-circle-2" size={15}/> Lote despachado</span>
        )}
      </div>

      {/* estampas */}
      <div style={{ fontSize: 12.5, color: 'var(--ink-3)', marginBottom: 10 }}>{lote.estampas.length} estampas · {itensEstampas} itens</div>
      {lote.estampas.length === 0 ? (
        <Empty icon="layers" title="Lote vazio" desc="Todos os pedidos foram removidos deste lote."/>
      ) : (
        <div style={{ display: 'grid', gap: 10 }}>
          {lote.estampas.map(e => {
            const est = LFF().estampas[e.code] || {};
            const cs = loteColors(lote, e.code, orders);
            return (
              <div key={e.code} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 16px', borderRadius: 'var(--radius-lg)',
                background: 'var(--accent-soft)', border: '1px solid color-mix(in oklab, var(--accent) 14%, var(--surface))' }}>
                <EstampaThumb code={e.code} size={48}/>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 9, flexWrap: 'wrap' }}>
                    <span style={{ fontFamily: 'var(--font-display)', fontSize: 18, color: 'var(--ink)' }}>{e.code}</span>
                    <PngBadge png={est.png}/>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 6, flexWrap: 'wrap' }}>
                    <GarmentTag garments={est.garments}/>
                    <span style={{ fontSize: 12, color: 'var(--ink-3)' }}>{cs.length} {cs.length === 1 ? 'cor' : 'cores'} · {cs.join(', ')}</span>
                  </div>
                </div>
                <div style={{ textAlign: 'center', minWidth: 52 }}>
                  <div style={{ fontFamily: 'var(--font-display)', fontSize: 20, color: 'var(--ink)' }}>{e.items}</div>
                  <div style={{ fontSize: 10.5, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '.06em' }}>itens</div>
                </div>
                <div style={{ textAlign: 'center', minWidth: 64 }}>
                  <div style={{ fontFamily: 'var(--font-display)', fontSize: 20, color: e.toPrint > 0 ? 'var(--accent)' : 'var(--ink-3)' }}>{e.toPrint}</div>
                  <div style={{ fontSize: 10.5, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '.06em' }}>a imprimir</div>
                </div>
                <button className="btn btn-sm" onClick={() => toggleMontar(e)}
                  style={e.montado
                    ? { color: 'var(--ok)', background: 'var(--ok-bg)', borderColor: 'color-mix(in oklab, var(--ok) 25%, var(--surface))' }
                    : { color: 'var(--accent)', background: 'var(--surface)', borderColor: 'color-mix(in oklab, var(--accent) 30%, var(--surface))' }}>
                  {e.montado ? <><Icon name="check" size={13}/> Impresso</> : <><Icon name="printer" size={13}/> Imprimir</>}
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* pedidos no lote (remover) */}
      {loteOrders.length > 0 && (
        <div style={{ marginTop: 20 }}>
          <button onClick={() => setShowOrders(v => !v)} style={{ display: 'inline-flex', alignItems: 'center', gap: 7, background: 'none', border: 0, cursor: 'pointer', fontFamily: 'inherit',
            fontSize: 12.5, color: 'var(--ink-2)', fontWeight: 500, padding: '4px 0' }}>
            <Icon name="chevron-right" size={14} style={{ transform: showOrders ? 'rotate(90deg)' : 'none', transition: 'transform .15s' }}/>
            Pedidos no lote ({loteOrders.length})
          </button>
          {showOrders && (
            <div className="card" style={{ marginTop: 8, overflow: 'hidden' }}>
              {loteOrders.map((o, i) => (
                <div key={o.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px', borderBottom: i < loteOrders.length - 1 ? '1px solid var(--line-soft)' : 'none' }}>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13.5, fontWeight: 600, color: 'var(--ink)' }}>{o.id}</span>
                  <PlatformChip id={o.platform}/>
                  <span style={{ fontSize: 12, color: 'var(--ink-3)' }}>{orderPieces(o)} {orderPieces(o) === 1 ? 'peça' : 'peças'}</span>
                  <button className="btn btn-sm btn-ghost" style={{ marginLeft: 'auto', color: 'var(--err)' }} onClick={() => removeFromLote(lote.id, o.id)}>
                    <Icon name="x" size={13}/> Remover
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <MontadorModal open={montador} onClose={() => setMontador(false)} lote={lote} onConfirm={confirmMontador}/>
    </div>
  );
};

// ───────── Lotes tab (list ↔ detail) ─────────
const LotesTab = ({ lotes, setLotes, orders, openLoteId, setOpenLoteId, openEtiquetas, removeFromLote, showToast }) => {
  const [statusF, setStatusF] = React.useState('all');
  const current = lotes.find(l => l.id === openLoteId);

  if (current) {
    return <LoteDetail lote={current} orders={orders} onBack={() => setOpenLoteId(null)}
      setLotes={setLotes} openEtiquetas={openEtiquetas} removeFromLote={removeFromLote} showToast={showToast}/>;
  }

  const rows = lotes.filter(l => statusF === 'all' || l.status === statusF);

  return (
    <div>
      <HelpCard id="lotes" icon="layers" tone="var(--brand-sales)" maxW={720} title="Lotes — agrupe peças idênticas para produzir juntas">
        <HelpBody>
          Um <b>lote</b> junta peças que pedem a mesma <b>estampa</b> e tecido para imprimir e prensar de uma vez só. O <b>Montador DTF</b> encaixa as artes na folha aproveitando o máximo de área. Pronto o lote, as peças voltam para a Separação já estampadas.
        </HelpBody>
        <Flow accent="var(--brand-sales)" steps={[
          { icon: 'package', label: 'Peças do dia', sub: 'mesma estampa' },
          { icon: 'layout-grid', label: 'Montador DTF', sub: 'encaixa a folha', tone: 'accent' },
          { icon: 'printer', label: 'Imprimir', sub: '& prensar' },
          { icon: 'corner-up-left', label: 'Separação', sub: 'já estampada', tone: 'ok' },
        ]}/>
      </HelpCard>
      <div className="card" style={{ overflow: 'hidden' }}>
        <TableToolbar>
          <Seg value={statusF} onChange={setStatusF} options={[
            { value: 'all', label: `Todos (${lotes.length})` },
            { value: 'aberto', label: 'Abertos' },
            { value: 'em_producao', label: 'Em produção' },
            { value: 'despachado', label: 'Despachados' },
          ]}/>
        </TableToolbar>
        {rows.length === 0 ? (
          <Empty icon="layers" title="Nenhum lote"
            desc="Crie um lote selecionando pedidos na aba Separação e clicando em “Criar Lote”."/>
        ) : rows.map((l, i) => {
          const aImprimir = l.estampas.reduce((s, e) => s + e.toPrint, 0);
          return (
            <div key={l.id} onClick={() => setOpenLoteId(l.id)}
              style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '14px 16px', cursor: 'pointer',
                borderBottom: i < rows.length - 1 ? '1px solid var(--line-soft)' : 'none' }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--surface-2)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
              <LoteGlyph status={l.status}/>
              <div style={{ minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13.5, fontWeight: 600, color: 'var(--ink)' }}>{l.id}</span>
                  <StatusPill s={l.status}/>
                </div>
                <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 3 }}>Criado em {l.created}</div>
              </div>
              <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 22 }}>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontFamily: 'var(--font-display)', fontSize: 18, color: 'var(--ink)' }}>{l.pedidos}</div>
                  <div style={{ fontSize: 10, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '.06em' }}>pedidos</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontFamily: 'var(--font-display)', fontSize: 18, color: 'var(--ink)' }}>{l.pecas}</div>
                  <div style={{ fontSize: 10, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '.06em' }}>peças</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontFamily: 'var(--font-display)', fontSize: 18, color: aImprimir > 0 ? 'var(--accent)' : 'var(--ink-3)' }}>{aImprimir}</div>
                  <div style={{ fontSize: 10, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '.06em' }}>a imprimir</div>
                </div>
                <Icon name="chevron-right" size={16} style={{ color: 'var(--ink-3)' }}/>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ───────── Mapeamento tab (De/Para: Item do pedido → Variação/SKU interno) ─────────
// Ad > Pedido > Item do pedido  --→  ProductVariation (SKU)  <  Product
// O item chega do marketplace com a variação do anúncio; aqui ele é vinculado à
// variação interna (SKU) do produto certo. A estampa é consequência do produto.
const COLOR_CODE_FF = { 'Preto': 'PRT', 'Branco': 'BCO', 'Off-white': 'OFF', 'Cru': 'CRU', 'Verde': 'VRD', 'Vermelho': 'VRM' };
const variationSku = (product, color, size) => `${product.code}-${COLOR_CODE_FF[color] || 'COR'}-${String(size).toUpperCase()}`;
const productVariations = (product) => {
  const out = [];
  product.colors.forEach(c => product.sizes.forEach(s => out.push({ sku: variationSku(product, c, s), color: c, size: s })));
  return out;
};

// ── Suggestion engine: guess the internal Product + Variation for an OrderItem ──
const FF_STOP = new Set(['camiseta','moletom','cropped','ecobag','bolsa','canguru','anime','algodao','unissex','premium','sem','variacao','no','anuncio','gola','manga','oversized','masculina','feminina','blusa','shippuden']);
const ffNorm = (s) => (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
const ffTokens = (s) => ffNorm(s).split(/[^a-z0-9]+/).filter(t => t.length > 2 && !FF_STOP.has(t));
const FF_GARMENT_WORD = { camiseta: 'Camiseta', moletom: 'Moletom', canguru: 'Moletom', cropped: 'Cropped', ecobag: 'Ecobag', bolsa: 'Ecobag' };
const ffDetectGarment = (title) => { const t = ffNorm(title); for (const k in FF_GARMENT_WORD) if (t.includes(k)) return FF_GARMENT_WORD[k]; return null; };
const suggestMapping = (item, catalog) => {
  const g = ffDetectGarment(item.adTitle);
  const tks = new Set(ffTokens(item.adTitle));
  let best = null, bestScore = 0;
  for (const p of catalog) {
    if (g && p.garment !== g) continue;
    const score = ffTokens(p.name).reduce((s, t) => s + (tks.has(t) ? 1 : 0), 0);
    if (score > bestScore) { bestScore = score; best = p; }
  }
  if (!best || bestScore === 0) return null;
  const parts = (item.variation || '').split('·').map(x => x.trim());
  const color = best.colors.find(c => ffNorm(c) === ffNorm(parts[0])) || null;
  const sizeRaw = (parts[1] || '').replace(/único/i, 'Unico');
  const size = best.sizes.find(s => ffNorm(s) === ffNorm(sizeRaw)) || null;
  if (!color || !size) return null;
  return { productId: best.id, sku: variationSku(best, color, size), product: best, score: bestScore };
};

const MapeamentoTab = ({ showToast }) => {
  const [items, setItems] = React.useState(() => JSON.parse(JSON.stringify(LFF().orderItems)));
  const [search, setSearch] = React.useState('');
  const [filter, setFilter] = React.useState('pendente');
  const [manual, setManual] = React.useState(() => new Set()); // rows where user chose to map by hand

  const catalog = LFF().catalogProducts;
  const productById = (id) => catalog.find(p => p.id === id);
  const productOpts = catalog.map(p => ({ value: p.id, label: p.name, sub: `${p.code} · estampa ${p.estampa}` }));

  const total = items.length;
  const mapped = items.filter(m => m.productId && m.sku).length;
  const pend = total - mapped;
  const pct = total ? Math.round((mapped / total) * 100) : 0;
  // many-to-one: quantos itens de pedido apontam para o mesmo SKU interno
  const skuUsage = {};
  items.forEach(m => { if (m.sku) skuUsage[m.sku] = (skuUsage[m.sku] || 0) + 1; });
  // suggestions for pending items
  const suggestions = {};
  items.forEach(m => { if (!(m.productId && m.sku)) { const s = suggestMapping(m, catalog); if (s) suggestions[m.id] = s; } });
  const withSuggestion = Object.keys(suggestions).length;

  const toggleManual = (id) => setManual(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const setProduct = (id, productId) => setItems(ms => ms.map(m => m.id === id ? { ...m, productId, sku: null } : m));
  const setVariation = (id, sku) => {
    setItems(ms => ms.map(m => m.id === id ? { ...m, sku } : m));
    if (sku) showToast(`Item vinculado ao SKU ${sku}`);
  };
  const applyMapping = (id, productId, sku) => {
    setItems(ms => ms.map(m => m.id === id ? { ...m, productId, sku } : m));
    setManual(s => { const n = new Set(s); n.delete(id); return n; });
    showToast(`Sugestão aceita · ${sku}`);
  };
  const acceptAll = () => {
    const ids = Object.keys(suggestions);
    if (!ids.length) return;
    setItems(ms => ms.map(m => suggestions[m.id] ? { ...m, productId: suggestions[m.id].productId, sku: suggestions[m.id].sku } : m));
    showToast(`${ids.length} ${ids.length === 1 ? 'sugestão aceita' : 'sugestões aceitas'}`);
  };

  const rows = items.filter(m => {
    if (filter === 'pendente' && m.productId && m.sku) return false;
    if (filter === 'mapeado' && !(m.productId && m.sku)) return false;
    if (search) { const q = search.toLowerCase(); if (!m.adTitle.toLowerCase().includes(q) && !(m.adSku || '').toLowerCase().includes(q) && !(m.sku || '').toLowerCase().includes(q)) return false; }
    return true;
  });

  return (
    <div>
      {/* Explainer: what this tab is for — dismissible */}
      <HelpCard id="mapeamento" icon="git-merge" tone="var(--brand-sales)" title="De/Para — item do pedido → variação (SKU) interna">
        <HelpBody>
          Cada <b>item de pedido</b> chega do marketplace com a variação do anúncio (cor/tamanho do título). Aqui você o vincula à <b>variação interna (SKU)</b> do <b>produto</b> certo — daí saem estoque, estampa e produção. O que o sistema ainda não reconhece entra como <b>pendente</b> e só vai para a Separação depois de vinculado.
        </HelpBody>
        <Flow accent="var(--brand-sales)" steps={[
          { icon: 'shopping-bag', label: 'Item do pedido', sub: 'variação do anúncio' },
          { icon: 'hash', label: 'Produto · SKU', sub: 'variação interna', tone: 'accent' },
          { icon: 'package', label: 'Estoque', sub: 'pronto p/ separar', tone: 'ok' },
        ]}/>
      </HelpCard>


      {/* progress */}
      <div className="card card-pad" style={{ marginBottom: 14, display: 'flex', alignItems: 'center', gap: 18 }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontSize: 13, color: 'var(--ink-2)' }}>
              {pend > 0
                ? <><b style={{ color: 'var(--warn)', fontFamily: 'var(--font-display)', fontSize: 18 }}>{pend}</b> {pend === 1 ? 'item aguardando' : 'itens aguardando'} vínculo{withSuggestion > 0 && <span style={{ color: 'var(--accent)' }}> · {withSuggestion} com sugestão pronta</span>}</>
                : <><b style={{ color: 'var(--ink)', fontFamily: 'var(--font-display)', fontSize: 18 }}>{mapped}</b> de {total} itens vinculados</>}
            </span>
            <span style={{ fontSize: 12.5, color: pct === 100 ? 'var(--ok)' : 'var(--ink-3)', fontWeight: 500 }}>{pct}%</span>
          </div>
          <div style={{ height: 7, background: 'var(--line-soft)', borderRadius: 999, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${pct}%`, background: pct === 100 ? 'var(--ok)' : 'var(--accent)', borderRadius: 999, transition: 'width .25s' }}/>
          </div>
        </div>
      </div>

      {pct === 100 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '12px 16px', marginBottom: 14, borderRadius: 10, background: 'var(--ok-bg)', border: '1px solid color-mix(in oklab, var(--ok) 22%, var(--surface))', fontSize: 13, color: 'var(--ok)' }}>
          <Icon name="check-circle-2" size={16}/> Todos os itens estão vinculados — os pedidos podem seguir para a Separação.
        </div>
      )}

      <div className="card" style={{ overflow: 'hidden' }}>
        <TableToolbar>
          <SearchInput placeholder="Buscar anúncio, SKU do anúncio ou SKU interno…" value={search} onChange={setSearch}/>
          <Seg value={filter} onChange={setFilter} options={[
            { value: 'pendente', label: `Pendentes (${pend})` },
            { value: 'mapeado', label: `Vinculados (${mapped})` },
            { value: 'all', label: `Todos (${total})` },
          ]}/>
          {withSuggestion > 0 && (
            <button className="btn btn-primary btn-sm" style={{ marginLeft: 'auto' }} onClick={acceptAll}>
              <Icon name="sparkles" size={14}/> Aceitar {withSuggestion} {withSuggestion === 1 ? 'sugestão' : 'sugestões'}
            </button>
          )}
        </TableToolbar>
        {rows.length === 0 ? (
          <Empty icon={filter === 'pendente' ? 'check-circle-2' : 'book-marked'}
            title={filter === 'pendente' ? 'Nenhum item pendente' : 'Nada por aqui'}
            desc={filter === 'pendente' ? 'Todos os itens de pedido já estão vinculados a um SKU interno.' : 'Nenhum item corresponde aos filtros.'}/>
        ) : (
          <table className="tbl">
            <thead><tr>
              <th>Item do pedido <span style={{ color: 'var(--ink-3)', fontWeight: 400 }}>(do anúncio)</span></th>
              <th>Variação no anúncio</th>
              <th style={{ width: 380 }}>Produto → Variação (SKU interno)</th>
              <th style={{ width: 120 }}>Status</th>
            </tr></thead>
            <tbody>
              {rows.map(m => {
                const prod = m.productId ? productById(m.productId) : null;
                const varOpts = prod ? productVariations(prod).map(v => ({ value: v.sku, label: `${v.color} · ${v.size}`, sub: v.sku })) : [];
                const isMapped = !!(m.productId && m.sku);
                const shared = m.sku ? skuUsage[m.sku] : 0;
                return (
                  <tr key={m.id} style={{ cursor: 'default', verticalAlign: 'top' }}>
                    <td style={{ paddingTop: 14 }}>
                      <div style={{ color: 'var(--ink)', fontWeight: 500, maxWidth: 320 }}>{m.adTitle}</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginTop: 4 }}>
                        <PlatformChip id={m.platform}/>
                        {m.adSku
                          ? <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ink-3)' }}>{m.adSku}</span>
                          : <span style={{ fontSize: 11, color: 'var(--warn)', fontStyle: 'italic' }}>sem SKU no anúncio</span>}
                      </div>
                    </td>
                    <td style={{ paddingTop: 14 }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', padding: '3px 9px', borderRadius: 6, background: 'var(--surface-2)', border: '1px solid var(--line-soft)', fontSize: 12, color: 'var(--ink-2)', whiteSpace: 'nowrap' }}>{m.variation}</span>
                    </td>
                    <td>
                      {(!isMapped && suggestions[m.id] && !manual.has(m.id)) ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '9px 12px', borderRadius: 'var(--radius-sm)',
                          background: 'var(--accent-soft)', border: '1px solid color-mix(in oklab, var(--accent) 26%, var(--surface))' }}>
                          <Icon name="sparkles" size={15} style={{ color: 'var(--accent)', flexShrink: 0 }}/>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 9.5, letterSpacing: '.09em', textTransform: 'uppercase', color: 'var(--accent-edge)', fontWeight: 600 }}>Sugestão do sistema</div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 2, flexWrap: 'wrap' }}>
                              <span style={{ fontSize: 13, color: 'var(--ink)', fontWeight: 500 }}>{suggestions[m.id].product.name}</span>
                              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--accent)', background: 'var(--surface)', padding: '2px 7px', borderRadius: 5, border: '1px solid color-mix(in oklab, var(--accent) 20%, var(--surface))' }}>{suggestions[m.id].sku}</span>
                              <EstampaTag code={suggestions[m.id].product.estampa}/>
                            </div>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                            <button className="btn btn-primary btn-sm" onClick={() => applyMapping(m.id, suggestions[m.id].productId, suggestions[m.id].sku)}>
                              <Icon name="check" size={13}/> Aceitar
                            </button>
                            <button className="btn btn-ghost btn-sm" onClick={() => toggleManual(m.id)}>Trocar</button>
                          </div>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div style={{ flex: '1 1 0', minWidth: 0 }}>
                            <Select value={m.productId || ''} onChange={(v) => setProduct(m.id, v)} placeholder="Escolher produto…" searchable options={productOpts}/>
                          </div>
                          <Icon name="chevron-right" size={14} style={{ color: 'var(--ink-3)', flexShrink: 0 }}/>
                          <div style={{ flex: '1 1 0', minWidth: 0 }}>
                            {prod
                              ? <Select value={m.sku || ''} onChange={(v) => setVariation(m.id, v)} placeholder="Variação (SKU)…" options={varOpts}/>
                              : <div style={{ padding: '8px 11px', borderRadius: 'var(--radius-sm)', border: '1px dashed var(--line)', fontSize: 12, color: 'var(--ink-3)', background: 'var(--surface-2)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Escolha o produto</div>}
                          </div>
                          {!isMapped && suggestions[m.id] && manual.has(m.id) && (
                            <button className="btn btn-ghost btn-sm" style={{ flexShrink: 0, color: 'var(--accent)' }} title="Voltar para a sugestão" onClick={() => toggleManual(m.id)}>
                              <Icon name="sparkles" size={13}/>
                            </button>
                          )}
                        </div>
                      )}
                      {isMapped && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 6, flexWrap: 'wrap' }}>
                          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--accent)', background: 'var(--accent-soft)', padding: '2px 7px', borderRadius: 5 }}>{m.sku}</span>
                          <EstampaTag code={prod.estampa}/>
                          {shared > 1 && <span style={{ fontSize: 10.5, color: 'var(--ink-3)', display: 'flex', alignItems: 'center', gap: 4 }}><Icon name="copy" size={10}/> {shared} itens neste SKU</span>}
                        </div>
                      )}
                    </td>
                    <td style={{ paddingTop: 14 }}><StatusPill s={isMapped ? 'mapeado' : 'pendente'}/></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

Object.assign(window, { LotesTab, MapeamentoTab, LoteDetail, MontadorModal, PngBadge, GarmentTag });
