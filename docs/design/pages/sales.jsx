// Sales pages — Orders, Clients, Ads

const COLOR_HEX = {
  'Preto': '#1f1f1f', 'Branco': '#f4f1ea', 'Off-white': '#efe6d3', 'Marrom': '#7a4b2a',
  'Areia': '#cfb98e', 'Verde': '#3a4a3d', 'Cru': '#efe6d3', 'Bege': '#c9b9a3', 'Vermelho': '#b03a2e',
};
const parseVariant = (v) => {
  const [color, size] = (v || '').split(' · ');
  return { color: color || '', size: size || '', hex: COLOR_HEX[color] || '#999' };
};

const orderTotal = (o) => o.items.reduce((s, it) => s + it.qty * it.price, 0);
const orderQty   = (o) => o.items.reduce((s, it) => s + it.qty, 0);

const Orders = ({ setRoute }) => {
  const [filter, setFilter] = React.useState('all');
  const [search, setSearch] = React.useState('');
  const [open, setOpen] = React.useState(null);
  const [importOpen, setImportOpen] = React.useState(false);
  const [newOpen, setNewOpen] = React.useState(false);
  const [newOrder, setNewOrder] = React.useState({ channel: 'shopee', client: '', items: [{ productId: '', color: '', size: '', qty: 1 }] });
  const [sort, setSort] = React.useState({ key: 'placedAt', dir: 'desc' });

  const toggleSort = (key) => setSort(s => s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' });
  const SortHead = ({ k, label, num }) => (
    <th className={num ? 'num' : ''} onClick={() => toggleSort(k)} style={{ cursor: 'pointer', userSelect: 'none' }}>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
        {label}
        <Icon name={sort.key !== k ? 'chevrons-up-down' : sort.dir === 'asc' ? 'chevron-up' : 'chevron-down'}
              size={11} style={{ color: sort.key === k ? 'var(--ink-2)' : 'var(--ink-3)', opacity: sort.key === k ? 1 : .5 }}/>
      </span>
    </th>
  );

  const rows = ORION_DATA.orders.filter(o => {
    if (filter !== 'all' && o.status !== filter) return false;
    if (search) {
      const q = search.toLowerCase();
      const inItems = o.items.some(it => it.product.toLowerCase().includes(q) || it.variant.toLowerCase().includes(q));
      if (!o.client.toLowerCase().includes(q) && !o.id.includes(search) && !inItems) return false;
    }
    return true;
  }).slice().sort((a, b) => {
    const dir = sort.dir === 'asc' ? 1 : -1;
    const get = {
      id: o => o.id, channel: o => o.channel, items: o => o.items[0].product,
      qty: o => orderQty(o), status: o => o.status, placedAt: o => o.placedAt, total: o => orderTotal(o),
    }[sort.key] || (o => o.id);
    const va = get(a), vb = get(b);
    if (typeof va === 'number') return (va - vb) * dir;
    return String(va).localeCompare(String(vb)) * dir;
  });

  return (
    <div className="page">
      <PageHead sub="orders" title="Pedidos" titleEm="multi-canal"
                desc="Todos os pedidos, de todos os canais."
                actions={<>
                  <button className="btn btn-primary" onClick={() => setImportOpen(true)}><Icon name="file-up" size={14}/> Importar</button>
                  <button className="btn btn-primary" onClick={() => setNewOpen(true)}><Icon name="shopping-bag" size={14}/> Novo pedido</button>
                </>}/>

      <div className="card" style={{ overflow: 'hidden' }}>
        <TableToolbar>
          <SearchInput placeholder="Procurar pedido…" value={search} onChange={setSearch}/>
          <Seg value={filter} onChange={setFilter} options={[
            { value: 'all', label: `Todos (${ORION_DATA.orders.length})` },
            { value: 'pendente', label: 'Pendentes' },
            { value: 'pago', label: 'Pagos' },
            { value: 'enviado', label: 'Enviados' },
            { value: 'entregue', label: 'Entregues' },
          ]}/>
        </TableToolbar>

        {rows.length ? (
          <table className="tbl">
            <thead><tr>
              <SortHead k="id" label="Pedido"/>
              <SortHead k="channel" label="Canal"/>
              <SortHead k="items" label="Itens"/>
              <SortHead k="qty" label="Qtd" num/>
              <SortHead k="status" label="Status"/>
              <SortHead k="placedAt" label="Data"/>
              <SortHead k="total" label="Valor" num/>
              <th style={{ width: 36 }}/>
            </tr></thead>
            <tbody>
              {rows.map(o => {
                const distinctProducts = [...new Set(o.items.map(it => it.productId))];
                const single = distinctProducts.length === 1;
                const it0 = o.items[0];
                const v0 = parseVariant(it0.variant);
                return (
                <tr key={o.id} onClick={() => setOpen(o)} style={{ cursor: 'default' }}>
                  <td>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                      <span style={{ color: 'var(--ink)', fontWeight: 500 }}>#{o.id}</span>
                      <span className="mono" style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--ink-3)' }}>{o.ext}</span>
                    </div>
                  </td>
                  <td><ChannelChip id={o.channel}/></td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ display: 'flex' }}>
                        {o.items.slice(0,3).map((it, i) => {
                          const prod = ORION_DATA.products.find(p => p.id === it.productId);
                          const spec = prod && ORION_DATA.specs.find(s => s.id === prod.spec);
                          const garment = spec && GARMENT_TYPES.find(g => g.id === spec.tipo);
                          return (
                            <span key={i} style={{
                              marginLeft: i === 0 ? 0 : -8, zIndex: 3 - i,
                              width: 28, height: 28, borderRadius: 6,
                              background: 'var(--surface-2)', border: '2px solid var(--surface)',
                              display: 'grid', placeItems: 'center', color: 'var(--ink-2)',
                            }}>
                              {garment ? React.cloneElement(GARMENT_GLYPHS[garment.id], { width: 14, height: 14, strokeWidth: 1.5 }) : <Icon name="shirt" size={14}/>}
                            </span>
                          );
                        })}
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ color: 'var(--ink)', fontWeight: 500, fontSize: 13 }}>{it0.product}</div>
                        {single ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                            <span style={{ width: 9, height: 9, borderRadius: '50%', background: v0.hex, border: '1px solid var(--line-soft)' }}/>
                            <span style={{ fontSize: 11, color: 'var(--ink-3)' }}>{v0.color}</span>
                            {v0.size && <span style={{ fontSize: 9.5, fontFamily: 'var(--font-mono)', color: 'var(--ink-3)', padding: '1px 4px', border: '1px solid var(--line-soft)', borderRadius: 3, lineHeight: 1.2 }}>{v0.size}</span>}
                          </div>
                        ) : (
                          <div style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 2 }}>+ {distinctProducts.length - 1} {distinctProducts.length === 2 ? 'item' : 'itens'}</div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="num">{orderQty(o)}</td>
                  <td><StatusPill s={o.status}/></td>
                  <td style={{ fontSize: 12, color: 'var(--ink-3)', fontVariantNumeric: 'tabular-nums' }}>{o.placedAt}</td>
                  <td className="num" style={{ color: 'var(--ink)', fontWeight: 500, whiteSpace: 'nowrap' }}>{fmtBRL(orderTotal(o))}</td>
                  <td><Icon name="chevron-right" size={14} style={{ color: 'var(--ink-3)' }}/></td>
                </tr>
              );})}
            </tbody>
          </table>
        ) : <Empty title="Nenhum pedido encontrado" desc="Tente ajustar os filtros ou importar pedidos de um canal." icon="shopping-bag"/>}
      </div>

      <Sheet open={!!open} onClose={() => setOpen(null)}
             title={open ? `Pedido #${open.id}` : ''}
             sub={open ? <ChannelChip id={open.channel}/> : null}
             footer={<>
               <button className="btn btn-ghost" style={{ color: 'var(--err)', marginRight: 'auto' }}><Icon name="trash-2" size={13}/> Excluir pedido</button>
               <button className="btn" onClick={() => setOpen(null)}>Fechar</button>
               <button className="btn btn-primary"><Icon name="check" size={13}/> Salvar</button>
             </>}>
        {open && <OrderDetail o={open} setRoute={setRoute}/>}
      </Sheet>

      <Modal open={importOpen} onClose={() => setImportOpen(false)} title="Importar pedidos"
             footer={<>
               <button className="btn" onClick={() => setImportOpen(false)}>Cancelar</button>
               <button className="btn btn-primary">Continuar</button>
             </>}>
        <div style={{ display: 'grid', gap: 12 }}>
          <button className="btn" style={{ justifyContent: 'flex-start', padding: 14 }}>
            <Icon name="file-text" size={16}/>
            <div style={{ textAlign: 'left' }}>
              <div style={{ fontWeight: 500 }}>Colar de PDF</div>
              <div style={{ fontSize: 11.5, color: 'var(--ink-3)' }}>Extrai com IA — confirme os campos antes de criar</div>
            </div>
          </button>
          <button className="btn" style={{ justifyContent: 'flex-start', padding: 14 }}>
            <Icon name="file-spreadsheet" size={16}/>
            <div style={{ textAlign: 'left' }}>
              <div style={{ fontWeight: 500 }}>Subir CSV</div>
              <div style={{ fontSize: 11.5, color: 'var(--ink-3)' }}>Mapeie as colunas e revise antes de salvar</div>
            </div>
          </button>
          <button className="btn" style={{ justifyContent: 'flex-start', padding: 14 }}>
            <Icon name="webhook" size={16}/>
            <div style={{ textAlign: 'left' }}>
              <div style={{ fontWeight: 500 }}>Conectar canal</div>
              <div style={{ fontSize: 11.5, color: 'var(--ink-3)' }}>Webhooks de Shopee, ML, Shopify e Instagram</div>
            </div>
          </button>
        </div>
      </Modal>

      <Sheet open={newOpen} onClose={() => setNewOpen(false)} title="Novo pedido"
             footer={<>
               <button className="btn" onClick={() => setNewOpen(false)}>Cancelar</button>
               <button className="btn btn-primary" onClick={() => setNewOpen(false)}><Icon name="check" size={13}/> Criar pedido</button>
             </>}>
        <div style={{ marginBottom: 22 }}>
          <div style={{ fontSize: 11, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '.08em', fontWeight: 600, marginBottom: 10, paddingBottom: 8, borderBottom: '1px solid var(--line-soft)' }}>Canal</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 6 }}>
            {Object.keys(ORION_DATA.channels).map(k => {
              const c = ORION_DATA.channels[k]; const sel = newOrder.channel === k;
              return (
                <button key={k} onClick={() => setNewOrder({ ...newOrder, channel: k })} type="button"
                        style={{ padding: '10px 6px', display:'flex', flexDirection: 'column', gap: 6, alignItems:'center',
                          border: sel ? `1.5px solid ${c.color}` : '1px solid var(--line)', borderRadius: 8, cursor: 'pointer',
                          background: sel ? `color-mix(in oklab, ${c.color} 12%, var(--surface))` : 'var(--surface)', fontFamily: 'inherit' }}>
                  <span style={{ width: 24, height: 24, borderRadius: 6, background: c.color, color: c.fg || '#fff', display: 'grid', placeItems: 'center', fontSize: 10, fontWeight: 700 }}>{c.short}</span>
                  <span style={{ fontSize: 11, color: sel ? 'var(--ink)' : 'var(--ink-2)' }}>{c.name}</span>
                </button>
              );
            })}
          </div>
        </div>
        <div style={{ marginBottom: 22 }}>
          <div style={{ fontSize: 11, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '.08em', fontWeight: 600, marginBottom: 10, paddingBottom: 8, borderBottom: '1px solid var(--line-soft)' }}>Cliente</div>
          <Select value={newOrder.client} onChange={(v) => setNewOrder({ ...newOrder, client: v })}
            options={ORION_DATA.clients.map(c => ({ value: c.id, label: c.name, sub: c.city }))}/>
        </div>
        <div style={{ marginBottom: 22 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, paddingBottom: 8, borderBottom: '1px solid var(--line-soft)' }}>
            <div style={{ fontSize: 11, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '.08em', fontWeight: 600 }}>Itens ({newOrder.items.length})</div>
            <button type="button" className="btn" style={{ padding: '4px 10px', fontSize: 11.5 }}
                    onClick={() => setNewOrder(o => ({ ...o, items: [...o.items, { productId: '', color: '', size: '', qty: 1 }] }))}>
              <Icon name="plus" size={11}/> Adicionar item
            </button>
          </div>
          {newOrder.items.map((it, idx) => {
            const prod = ORION_DATA.products.find(p => p.id === it.productId);
            const updateItem = (patch) => setNewOrder(o => ({ ...o, items: o.items.map((x, i) => i === idx ? { ...x, ...patch } : x) }));
            const removeItem = () => setNewOrder(o => ({ ...o, items: o.items.filter((_, i) => i !== idx) }));
            return (
              <div key={idx} style={{ border: '1px solid var(--line-soft)', borderRadius: 10, padding: 12, marginBottom: 10, background: 'var(--surface)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span style={{ fontSize: 11, color: 'var(--ink-3)', fontWeight: 500 }}>Item {idx + 1}</span>
                  {newOrder.items.length > 1 && (
                    <button type="button" onClick={removeItem} style={{ background: 'none', border: 0, padding: 4, cursor: 'pointer', color: 'var(--ink-3)' }}>
                      <Icon name="x" size={13}/>
                    </button>
                  )}
                </div>
                <div className="field" style={{ marginBottom: 10 }}>
                  <Select value={it.productId} onChange={(v) => updateItem({ productId: v, color: '', size: '' })}
                    options={ORION_DATA.products.map(p => {
                      const spec = ORION_DATA.specs.find(s => s.id === p.spec);
                      const garment = spec && GARMENT_TYPES.find(g => g.id === spec.tipo);
                      return { value: p.id, label: p.name, sub: p.code, _product: p, _garment: garment };
                    })}
                    renderOption={(o) => (
                      <span style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }}>
                        <span style={{ width: 28, height: 28, borderRadius: 6, background: 'var(--surface-2)', border: '1px solid var(--line-soft)', display: 'grid', placeItems: 'center', color: 'var(--ink-2)', flexShrink: 0 }}>
                          {o._garment ? React.cloneElement(GARMENT_GLYPHS[o._garment.id], { width: 14, height: 14, strokeWidth: 1.5 }) : <Icon name="shirt" size={14}/>}
                        </span>
                        <span style={{ display: 'flex', flexDirection: 'column', minWidth: 0, gap: 3, flex: 1 }}>
                          <span style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 13 }}>{o.label}</span>
                            <span className="mono" style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5, color: 'var(--ink-3)' }}>{o.sub}</span>
                          </span>
                          <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ display: 'flex', gap: 3 }}>
                              {o._product.colors.map((c, i) => (
                                <span key={i} style={{ width: 10, height: 10, borderRadius: '50%', background: c.material, border: '1px solid var(--line-soft)', boxShadow: 'inset 0 0 0 1px rgba(0,0,0,.04)' }}/>
                              ))}
                            </span>
                            <span style={{ width: 1, height: 10, background: 'var(--line-soft)' }}/>
                            <span style={{ display: 'flex', gap: 3 }}>
                              {o._product.sizes.map(s => (
                                <span key={s} style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--ink-3)', padding: '1px 5px', border: '1px solid var(--line-soft)', borderRadius: 3, lineHeight: 1.2 }}>{s}</span>
                              ))}
                            </span>
                          </span>
                        </span>
                      </span>
                    )}/>
                </div>
                {prod && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 100px', gap: 10, alignItems: 'flex-end' }}>
                    <div>
                      <label style={{ fontSize: 10.5, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '.08em', fontWeight: 600, display: 'block', marginBottom: 6 }}>Cor</label>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {prod.colors.map((c, i) => {
                          const sel = it.color === c.material;
                          return (
                            <button key={i} type="button" title={`Estampa ${(c.prints||[]).map(colorName).join(', ')}`} onClick={() => updateItem({ color: c.material, print: c.prints[0] })}
                                    style={{ width: 24, height: 24, borderRadius: '50%', background: c.material, border: sel ? '2px solid var(--ink)' : '1px solid var(--line)',
                                      boxShadow: sel ? '0 0 0 2px var(--surface), 0 0 0 3px var(--ink)' : 'inset 0 0 0 1px rgba(0,0,0,.04)',
                                      cursor: 'pointer', padding: 0 }}/>
                          );
                        })}
                      </div>
                    </div>
                    <div>
                      <label style={{ fontSize: 10.5, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '.08em', fontWeight: 600, display: 'block', marginBottom: 6 }}>Tamanho</label>
                      <div style={{ display: 'flex', gap: 4 }}>
                        {prod.sizes.map(s => {
                          const sel = it.size === s;
                          return (
                            <button key={s} type="button" onClick={() => updateItem({ size: s })}
                                    style={{ minWidth: 28, padding: '4px 8px', fontSize: 11, fontFamily: 'var(--font-mono)',
                                      color: sel ? 'var(--surface)' : 'var(--ink-2)',
                                      background: sel ? 'var(--ink)' : 'var(--surface)',
                                      border: '1px solid ' + (sel ? 'var(--ink)' : 'var(--line)'),
                                      borderRadius: 4, cursor: 'pointer' }}>{s}</button>
                          );
                        })}
                      </div>
                    </div>
                    <div className="field" style={{ marginBottom: 0 }}>
                      <label>Qtd</label>
                      <NumField value={it.qty} onChange={(v) => updateItem({ qty: v })} step={1} min={1} decimals={0}/>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </Sheet>
    </div>
  );
};

