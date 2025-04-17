document.addEventListener('DOMContentLoaded', () => {
  const CSV_URL    = 'https://raw.githubusercontent.com/raulancona/cotizadortpsgemini/main/Lista%20estandar%20Raul.csv';
  const ITEMS_PER_PAGE = 25;
  const IVA_RATE   = 0.16;

  let allProducts = [], filteredProducts = [], quoteItems = [], currentPage = 1;
  const productMap = new Map();

  // DOM
  const $ = id => document.getElementById(id);
  const loadingStatus = $('loading-status');
  const countInfo      = $('product-count-info');
  const tblBody        = $('products-body');
  const prevBtn        = $('prev-page');
  const nextBtn        = $('next-page');
  const pageInfo       = $('page-info');
  const filterClave    = $('filter-clave');
  const filterDesc     = $('filter-descripcion');
  const priceLevel     = $('price-level');
  const quoteBody      = $('quote-body');
  const subEl          = $('quote-subtotal');
  const ivaEl          = $('quote-iva');
  const totEl          = $('quote-total');
  const sendWA         = $('send-whatsapp');
  const genPDF         = $('generate-pdf');
  const inputs = {
    name: $('client-name'),
    date: $('quote-date'),
    wa:   $('whatsapp-number'),
    folio:$('folio'),
    ref:  $('referencia'),
    op:   $('operador'),
    rfc:  $('client-rfc'),
    dir:  $('client-dir'),
    com:  $('comentario'),
  };

  // 1) Carga productos
  async function loadProducts() {
    try {
      loadingStatus.textContent = 'Cargando…'; loadingStatus.className = 'status-loading';
      countInfo.textContent    = '';
      filterClave.disabled     = filterDesc.disabled = true;
      tblBody.innerHTML        = `<tr><td colspan="5" class="p-6 text-center text-gray-400">Cargando…</td></tr>`;

      const r = await fetch(`${CSV_URL}?t=${Date.now()}`);
      const txt = await r.text();
      console.log('CSV raw:', txt.slice(0,200));

      Papa.parse(txt, {
        header: true, skipEmptyLines: true,
        transformHeader: h => h.trim(),
        complete: ({ data, errors }) => {
          console.log('Primer registro:', data[0]);
          data.forEach((p,i) => {
            const clave = (p.Clave||'').trim();
            const desc  = (p.Descripcion||'').trim();
            const rawP  = (p.PrecioPublico||'0');
            const clean = rawP.replace(/[^0-9.-]+/g,'').replace(/,/g,'.');
            const price = parseFloat(clean);
            console.log({ clave, desc, rawP, clean, price });
            if (clave && desc && !isNaN(price)) {
              const id = `prd-${i}`;
              productMap.set(id, { id, clave, descripcion: desc, precioBase: price, unidadMedida: p.UnidadMedida||'PZA' });
            }
          });

          allProducts = Array.from(productMap.values());
          console.log('Total válidos:', allProducts.length);
          if (!allProducts.length) {
            loadingStatus.textContent = 'Error: sin productos válidos'; loadingStatus.className='status-error';
            tblBody.innerHTML = `<tr><td colspan="5" class="p-6 text-red-600">Revisa CSV</td></tr>`;
            return;
          }
          loadingStatus.textContent = 'Productos cargados:'; loadingStatus.className='status-success';
          countInfo.textContent = `(${allProducts.length})`;
          filterClave.disabled = filterDesc.disabled = false;
          applyFilters();
        }
      });
    } catch(err) {
      console.error(err);
      loadingStatus.textContent = 'Error al cargar CSV'; loadingStatus.className='status-error';
    }
  }

  // 2) Filtros y paginado
  function applyFilters() {
    const c = filterClave.value.trim().toUpperCase();
    const d = filterDesc.value.trim().toUpperCase();
    filteredProducts = allProducts.filter(p =>
      (p.clave.toUpperCase().includes(c) || p.descripcion.toUpperCase().includes(c))
      && p.descripcion.toUpperCase().includes(d)
    );
    currentPage = 1; renderPage();
  }
  function renderPage() {
    tblBody.innerHTML = '';
    const totalPages = Math.ceil(filteredProducts.length/ITEMS_PER_PAGE)||1;
    const start = (currentPage-1)*ITEMS_PER_PAGE;
    const page = filteredProducts.slice(start, start+ITEMS_PER_PAGE);

    if (!page.length) {
      tblBody.innerHTML = `<tr><td colspan="5" class="p-6 text-center text-gray-500">Sin resultados</td></tr>`;
    } else {
      page.forEach(p => {
        const row = document.createElement('tr');
        row.classList.add('hover:bg-blue-50');
        row.innerHTML = `
          <td class="px-4 py-2">${p.clave}</td>
          <td class="px-4 py-2">${p.descripcion}</td>
          <td class="px-4 py-2 text-right">${formatCurrency(p.precioBase)}</td>
          <td class="px-4 py-2 text-center">
            <input type="number" min="1" value="1" class="w-16 border rounded text-sm text-center qty" data-id="${p.id}">
          </td>
          <td class="px-4 py-2 text-center">
            <button class="btn btn-primary add" data-id="${p.id}">+</button>
          </td>`;
        tblBody.appendChild(row);
      });
    }
    pageInfo.textContent = `Página ${currentPage} / ${totalPages}`;
    prevBtn.disabled = currentPage===1;
    nextBtn.disabled = currentPage===totalPages;
  }

  // 3) Páginas
  prevBtn.addEventListener('click', ()=>{ if(currentPage>1){ currentPage--; renderPage() } });
  nextBtn.addEventListener('click', ()=>{ const tp=Math.ceil(filteredProducts.length/ITEMS_PER_PAGE); if(currentPage<tp){ currentPage++; renderPage() } });

  filterClave.addEventListener('input', ()=> setTimeout(applyFilters,300));
  filterDesc.addEventListener('input', ()=> setTimeout(applyFilters,300));

  // 4) Cotización
  function addToQuote(id, qty) {
    console.log('Añadir →', id, qty);
    const prod = productMap.get(id);
    if (!prod) return;
    const found = quoteItems.find(x=>x.id===id);
    if (found) found.quantity += qty;
    else quoteItems.push({ ...prod, quantity: qty });
    console.log('quoteItems:', quoteItems);
    updateQuote();
  }
  function removeFromQuote(id) {
    quoteItems = quoteItems.filter(x=>x.id!==id);
    updateQuote();
  }
  function updateQuote() {
    quoteBody.innerHTML='';
    if (!quoteItems.length) {
      quoteBody.innerHTML=`<tr><td colspan="9" class="p-4 text-center text-gray-400">Añade productos…</td></tr>`;
      sendWA.disabled = genPDF.disabled = true;
      return;
    }
    let sub=0;
    const disc = parseFloat(priceLevel.value)||0;
    quoteItems.forEach((it,i)=>{
      const unit = it.precioBase*(1-disc/100);
      const imp  = unit*it.quantity;
      sub += imp;
      const tr = document.createElement('tr');
      tr.innerHTML=`
        <td class="px-2 py-1 text-center">${i+1}</td>
        <td class="px-2 py-1">${it.clave}</td>
        <td class="px-2 py-1">${it.descripcion}</td>
        <td class="px-2 py-1 text-center">${it.quantity}</td>
        <td class="px-2 py-1 text-center">${it.unidadMedida}</td>
        <td class="px-2 py-1 text-right">${formatCurrency(unit)}</td>
        <td class="px-2 py-1 text-center">${disc}%</td>
        <td class="px-2 py-1 text-right">${formatCurrency(imp)}</td>
        <td class="px-2 py-1 text-center"><button class="remove text-red-500">×</button></td>`;
      tr.querySelector('button').addEventListener('click', ()=> removeFromQuote(it.id));
      quoteBody.appendChild(tr);
    });
    const iva = sub*IVA_RATE, tot=sub+iva;
    subEl.textContent = formatCurrency(sub);
    ivaEl.textContent = formatCurrency(iva);
    totEl.textContent = formatCurrency(tot);
    sendWA.disabled = genPDF.disabled = false;
  }

  // 5) Formato y envíos
  function formatCurrency(v){
    return new Intl.NumberFormat('es-MX',{ style:'currency',currency:'MXN' }).format(v);
  }

  function generateWhatsAppMessage(){
    let txt=`*Cotización TPS*\nCliente: ${inputs.name.value}\nFecha: ${inputs.date.value}\n\n`;
    quoteItems.forEach(it=>{
      const unit = it.precioBase*(1-(parseFloat(priceLevel.value)||0)/100);
      txt+=`${it.clave} ${it.descripcion} x${it.quantity} = ${formatCurrency(unit*it.quantity)}\n`;
    });
    txt+=`\nSubtotal: ${subEl.textContent}\nIVA: ${ivaEl.textContent}\nTotal: ${totEl.textContent}`;
    return encodeURIComponent(txt);
  }

  sendWA.addEventListener('click', ()=>{
    const num = inputs.wa.value.replace(/\D/g,'');
    if(!num){ alert('Número inválido'); return; }
    window.open(`https://wa.me/${num}?text=${generateWhatsAppMessage()}`, '_blank');
  });

  genPDF.addEventListener('click', ()=>{
    // rellena campos del PDF (igual que tu lógica anterior) …
    const el = $('pdf-template');
    el.style.display='block';
    html2pdf().from(el).save().then(()=> el.style.display='none');
  });

  // 6) Inicia
  inputs.date.value = new Date().toISOString().slice(0,10);
  loadProducts();

  // 7) Listener global “+”
  tblBody.addEventListener('click', e=>{
    const btn = e.target.closest('.add');
    if(!btn) return;
    const id = btn.dataset.id;
    const inp = tblBody.querySelector(`input.qty[data-id="${id}"]`);
    const q   = parseInt(inp.value,10);
    if(q>0) addToQuote(id,q);
  });
});
