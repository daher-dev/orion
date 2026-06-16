// stock-store.js — reactive stock ledger.
// Mutates ORION_DATA arrays IN PLACE and notifies subscribers, so any screen that
// reads ORION_DATA + calls useStock() re-renders when a stock changes. This is the
// connective tissue that lets actions in one feature (Costura, Lotes, Montagem)
// cascade into the five inventory tiers.

(function () {
  const D = window.ORION_DATA;
  const subs = new Set();
  let version = 0;

  // global toast pub/sub (decoupled from any single page)
  const toastSubs = new Set();
  let toastMsg = null, toastTimer = null;

  const notify = () => { version++; subs.forEach(fn => fn(version)); };
  const stamp = () => { const d = new Date(), p = n => String(n).padStart(2, '0'); return `${p(d.getDate())}/${p(d.getMonth() + 1)} ${p(d.getHours())}:${p(d.getMinutes())}`; };
  const fmtM = (n) => (Math.round(n * 10) / 10).toLocaleString('pt-BR');

  function toast(msg) {
    toastMsg = msg; toastSubs.forEach(fn => fn(msg));
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { toastMsg = null; toastSubs.forEach(fn => fn(null)); }, 3400);
  }

  // color name → short code for generated SKUs
  const COLOR_CODE = { 'Preto': 'PRT', 'Branco': 'BCO', 'Off-white': 'OFF', 'Cru': 'CRU', 'Areia': 'ARE', 'Bege': 'BEG', 'Marrom': 'MAR', 'Verde': 'VRD', 'Verde escuro': 'VRD', 'Verde-musgo': 'MSG' };
  const baseCode = (base) => {
    const map = { 'Camiseta': 'CAM', 'Cropped': 'CRP', 'Moletom Canguru': 'MOL', 'Moletom': 'MOL', 'Ecobag': 'ECO', 'Bolsa': 'ECO' };
    return map[base] || base.slice(0, 3).toUpperCase();
  };

  const Store = {
    version: () => version,
    subscribe(fn) { subs.add(fn); return () => subs.delete(fn); },
    subscribeToast(fn) { toastSubs.add(fn); return () => toastSubs.delete(fn); },
    getToast: () => toastMsg,
    toast,
    colorCode: (n) => COLOR_CODE[n] || (n || 'X').slice(0, 3).toUpperCase(),
    skuFor: (blank, printedCode) => `${baseCode(blank.base)}-${printedCode}-${COLOR_CODE[blank.color] || 'XXX'}-${blank.size}`,

    // ── silent primitive ledger writes (composites call these, then notify once) ──
    _blank(id, delta, reason) { const r = D.blankPieces.find(x => x.id === id); if (r) { r.count += delta; D.blankMovements.unshift({ date: stamp(), id, reason, qty: delta }); } return r; },
    _printed(id, delta, reason) { const r = D.printed.find(x => x.id === id); if (r) { r.count += delta; D.printedMovements.unshift({ date: stamp(), id, reason, qty: delta }); } return r; },
    _paper(id, deltaM, reason) { const r = D.paperRolls.find(x => x.id === id); if (r) { r.current = Math.max(0, Math.round((r.current + deltaM) * 10) / 10); D.paperMovements.unshift({ date: stamp(), id, reason, qty: deltaM }); } return r; },
    _product(sku, delta, reason) { const r = D.stock.find(x => x.sku === sku); if (r) { r.count += delta; D.movements.unshift({ date: stamp(), sku, reason, qty: delta }); } return r; },

    // ── public single adjusts (notify + toast) ──
    adjustBlank(id, delta, reason, label) { const r = this._blank(id, delta, reason); if (r) toast(`${delta > 0 ? '+' : ''}${delta} peça${Math.abs(delta) === 1 ? '' : 's'} lisa · ${label || r.base}`); notify(); },
    adjustPrinted(id, delta, reason, label) { const r = this._printed(id, delta, reason); if (r) toast(`${delta > 0 ? '+' : ''}${delta} impresso${Math.abs(delta) === 1 ? '' : 's'} · ${label || r.code}`); notify(); },
    adjustPaper(id, deltaM, reason) { const r = this._paper(id, deltaM, reason); if (r) toast(`${deltaM > 0 ? '+' : ''}${deltaM} m · ${r.type} ${id}`); notify(); },
    adjustProduct(sku, delta, reason, label) { const r = this._product(sku, delta, reason); if (r) toast(`${delta > 0 ? '+' : ''}${delta} · ${label || r.product}`); notify(); },

    addPaperRoll(roll) { D.paperRolls.unshift(roll); D.paperMovements.unshift({ date: stamp(), id: roll.id, reason: 'Entrada · Compra', qty: roll.initial }); toast(`Bobina ${roll.id} recebida · +${roll.initial} m`); notify(); },

    // ── transformations (the convergent pipeline) ──
    receiveRemessa(sw) {
      if (!sw || !sw.lisas || sw.status === 'recebido') return;
      let total = 0;
      sw.lisas.forEach(t => { this._blank(t.id, t.qty, `Entrada · Remessa ${sw.id}`); total += t.qty; });
      sw.status = 'recebido';
      toast(`Remessa ${sw.id} recebida · +${total} peças lisas`);
      notify();
    },

    // Receber costura (parcial): credita no estoque de lisas só o DELTA de cada
    // linha que ainda não entrou (received − credited). Pode ser chamado várias
    // vezes conforme a banca devolve em lotes — exatamente como o Corte parcial.
    receiveSewing(swId, deltas) {
      let total = 0;
      (deltas || []).forEach(d => { if (d.delta) { this._blank(d.id, d.delta, `Entrada · Remessa ${swId}`); total += d.delta; } });
      if (total) toast(`Remessa ${swId} · +${total} peça${total === 1 ? '' : 's'} lisa${total === 1 ? '' : 's'} no estoque`);
      notify();
      return total;
    },

    // Imprimir a estampa de um lote: consome papel, produz impressos
    printEstampa(estCode, units, loteLabel, paperId) {
      const pr = D.printed.find(x => x.code === estCode && x.side === 'frente') || D.printed.find(x => x.code === estCode);
      const roll = paperId ? D.paperRolls.find(x => x.id === paperId) : (D.paperRolls.find(x => x.type === 'Filme DTF' && x.current > 0) || D.paperRolls[0]);
      const meters = Math.max(1, Math.round(units * 0.35 * 10) / 10); // ~0.35 m por peça
      if (roll) this._paper(roll.id, -meters, `Saída · Impressão ${loteLabel}`);
      if (pr) this._printed(pr.id, units, `Entrada · Impressão ${loteLabel}`);
      toast(`Impresso ${estCode} · +${units} impresso${units === 1 ? '' : 's'}${roll ? ` · −${meters} m papel` : ''}`);
      notify();
      return { printedId: pr && pr.id, paperId: roll && roll.id, meters };
    },

    // Concluir uma ORDEM DE IMPRESSÃO: abate a bobina de papel (metros) e credita
    // os IMPRESSOS no estoque, por estampa + lado (cria a linha se não existir).
    // sides = { front: n, back: n } — quantidade impressa por lado.
    _findPrintedRow(print, side) {
      let row = D.printed.find(x => x.code === print.id && x.side === side);
      if (!row) {
        row = { id: `pr-${print.id.toLowerCase().replace(/[^a-z0-9]/g, '')}-${side}`, code: print.id, name: print.name, technique: print.technique, side, tone: print.tone || 'warm', count: 0, min: 10 };
        D.printed.unshift(row);
      }
      return row;
    },
    completePrintOrder({ code, estampaId, paperId, meters, sides }) {
      const print = D.prints.find(p => p.id === estampaId);
      if (!print) return;
      const sideMap = { front: 'frente', back: 'costas' };
      if (paperId && meters > 0) this._paper(paperId, -meters, `Saída · Impressão ${code}`);
      let total = 0;
      Object.keys(sides || {}).forEach(s => {
        const qty = sides[s] || 0; if (qty <= 0) return;
        const row = this._findPrintedRow(print, sideMap[s] || s);
        row.count += qty; D.printedMovements.unshift({ date: stamp(), id: row.id, reason: `Entrada · Impressão ${code}`, qty });
        total += qty;
      });
      toast(`Impressão ${code} concluída · +${total} impresso${total === 1 ? '' : 's'}${meters ? ` · −${fmtM(meters)} m papel` : ''}`);
      notify();
    },

    // Montagem: peça lisa + impresso → produto (cria o SKU se ainda não existir)
    assemble({ blankId, printedId, qty, productMeta, ref }) {
      qty = qty || 1;
      if (blankId) this._blank(blankId, -qty, `Saída · Montagem${ref ? ' ' + ref : ''}`);
      if (printedId) this._printed(printedId, -qty, `Saída · Montagem${ref ? ' ' + ref : ''}`);
      let row = D.stock.find(x => x.sku === productMeta.sku);
      const isNew = !row;
      if (!row) { row = { sku: productMeta.sku, product: productMeta.product, color: productMeta.color, size: productMeta.size, print: productMeta.print, count: 0 }; D.stock.unshift(row); }
      row.count += qty;
      D.movements.unshift({ date: stamp(), sku: row.sku, reason: `Entrada · Montagem${ref ? ' ' + ref : ''}`, qty });
      toast(`Montagem · +${qty} ${productMeta.product}${isNew ? ' (novo SKU)' : ''} · −peça lisa −impresso`);
      notify();
    },
  };

  window.StockStore = Store;

  // React subscription hook (React already loaded before this script)
  window.useStock = function () {
    const [, setV] = React.useState(0);
    React.useEffect(() => window.StockStore.subscribe(v => setV(v)), []);
    return window.StockStore;
  };
})();