const ORDER_PHASES = [
  { id: 'pendente', label: 'Recebido',   icon: 'inbox',          desc: 'Pedido criado' },
  { id: 'pago',     label: 'Pagamento',  icon: 'circle-dollar-sign', desc: 'Confirmado' },
  { id: 'producao', label: 'Produção',   icon: 'scissors',       desc: 'Cortado e enviado à banca' },
  { id: 'enviado',  label: 'Despacho',   icon: 'truck',          desc: 'A caminho do cliente' },
  { id: 'entregue', label: 'Entregue',   icon: 'package-check',  desc: 'Pedido finalizado' },
];

const phaseIndex = (status) => {
  const order = ['pendente','pago','producao','enviado','entregue'];
  return order.indexOf(status === 'pendente' ? 'pendente' : status);
};

const OrderDetail = ({ o, setRoute }) => {
  const [phase, setPhase] = React.useState(phaseIndex(o.status));
  const total = orderTotal(o);
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
        <StatusPill s={o.status}/>
        <span style={{ fontSize: 11.5, color: 'var(--ink-3)' }}>Realizado em {o.placedAt}</span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 18 }}>
        <div>
          <div style={{ fontSize: 11, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '.08em', fontWeight: 600, marginBottom: 4 }}>Cliente</div>
          <div onClick={() => setRoute('clients')} style={{ color: 'var(--ink)', fontWeight: 500, cursor: 'default', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            {o.client}
            <Icon name="external-link" size={11} style={{ color: 'var(--ink-3)' }}/>
          </div>
        </div>
        <div>
          <div style={{ fontSize: 11, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '.08em', fontWeight: 600, marginBottom: 4 }}>Código externo</div>
          <div className="mono" style={{ fontFamily: 'var(--font-mono)' }}>{o.ext}</div>
        </div>
      </div>

      {/* Itens — multiple, link to products */}
      <div style={{ borderTop: '1px solid var(--line-soft)', paddingTop: 14, marginBottom: 18 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <div style={{ fontSize: 11, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '.08em', fontWeight: 600 }}>Itens · {o.items.length}</div>
          <button className="btn btn-sm btn-ghost"><Icon name="plus" size={11}/> Adicionar item</button>
        </div>
        {o.items.map((it, i) => {
          const prod = ORION_DATA.products.find(p => p.id === it.productId);
          const spec = prod && ORION_DATA.specs.find(s => s.id === prod.spec);
          const garment = spec && GARMENT_TYPES.find(g => g.id === spec.tipo);
          const v = parseVariant(it.variant);
          return (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: i === o.items.length - 1 ? 0 : '1px solid var(--line-soft)' }}>
              <span style={{ width: 42, height: 42, borderRadius: 8, background: 'var(--surface-2)', border: '1px solid var(--line-soft)', display: 'grid', placeItems: 'center', color: 'var(--ink-2)', flexShrink: 0 }}>
                {garment ? React.cloneElement(GARMENT_GLYPHS[garment.id], { width: 20, height: 20, strokeWidth: 1.4 }) : <Icon name="shirt" size={20}/>}
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div onClick={() => setRoute('products')} style={{ color: 'var(--ink)', fontWeight: 500, cursor: 'default' }}>
                  {it.product}
                  <Icon name="external-link" size={11} style={{ marginLeft: 6, color: 'var(--ink-3)' }}/>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                    <span style={{ width: 10, height: 10, borderRadius: '50%', background: v.hex, border: '1px solid var(--line-soft)', boxShadow: 'inset 0 0 0 1px rgba(0,0,0,.04)' }}/>
                    <span style={{ fontSize: 11.5, color: 'var(--ink-2)' }}>{v.color}</span>
                  </span>
                  {v.size && <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--ink-3)', padding: '1px 5px', border: '1px solid var(--line-soft)', borderRadius: 3, lineHeight: 1.2 }}>{v.size}</span>}
                  <span style={{ fontSize: 11.5, color: 'var(--ink-3)' }}>· {fmtBRL(it.price)} cada</span>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ fontVariantNumeric: 'tabular-nums', color: 'var(--ink-3)', fontSize: 13 }}>×{it.qty}</span>
                <div className="num" style={{ fontWeight: 500, minWidth: 80, textAlign: 'right' }}>{fmtBRL(it.qty * it.price)}</div>
              </div>
            </div>
          );
        })}
        <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'baseline', gap: 12, paddingTop: 12 }}>
          <span style={{ fontSize: 11, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '.08em' }}>Total</span>
          <span style={{ fontFamily: 'var(--font-display)', fontSize: 22, color: 'var(--ink)', fontVariantNumeric: 'tabular-nums' }}>{fmtBRL(total)}</span>
        </div>
      </div>

      {/* Timeline — editable phase tracker */}
      <div style={{ borderTop: '1px solid var(--line-soft)', paddingTop: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div style={{ fontSize: 11, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '.08em', fontWeight: 600 }}>Linha do tempo</div>
          <span style={{ fontSize: 11, color: 'var(--ink-3)' }}>Clique para marcar a fase</span>
        </div>
        <OrderTimeline phase={phase} setPhase={setPhase}/>
      </div>
    </div>
  );
};

const OrderTimeline = ({ phase, setPhase }) => {
  const phaseDates = ['07/05 14:22', '07/05 09:14', '07/05 16:30', '08/05 11:00', '—'];
  return (
    <div className="ot">
      <div className="ot-rail">
        <div className="ot-rail-fill" style={{ width: `${(phase / (ORDER_PHASES.length - 1)) * 100}%` }}/>
      </div>
      <div className="ot-steps">
        {ORDER_PHASES.map((p, i) => {
          const done = i <= phase;
          const current = i === phase;
          return (
            <button key={p.id} className={`ot-step ${done ? 'done' : ''} ${current ? 'current' : ''}`} onClick={() => setPhase(i)}>
              <div className="ot-dot">
                <Icon name={done ? p.icon : p.icon} size={14} strokeWidth={done ? 2.4 : 1.75}/>
              </div>
              <div className="ot-meta">
                <div className="ot-label">{p.label}</div>
                <div className="ot-date">{done ? phaseDates[i] : 'pendente'}</div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};

const clientColor = (id) => ['#c2410c','#0f766e','#7e5bef','#1e40af','#b45309'][parseInt(id.slice(-1)) % 5];

const Clients = () => {
  const [open, setOpen] = React.useState(null);
  const [newOpen, setNewOpen] = React.useState(false);
  const [newC, setNewC] = React.useState({ name: '', city: '', firstChannel: 'shopee', email: '', phone: '' });
  const [search, setSearch] = React.useState('');
  const [filter, setFilter] = React.useState('all');
  const [sort, setSort] = React.useState({ col: 'name', dir: 'asc' });
  const cmp = makeCmp(sort, {
    name: c => c.name, city: c => c.city, channel: c => c.firstChannel,
    orders: c => c.orders, lifetime: c => c.lifetime,
  });
  const rows = ORION_DATA.clients.filter(c => {
    if (filter === 'vip' && !c.tags.includes('VIP')) return false;
    if (filter === 'recurring' && c.orders < 2) return false;
    if (search) { const q = search.toLowerCase(); if (!c.name.toLowerCase().includes(q) && !c.city.toLowerCase().includes(q)) return false; }
    return true;
  }).slice().sort(cmp);
  return (
    <div className="page">
      <PageHead sub="clients" title="Clientes" desc="Diretório de clientes de todos os canais."
                actions={<button className="btn btn-primary" onClick={() => setNewOpen(true)}><Icon name="users" size={14}/> Novo cliente</button>}/>
      <HelpCard id="clients" icon="users" tone="var(--brand-sales)" title="Clientes — uma ficha por pessoa, somando todos os canais">
        <HelpBody>
          Cada pedido, de qualquer canal, é ligado a um <b>cliente</b>. A ficha reúne <b>contato</b>, histórico de compras e o <b>total gerado</b> (LTV) — marque <b>VIPs</b> e recorrentes para atender melhor.
        </HelpBody>
        <Flow accent="var(--brand-sales)" steps={[
          { icon: 'shopping-bag', label: 'Pedidos', sub: 'todos os canais' },
          { icon: 'user', label: 'Cliente', sub: 'contato & perfil', tone: 'accent' },
          { icon: 'heart', label: 'Histórico & LTV', sub: 'VIP · recorrente', tone: 'ok' },
        ]}/>
      </HelpCard>
      <div className="card">
        <TableToolbar>
          <SearchInput placeholder="Procurar cliente…" value={search} onChange={setSearch}/>
          <Seg value={filter} onChange={setFilter} options={[
            { value: 'all', label: 'Todos' },
            { value: 'vip', label: 'VIP' },
            { value: 'recurring', label: 'Recorrentes' },
          ]}/>
        </TableToolbar>
        <table className="tbl">
          <thead><tr>
            <SortHeader id="name" sort={sort} setSort={setSort}>Cliente</SortHeader>
            <SortHeader id="city" sort={sort} setSort={setSort}>Cidade</SortHeader>
            <SortHeader id="channel" sort={sort} setSort={setSort}>Primeiro canal</SortHeader>
            <SortHeader id="orders" sort={sort} setSort={setSort} num>Pedidos</SortHeader>
            <SortHeader id="lifetime" sort={sort} setSort={setSort} num>Total gasto</SortHeader>
            <th>Tags</th><th style={{ width: 36 }}/>
          </tr></thead>
          <tbody>
            {rows.map(c => (
              <tr key={c.id} onClick={() => setOpen(c)}>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <Av name={c.name} color={clientColor(c.id)}/>
                    <span style={{ color: 'var(--ink)', fontWeight: 500 }}>{c.name}</span>
                  </div>
                </td>
                <td>{c.city}</td>
                <td><ChannelChip id={c.firstChannel}/></td>
                <td className="num">{c.orders}</td>
                <td className="num" style={{ color: 'var(--ink)', fontWeight: 500 }}>{fmtBRL(c.lifetime)}</td>
                <td>
                  <div className="chip-row">
                    {c.tags.length ? c.tags.map(t => <span key={t} className="pill">{t}</span>) : <span style={{ color: 'var(--ink-3)', fontSize: 12 }}>—</span>}
                  </div>
                </td>
                <td><Icon name="chevron-right" size={14} style={{ color: 'var(--ink-3)' }}/></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Sheet open={!!open} onClose={() => setOpen(null)}
             title={open ? open.name : ''}
             sub={open ? <span style={{ color: 'var(--ink-3)', fontSize: 12 }}>{open.city}</span> : null}
             footer={<>
               <button className="btn btn-ghost" style={{ color: 'var(--err)', marginRight: 'auto' }}><Icon name="trash-2" size={13}/> Excluir cliente</button>
               <button className="btn" onClick={() => setOpen(null)}>Fechar</button>
               <button className="btn btn-primary"><Icon name="message-circle" size={13}/> Contatar</button>
             </>}>
        {open && <ClientDetail c={open}/>}
      </Sheet>

      <Sheet open={newOpen} onClose={() => setNewOpen(false)} title="Novo cliente"
             footer={<>
               <button className="btn" onClick={() => setNewOpen(false)}>Cancelar</button>
               <button className="btn btn-primary" onClick={() => setNewOpen(false)}><Icon name="check" size={13}/> Criar cliente</button>
             </>}>
        <div style={{ marginBottom: 22 }}>
          <div style={{ fontSize: 11, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '.08em', fontWeight: 600, marginBottom: 10, paddingBottom: 8, borderBottom: '1px solid var(--line-soft)' }}>Identificação</div>
          <div className="field"><label>Nome</label><input value={newC.name} onChange={e => setNewC({ ...newC, name: e.target.value })} placeholder="Nome completo"/></div>
          <div className="field"><label>Cidade</label><input value={newC.city} onChange={e => setNewC({ ...newC, city: e.target.value })} placeholder="Ex: São Paulo, SP"/></div>
        </div>
        <div style={{ marginBottom: 22 }}>
          <div style={{ fontSize: 11, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '.08em', fontWeight: 600, marginBottom: 10, paddingBottom: 8, borderBottom: '1px solid var(--line-soft)' }}>Primeiro canal</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 6 }}>
            {Object.keys(ORION_DATA.channels).map(k => {
              const c = ORION_DATA.channels[k]; const sel = newC.firstChannel === k;
              return (
                <button key={k} onClick={() => setNewC({ ...newC, firstChannel: k })} type="button"
                        style={{ padding: '10px 6px', display:'flex', flexDirection: 'column', gap: 6, alignItems:'center',
                          border: sel ? `1.5px solid ${c.color}` : '1px solid var(--line)', borderRadius: 8, cursor: 'pointer',
                          background: sel ? `color-mix(in oklab, ${c.color} 12%, var(--surface))` : 'var(--surface)', fontFamily: 'inherit' }}>
                  <span style={{ width: 24, height: 24, borderRadius: 6, background: c.color, color: c.fg || '#fff', display: 'grid', placeItems: 'center', fontSize: 10, fontWeight: 700 }}>{c.short}</span>
                  <span style={{ fontSize: 11, color: sel ? 'var(--ink)' : 'var(--ink-2)' }}>{c.name}</span>
                </button>
              );
            })}
          </div>
        </div>
        <div style={{ marginBottom: 22 }}>
          <div style={{ fontSize: 11, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '.08em', fontWeight: 600, marginBottom: 10, paddingBottom: 8, borderBottom: '1px solid var(--line-soft)' }}>Contato</div>
          <div className="field"><label>E-mail</label><input value={newC.email} onChange={e => setNewC({ ...newC, email: e.target.value })} placeholder="email@exemplo.com"/></div>
          <div className="field"><label>Telefone</label><input value={newC.phone} onChange={e => setNewC({ ...newC, phone: e.target.value })} placeholder="(11) 99999-0000"/></div>
        </div>
      </Sheet>
    </div>
  );
};

const ClientDetail = ({ c }) => {
  const orders = ORION_DATA.orders.filter(o => o.client === c.name);
  const aov = c.orders ? c.lifetime / c.orders : 0;
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 18 }}>
        <Av name={c.name} color={clientColor(c.id)} size={56}/>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
            {c.tags.length ? c.tags.map(t => <span key={t} className="pill">{t}</span>) : <span className="pill muted">sem tags</span>}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--ink-3)' }}>
            <Icon name="map-pin" size={11}/> {c.city}
            <span style={{ color: 'var(--line)' }}>·</span>
            <Icon name="hash" size={11}/> <span className="mono" style={{ fontFamily: 'var(--font-mono)' }}>{c.id}</span>
          </div>
        </div>
      </div>

      {/* Stat strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 1, background: 'var(--line-soft)', border: '1px solid var(--line-soft)', borderRadius: 10, overflow: 'hidden', marginBottom: 18 }}>
        {[
          { label: 'Pedidos', value: c.orders, icon: 'shopping-bag' },
          { label: 'Total gasto', value: fmtBRL(c.lifetime), icon: 'circle-dollar-sign' },
          { label: 'Ticket médio', value: fmtBRL(aov), icon: 'trending-up' },
        ].map(s => (
          <div key={s.label} style={{ background: 'var(--surface)', padding: '12px 14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10.5, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '.08em', fontWeight: 600 }}>
              <Icon name={s.icon} size={11}/> {s.label}
            </div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 22, color: 'var(--ink)', marginTop: 4, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Contact */}
      <div style={{ borderTop: '1px solid var(--line-soft)', paddingTop: 14, marginBottom: 18 }}>
        <div style={{ fontSize: 11, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '.08em', fontWeight: 600, marginBottom: 10 }}>Contato</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          {[
            { icon: 'mail',  label: 'Email',     value: c.name.toLowerCase().replace(' ', '.') + '@email.com' },
            { icon: 'phone', label: 'Telefone',  value: '+55 11 9' + (8000 + parseInt(c.id.slice(-1)) * 137).toString().slice(0,4) + '-' + (1234 + parseInt(c.id.slice(-1)) * 89).toString().slice(0,4) },
            { icon: 'instagram', label: 'Instagram', value: '@' + c.name.toLowerCase().split(' ')[0] },
            { icon: 'globe', label: 'Canal preferido', value: ORION_DATA.channels[c.firstChannel].name },
          ].map(f => (
            <div key={f.label} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 10, background: 'var(--surface-2)', borderRadius: 8 }}>
              <div style={{ width: 28, height: 28, borderRadius: 6, background: 'var(--surface)', display: 'grid', placeItems: 'center', color: 'var(--ink-3)' }}><Icon name={f.icon} size={13}/></div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 10.5, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '.06em' }}>{f.label}</div>
                <div style={{ fontSize: 12.5, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.value}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Order history */}
      <div style={{ borderTop: '1px solid var(--line-soft)', paddingTop: 14 }}>
        <div style={{ fontSize: 11, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '.08em', fontWeight: 600, marginBottom: 8 }}>Pedidos recentes</div>
        {orders.length ? orders.map(o => (
          <div key={o.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: '1px solid var(--line-soft)' }}>
            <div style={{ display: 'flex' }}>
              {o.items.slice(0, 2).map((it, i) => (
                <span key={i} style={{ marginLeft: i ? -8 : 0, border: '2px solid var(--surface)', borderRadius: 6 }}>
                  <FabricThumb tone={it.thumb} size={28}/>
                </span>
              ))}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 500, color: 'var(--ink)', fontSize: 13 }}>#{o.id} <span style={{ color: 'var(--ink-3)', fontWeight: 400 }}>· {o.items.length} {o.items.length === 1 ? 'item' : 'itens'}</span></div>
              <div style={{ fontSize: 11, color: 'var(--ink-3)' }}>{o.placedAt}</div>
            </div>
            <ChannelChip id={o.channel}/>
            <StatusPill s={o.status}/>
            <div className="num" style={{ minWidth: 80, fontWeight: 500, color: 'var(--ink)' }}>{fmtBRL(orderTotal(o))}</div>
          </div>
        )) : <div style={{ fontSize: 12, color: 'var(--ink-3)', padding: '8px 0' }}>Nenhum pedido registrado.</div>}
      </div>
    </div>
  );
};

// Resolve a product (by name) to its spec + garment glyph metadata
const resolveAdProduct = (name) => {
  const prod = ORION_DATA.products.find(p => p.name === name);
  const spec = prod && ORION_DATA.specs.find(s => s.id === prod.spec);
  const garment = spec && GARMENT_TYPES.find(g => g.id === spec.tipo);
  return { prod, spec, garment };
};

const Ads = () => {
  const [open, setOpen] = React.useState(null);
  const [newOpen, setNewOpen] = React.useState(false);
  const [form, setForm] = React.useState({ channels: ['shopee'], title: '', products: ['Cropped Oversized'], url: '', thumb: null });
  const [prodQuery, setProdQuery] = React.useState('');
  const [search, setSearch] = React.useState('');
  const [filter, setFilter] = React.useState('all');
  const [sort, setSort] = React.useState({ col: 'title', dir: 'asc' });
  const cmp = makeCmp(sort, {
    id: a => a.id, title: a => a.title, channel: a => a.channel,
    product: a => (a.products[0] || ''), status: a => a.status, orders30d: a => a.orders30d,
  });
  const ads = ORION_DATA.ads.filter(a => {
    if (filter !== 'all' && a.status !== filter) return false;
    if (search) { const q = search.toLowerCase(); if (!a.title.toLowerCase().includes(q) && !a.products.some(p => p.toLowerCase().includes(q)) && !a.id.toLowerCase().includes(q)) return false; }
    return true;
  }).slice().sort(cmp);
  return (
    <div className="page">
      <PageHead sub="ads" title="Anúncios" titleEm="por canal"
                desc="Suas listagens em ecommerces e redes sociais."
                actions={<button className="btn btn-primary" onClick={() => setNewOpen(true)}><Icon name="megaphone" size={14}/> Novo anúncio</button>}/>
      <HelpCard id="ads" icon="megaphone" tone="var(--brand-sales)" title="Anúncios — sua vitrine em cada canal">
        <HelpBody>
          Um <b>anúncio</b> é sua vitrine num canal (Shopee, ML, Instagram…) e pode reunir <b>um ou vários produtos</b> do catálogo — um combo, um kit ou uma listagem multivariação. Quando chega um pedido, o Orion usa o anúncio para descobrir <b>qual produto e variação</b> preparar.
        </HelpBody>
        <Flow accent="var(--brand-sales)" steps={[
          { icon: 'shirt', label: 'Produtos', sub: 'um ou vários' },
          { icon: 'megaphone', label: 'Anúncio', sub: 'por canal', tone: 'accent' },
          { icon: 'shopping-bag', label: 'Pedido entra', sub: 'vira venda', tone: 'ok' },
        ]}/>
      </HelpCard>
      <div className="card">
        <TableToolbar>
          <SearchInput placeholder="Procurar anúncio…" value={search} onChange={setSearch}/>
          <Seg value={filter} onChange={setFilter} options={[
            { value: 'all', label: 'Todos' },
            { value: 'ativo', label: 'Ativos' },
            { value: 'pausado', label: 'Pausados' },
          ]}/>
        </TableToolbar>
        <table className="tbl">
          <thead><tr>
            <th style={{width:38}}/>
            <SortHeader id="id" sort={sort} setSort={setSort}>Código</SortHeader>
            <SortHeader id="title" sort={sort} setSort={setSort}>Título</SortHeader>
            <SortHeader id="channel" sort={sort} setSort={setSort}>Canal</SortHeader>
            <SortHeader id="product" sort={sort} setSort={setSort}>Produtos</SortHeader>
            <SortHeader id="status" sort={sort} setSort={setSort}>Status</SortHeader>
            <SortHeader id="orders30d" sort={sort} setSort={setSort} num>Pedidos 30d</SortHeader>
            <th style={{width:36}}/>
          </tr></thead>
          <tbody>{ads.map(a => {
            const ch = ORION_DATA.channels[a.channel];
            const { garment } = resolveAdProduct(a.products[0]);
            return (
              <tr key={a.id} onClick={() => setOpen(a)}>
                <td><span style={{ display:'grid', placeItems:'center', width: 28, height: 28, borderRadius: 6, background: `linear-gradient(135deg, ${ch.color}, ${ch.color}aa)`, color: 'rgba(255,255,255,.95)' }}>{garment ? React.cloneElement(GARMENT_GLYPHS[garment.id], { width: 14, height: 14, strokeWidth: 1.5 }) : <Icon name="shirt" size={14}/>}</span></td>
                <td className="mono">{a.id}</td>
                <td style={{color:'var(--ink)',fontWeight:500}}>{a.title}</td>
                <td><ChannelChip id={a.channel}/></td>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ display: 'flex' }}>
                      {a.products.slice(0, 3).map((name, i) => {
                        const g = resolveAdProduct(name).garment;
                        return (
                          <span key={i} style={{ marginLeft: i === 0 ? 0 : -8, zIndex: 3 - i, width: 26, height: 26, borderRadius: 6,
                            background: 'var(--surface-2)', border: '2px solid var(--surface)', display: 'grid', placeItems: 'center', color: 'var(--ink-2)' }}>
                            {g ? React.cloneElement(GARMENT_GLYPHS[g.id], { width: 13, height: 13, strokeWidth: 1.5 }) : <Icon name="shirt" size={13}/>}
                          </span>
                        );
                      })}
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ color: 'var(--ink)', fontWeight: 500, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.products[0]}</div>
                      {a.products.length > 1 && (
                        <div style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 2 }}>+ {a.products.length - 1} {a.products.length === 2 ? 'produto' : 'produtos'}</div>
                      )}
                    </div>
                  </div>
                </td>
                <td><StatusPill s={a.status}/></td>
                <td className="num" style={{ fontWeight: 500 }}>{a.orders30d}</td>
                <td><Icon name="chevron-right" size={14} style={{ color: 'var(--ink-3)' }}/></td>
              </tr>
            );
          })}</tbody>
        </table>
      </div>

      <Sheet open={!!open} onClose={() => setOpen(null)}
             title={open ? open.title : ''}
             sub={open ? <ChannelChip id={open.channel}/> : null}
             footer={<>
               <button className="btn btn-ghost" style={{ color: 'var(--err)', marginRight: 'auto' }}><Icon name="trash-2" size={13}/> Excluir anúncio</button>
               <button className="btn" onClick={() => setOpen(null)}>Fechar</button>
               {open && open.status === 'ativo'
                 ? <button className="btn"><Icon name="pause" size={13}/> Pausar anúncio</button>
                 : <button className="btn btn-primary"><Icon name="play" size={13}/> Ativar anúncio</button>}
             </>}>
        {open && <AdDetail a={open}/>}
      </Sheet>

      <Sheet open={newOpen} onClose={() => { setNewOpen(false); setProdQuery(''); }} title="Novo anúncio"
             footer={<>
               <button className="btn" onClick={() => setNewOpen(false)}>Cancelar</button>
               <button className="btn btn-primary" onClick={() => setNewOpen(false)}><Icon name="check" size={13}/> Criar anúncio</button>
             </>}>
        <div style={{ marginBottom: 22 }}>
          <div style={{ fontSize: 11, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '.08em', fontWeight: 600, marginBottom: 10, paddingBottom: 8, borderBottom: '1px solid var(--line-soft)' }}>Canal</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 6 }}>
            {Object.keys(ORION_DATA.channels).map(k => {
              const c = ORION_DATA.channels[k];
              const sel = form.channels.includes(k);
              return (
                <button key={k}
                        onClick={() => setForm(f => ({ ...f, channels: sel ? f.channels.filter(x => x !== k) : [...f.channels, k] }))}
                        type="button"
                        style={{
                          position: 'relative',
                          height: 76, padding: '8px 6px',
                          display:'flex', flexDirection: 'column', gap: 6, alignItems:'center', justifyContent: 'center',
                          border: sel ? `1.5px solid ${c.color}` : '1px solid var(--line)',
                          borderRadius: 8, cursor: 'pointer',
                          background: sel ? `color-mix(in oklab, ${c.color} 12%, var(--surface))` : 'var(--surface)',
                          fontFamily: 'inherit',
                        }}>
                  {sel && (
                    <span style={{ position: 'absolute', top: 4, right: 4, width: 14, height: 14, borderRadius: '50%', background: c.color, color: c.fg || '#fff', display: 'grid', placeItems: 'center' }}>
                      <Icon name="check" size={9} strokeWidth={3}/>
                    </span>
                  )}
                  <span style={{ width: 24, height: 24, borderRadius: 6, background: c.color, color: c.fg || '#fff', display: 'grid', placeItems: 'center', fontSize: 10, fontWeight: 700 }}>{c.short}</span>
                  <span style={{ fontSize: 10.5, lineHeight: 1.15, color: sel ? 'var(--ink)' : 'var(--ink-2)', textAlign: 'center', whiteSpace: 'nowrap', maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.name}</span>
                </button>
              );
            })}
          </div>
        </div>
        <div style={{ marginBottom: 22 }}>
          <div style={{ fontSize: 11, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '.08em', fontWeight: 600, marginBottom: 10, paddingBottom: 8, borderBottom: '1px solid var(--line-soft)' }}>Detalhes</div>
          <div className="field">
            <label>Título do anúncio</label>
            <input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="Ex: Cropped Oversized — Verão 2026"/>
          </div>
          <ThumbUpload value={form.thumb} onChange={img => setForm(f => ({ ...f, thumb: img }))} label="Miniatura do anúncio" aspect="1 / 1" hint="quadrada recomendada · até 5 MB"/>
        </div>
        <div style={{ marginBottom: 22 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4, paddingBottom: 8, borderBottom: '1px solid var(--line-soft)' }}>
            <span style={{ fontSize: 11, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '.08em', fontWeight: 600 }}>Produtos vinculados</span>
            <span style={{ fontSize: 11, color: 'var(--ink-3)' }}>{form.products.length} selecionado{form.products.length === 1 ? '' : 's'}</span>
          </div>
          <div style={{ fontSize: 11.5, color: 'var(--ink-3)', margin: '10px 0 12px' }}>Um anúncio pode vincular vários produtos do catálogo — útil para combos, kits e listagens multivariação.</div>
          <div style={{ marginBottom: 10 }}>
            <SearchInput placeholder="Buscar produto por nome ou código…" value={prodQuery} onChange={setProdQuery}/>
          </div>
          {(() => {
            const q = prodQuery.trim().toLowerCase();
            const visible = ORION_DATA.products.filter(p => !q || (p.name + ' ' + p.code).toLowerCase().includes(q));
            if (!visible.length) return (
              <div style={{ padding: '24px 12px', textAlign: 'center', border: '1px dashed var(--line)', borderRadius: 8 }}>
                <Icon name="search-x" size={18} style={{ color: 'var(--ink-3)' }}/>
                <div style={{ fontSize: 12.5, color: 'var(--ink-3)', marginTop: 6 }}>Nenhum produto para “{prodQuery}”.</div>
              </div>
            );
            return (
            <div style={{ display: 'grid', gap: 6, maxHeight: 300, overflowY: 'auto', margin: '0 -2px', padding: '0 2px' }}>
            {visible.map(p => {
              const { garment } = resolveAdProduct(p.name);
              const sel = form.products.includes(p.name);
              return (
                <button key={p.id} type="button"
                  onClick={() => setForm(f => ({ ...f, products: sel ? f.products.filter(x => x !== p.name) : [...f.products, p.name] }))}
                  style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', textAlign: 'left',
                    border: sel ? '1.5px solid var(--accent)' : '1px solid var(--line)', borderRadius: 8, cursor: 'pointer',
                    background: sel ? 'color-mix(in oklab, var(--accent) 8%, var(--surface))' : 'var(--surface)', fontFamily: 'inherit' }}>
                  <span style={{ width: 30, height: 30, borderRadius: 6, background: 'var(--surface-2)', border: '1px solid var(--line-soft)', display: 'grid', placeItems: 'center', color: 'var(--ink-2)', flexShrink: 0 }}>
                    {garment ? React.cloneElement(GARMENT_GLYPHS[garment.id], { width: 15, height: 15, strokeWidth: 1.5 }) : <Icon name="shirt" size={15}/>}
                  </span>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: 'block', fontSize: 13, color: 'var(--ink)', fontWeight: 500 }}>{p.name}</span>
                    <span className="mono" style={{ display: 'block', fontSize: 10.5, fontFamily: 'var(--font-mono)', color: 'var(--ink-3)' }}>{p.code}</span>
                  </span>
                  <span style={{ display: 'flex', gap: 2 }}>
                    {p.colors.slice(0, 4).map((c, i) => (
                      <span key={i} style={{ width: 9, height: 9, borderRadius: '50%', background: c.material, border: '1px solid var(--line-soft)' }}/>
                    ))}
                  </span>
                  <span style={{ width: 18, height: 18, borderRadius: '50%', border: sel ? 0 : '1.5px solid var(--line)', background: sel ? 'var(--accent)' : 'transparent', display: 'grid', placeItems: 'center', flexShrink: 0, marginLeft: 4 }}>
                    {sel && <Icon name="check" size={11} strokeWidth={3} style={{ color: '#fff' }}/>}
                  </span>
                </button>
              );
            })}
            </div>
            );
          })()}
        </div>
      </Sheet>
    </div>
  );
};

const AdDetail = ({ a }) => {
  const ch = ORION_DATA.channels[a.channel];
  const channelIcon = { shopee: 'shopping-bag', ml: 'package', shopify: 'store', instagram: 'instagram', whatsapp: 'message-circle' }[a.channel] || 'tag';
  // Sparkline-ish data
  const series = [4,7,5,9,6,11,8,12,10,14,9,13,15,11,17,13,19,16,14,21,18,16,22,20,17,24,19,22,25,a.orders30d];
  const max = Math.max(...series);
  const revenue = a.orders30d * 149;
  const conv = (a.orders30d / 412 * 100).toFixed(1);
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
        <StatusPill s={a.status}/>
        <span style={{ fontSize: 12, color: 'var(--ink-3)' }}>{a.products.length} {a.products.length === 1 ? 'produto vinculado' : 'produtos vinculados'}</span>
      </div>

      {/* Hero card with channel color */}
      <div style={{
        background: `linear-gradient(135deg, ${ch.color} 0%, ${ch.color}cc 100%)`,
        borderRadius: 12, padding: 20, marginBottom: 18, color: '#fff',
        display: 'flex', alignItems: 'center', gap: 16,
      }}>
        <div style={{ width: 56, height: 56, borderRadius: 10, background: 'rgba(255,255,255,.18)', display: 'grid', placeItems: 'center', backdropFilter: 'blur(8px)' }}>
          <Icon name={channelIcon} size={28}/>
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 11, opacity: .8, textTransform: 'uppercase', letterSpacing: '.1em', fontWeight: 600 }}>{ch.name}</div>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 22, marginTop: 2 }}>{a.title}</div>
        </div>
        <button className="btn btn-sm" style={{ background: 'rgba(255,255,255,.18)', color: '#fff', border: '1px solid rgba(255,255,255,.3)' }}>
          <Icon name="external-link" size={11}/> Abrir no canal
        </button>
      </div>

      {/* Linked products — an ad can map to one or many catalog products */}
      <div style={{ borderTop: '1px solid var(--line-soft)', paddingTop: 14, marginBottom: 18 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <div style={{ fontSize: 11, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '.08em', fontWeight: 600 }}>Produtos vinculados · {a.products.length}</div>
          <button className="btn btn-sm btn-ghost"><Icon name="plus" size={11}/> Vincular produto</button>
        </div>
        {a.products.map((name, i) => {
          const { prod, garment } = resolveAdProduct(name);
          return (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: i === a.products.length - 1 ? 0 : '1px solid var(--line-soft)' }}>
              <span style={{ width: 42, height: 42, borderRadius: 8, background: 'var(--surface-2)', border: '1px solid var(--line-soft)', display: 'grid', placeItems: 'center', color: 'var(--ink-2)', flexShrink: 0 }}>
                {garment ? React.cloneElement(GARMENT_GLYPHS[garment.id], { width: 20, height: 20, strokeWidth: 1.4 }) : <Icon name="shirt" size={20}/>}
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ color: 'var(--ink)', fontWeight: 500 }}>
                  {name}
                  <Icon name="external-link" size={11} style={{ marginLeft: 6, color: 'var(--ink-3)' }}/>
                </div>
                {prod && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 5, flexWrap: 'wrap' }}>
                    <span className="mono" style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5, color: 'var(--ink-3)' }}>{prod.code}</span>
                    <span style={{ display: 'flex', gap: 3 }}>
                      {prod.colors.map((c, ci) => (
                        <span key={ci} style={{ width: 11, height: 11, borderRadius: '50%', background: c.material, border: '1px solid var(--line-soft)', boxShadow: 'inset 0 0 0 1px rgba(0,0,0,.04)' }}/>
                      ))}
                    </span>
                    <span style={{ width: 1, height: 11, background: 'var(--line-soft)' }}/>
                    <span style={{ display: 'flex', gap: 3 }}>
                      {prod.sizes.map(s => (
                        <span key={s} style={{ fontSize: 9.5, fontFamily: 'var(--font-mono)', color: 'var(--ink-3)', padding: '1px 5px', border: '1px solid var(--line-soft)', borderRadius: 3, lineHeight: 1.2 }}>{s}</span>
                      ))}
                    </span>
                  </div>
                )}
              </div>
              <span style={{ fontSize: 11.5, color: 'var(--ink-3)', whiteSpace: 'nowrap' }}>{prod ? `${prod.stock} em estoque` : ''}</span>
            </div>
          );
        })}
      </div>

      {/* Performance chart */}
      <div style={{ borderTop: '1px solid var(--line-soft)', paddingTop: 14, marginBottom: 18 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 12 }}>
          <div>
            <div style={{ fontSize: 11, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '.08em', fontWeight: 600 }}>Pedidos · últimos 30 dias</div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 32, color: 'var(--ink)', marginTop: 4, fontVariantNumeric: 'tabular-nums' }}>{a.orders30d}</div>
          </div>
          <Seg value="30d" onChange={()=>{}} options={[
            { value: '7d', label: '7d' }, { value: '30d', label: '30d' }, { value: '90d', label: '90d' },
          ]}/>
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 64 }}>
          {series.map((v, i) => (
            <div key={i} style={{
              flex: 1,
              height: `${(v / max) * 100}%`,
              background: i === series.length - 1 ? ch.color : `color-mix(in oklab, ${ch.color} 40%, var(--surface-2))`,
              borderRadius: 2,
              minHeight: 2,
            }}/>
          ))}
        </div>
      </div>

      {/* Stat grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 1, background: 'var(--line-soft)', border: '1px solid var(--line-soft)', borderRadius: 10, overflow: 'hidden', marginBottom: 18 }}>
        {[
          { label: 'Receita 30d', value: fmtBRL(revenue), icon: 'circle-dollar-sign' },
          { label: 'Visitas', value: '4.2k', icon: 'eye' },
          { label: 'Conversão', value: `${conv}%`, icon: 'trending-up' },
        ].map(s => (
          <div key={s.label} style={{ background: 'var(--surface)', padding: '12px 14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10.5, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '.08em', fontWeight: 600 }}>
              <Icon name={s.icon} size={11}/> {s.label}
            </div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 22, color: 'var(--ink)', marginTop: 4, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Configuration */}
      <div style={{ borderTop: '1px solid var(--line-soft)', paddingTop: 14, marginBottom: 18 }}>
        <div style={{ fontSize: 11, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '.08em', fontWeight: 600, marginBottom: 10 }}>Configuração</div>
        <div style={{ display: 'grid', gap: 8 }}>
          {[
            { label: 'Preço', value: 'R$ 149,00', icon: 'tag' },
            { label: 'Estoque sincronizado', value: 'Sim', icon: 'refresh-cw' },
            { label: 'Envio', value: 'Frete grátis acima de R$ 199', icon: 'truck' },
            { label: 'Última sincronização', value: 'há 4 minutos', icon: 'clock' },
          ].map(f => (
            <div key={f.label} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', background: 'var(--surface-2)', borderRadius: 8 }}>
              <Icon name={f.icon} size={13} style={{ color: 'var(--ink-3)' }}/>
              <span style={{ fontSize: 12.5, color: 'var(--ink-2)', flex: 1 }}>{f.label}</span>
              <span style={{ fontSize: 12.5, color: 'var(--ink)', fontWeight: 500 }}>{f.value}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

Object.assign(window, { Orders, Clients, Ads });
