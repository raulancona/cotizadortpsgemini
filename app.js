document.addEventListener('DOMContentLoaded', () => {
    // --- Configuración ---
    const CSV_URL = 'https://raw.githubusercontent.com/raulancona/cotizadortpsgemini/main/Lista%20estandar%20Raul.csv';
    const ITEMS_PER_PAGE = 25;
    const IVA_RATE = 0.16;

    // --- Estado ---
    let allProducts = [];
    let filteredProducts = [];
    let quoteItems = [];
    let currentPage = 1;
    let productMap = new Map();

    // --- Selectores del DOM ---
    const loadingStatusEl = document.getElementById('loading-status');
    const productCountInfoEl = document.getElementById('product-count-info');
    const filterClaveEl = document.getElementById('filter-clave');
    const filterDescripcionEl = document.getElementById('filter-descripcion');
    const productsBodyEl = document.getElementById('products-body');
    const prevPageBtn = document.getElementById('prev-page');
    const nextPageBtn = document.getElementById('next-page');
    const pageInfoEl = document.getElementById('page-info');
    const priceLevelEl = document.getElementById('price-level');
    const quoteBodyEl = document.getElementById('quote-body');
    const quoteSubtotalEl = document.getElementById('quote-subtotal');
    const quoteIvaEl = document.getElementById('quote-iva');
    const quoteTotalEl = document.getElementById('quote-total');
    const clientNameEl = document.getElementById('client-name');
    const quoteDateEl = document.getElementById('quote-date');
    const whatsappNumberEl = document.getElementById('whatsapp-number');
    const folioEl = document.getElementById('folio');
    const referenciaEl = document.getElementById('referencia');
    const operadorEl = document.getElementById('operador');
    const clientRfcEl = document.getElementById('client-rfc');
    const clientDirEl = document.getElementById('client-dir');
    const comentarioEl = document.getElementById('comentario');
    const sendWhatsappBtn = document.getElementById('send-whatsapp');
    const generatePdfBtn = document.getElementById('generate-pdf');

    // --- Funciones ---

    async function loadProducts() {
        try {
            loadingStatusEl.textContent = 'Cargando productos...';
            loadingStatusEl.className = 'status-loading';
            productCountInfoEl.textContent = '';
            filterClaveEl.disabled = true;
            filterDescripcionEl.disabled = true;
            productsBodyEl.innerHTML = `<tr><td colspan="5" class="text-center p-6 text-gray-400 text-sm">Cargando...</td></tr>`;

            const response = await fetch(`${CSV_URL}?t=${Date.now()}`);
            if (!response.ok) throw new Error(`Error HTTP ${response.status}`);
            const csvText = await response.text();

            Papa.parse(csvText, {
                header: true, skipEmptyLines: 'greedy', encoding: "UTF-8",
                transformHeader: h => h.trim(),
                complete: results => {
                    productMap.clear();
                    allProducts = results.data.map((p, i) => {
                        const clave = String(p.Clave || p.clave || '').trim();
                        const descripcion = String(p.Descripcion || p.descripcion || '').trim();
                        const precioRaw = String(p.PrecioPublico || p.preciopublico || '0');
                        const precio = parseFloat(precioRaw.replace(/[^0-9.-]+/g,'').replace(/,/g,'.'));
                        const unidadMedida = String(p.UnidadMedida || p.unidadmedida || 'PZA').trim();
                        if (clave && descripcion && !isNaN(precio) && precio >= 0) {
                            const id = `item-${i}-${clave}`;
                            const prod = { id, clave, descripcion, precioBase: precio, unidadMedida };
                            productMap.set(id, prod);
                            return prod;
                        }
                        return null;
                    }).filter(x => x);

                    if (!allProducts.length) {
                        loadingStatusEl.textContent = 'Error: ningún producto válido';
                        loadingStatusEl.className = 'status-error';
                        productsBodyEl.innerHTML = `<tr><td colspan="5" class="text-center p-6 text-red-600 text-sm">Revisa tu CSV.</td></tr>`;
                    } else {
                        loadingStatusEl.textContent = 'Productos cargados:';
                        loadingStatusEl.className = 'status-success';
                        productCountInfoEl.textContent = `(${allProducts.length})`;
                        filterClaveEl.disabled = false;
                        filterDescripcionEl.disabled = false;
                        applyFiltersAndDisplay();
                    }
                }
            });
        } catch (err) {
            console.error(err);
            loadingStatusEl.textContent = 'Error cargando CSV';
            loadingStatusEl.className = 'status-error';
        }
    }

    function applyFiltersAndDisplay() {
        const fClave = filterClaveEl.value.toUpperCase().trim();
        const fDesc = filterDescripcionEl.value.toUpperCase().trim();
        filteredProducts = allProducts.filter(p =>
            (p.clave.toUpperCase().includes(fClave) || p.descripcion.toUpperCase().includes(fClave))
            && p.descripcion.toUpperCase().includes(fDesc)
        );
        currentPage = 1;
        displayCatalogPage();
    }

    function displayCatalogPage() {
        productsBodyEl.innerHTML = '';
        const totalPages = Math.ceil(filteredProducts.length / ITEMS_PER_PAGE) || 1;
        const start = (currentPage - 1) * ITEMS_PER_PAGE;
        const pageItems = filteredProducts.slice(start, start + ITEMS_PER_PAGE);

        if (!pageItems.length) {
            productsBodyEl.innerHTML = `<tr><td colspan="5" class="text-center p-6 text-gray-500">Sin resultados.</td></tr>`;
        } else {
            pageItems.forEach(p => {
                const tr = document.createElement('tr');
                tr.classList.add('hover:bg-blue-50');
                tr.innerHTML = `
                    <td class="table-ui">${p.clave}</td>
                    <td class="table-ui">${p.descripcion}</td>
                    <td class="table-ui text-right">${formatCurrency(p.precioBase)}</td>
                    <td class="table-ui text-center">
                        <input type="number" min="1" value="1" class="w-14 border p-1 rounded-md text-center text-xs product-quantity" data-product-id="${p.id}">
                    </td>
                    <td class="table-ui text-center">
                        <button class="btn btn-primary btn-icon add-to-quote-btn" data-product-id="${p.id}">
                            <svg class="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clip-rule="evenodd" /></svg>
                        </button>
                    </td>
                `;
                productsBodyEl.appendChild(tr);
            });
        }
        pageInfoEl.textContent = `Página ${currentPage} / ${totalPages}`;
        prevPageBtn.disabled = currentPage === 1;
        nextPageBtn.disabled = currentPage === totalPages;
    }

    function changePage(dir) {
        const totalPages = Math.ceil(filteredProducts.length / ITEMS_PER_PAGE) || 1;
        currentPage += dir === 'prev' ? -1 : 1;
        currentPage = Math.min(Math.max(currentPage, 1), totalPages);
        displayCatalogPage();
    }

    function addToQuote(id, qty) {
        const prod = productMap.get(id);
        if (!prod) return;
        const exist = quoteItems.find(x => x.id === id);
        if (exist) exist.quantity += qty;
        else quoteItems.push({ ...prod, quantity: qty });
        updateQuoteDisplay();
    }

    function removeFromQuote(id) {
        quoteItems = quoteItems.filter(x => x.id !== id);
        updateQuoteDisplay();
    }

    function updateQuoteDisplay() {
        quoteBodyEl.innerHTML = '';
        if (!quoteItems.length) {
            quoteBodyEl.innerHTML = `<tr><td colspan="9" class="text-center p-4 text-gray-400 text-xs">Añade productos...</td></tr>`;
            sendWhatsappBtn.disabled = true;
            generatePdfBtn.disabled = true;
            return;
        }
        let subtotal = 0;
        const discount = parseFloat(priceLevelEl.value) || 0;
        quoteItems.forEach((item, i) => {
            const unit = calculateDiscountedPrice(item.precioBase, discount);
            const total = unit * item.quantity;
            subtotal += total;
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td class="text-center text-xs">${i+1}</td>
                <td class="text-xs">${item.clave}</td>
                <td class="quote-description-cell text-xs">${item.descripcion}</td>
                <td class="text-center text-xs">${item.quantity}</td>
                <td class="text-center text-xs">${item.unidadMedida}</td>
                <td class="text-right text-xs">${formatCurrency(unit)}</td>
                <td class="text-center text-xs">${discount}%</td>
                <td class="text-right text-xs">${formatCurrency(total)}</td>
                <td class="text-center text-xs">
                    <button class="remove-from-quote-btn">×</button>
                </td>
            `;
            tr.querySelector('button').dataset.productId = item.id;
            quoteBodyEl.appendChild(tr);
        });
        const iva = subtotal * IVA_RATE;
        const total = subtotal + iva;
        quoteSubtotalEl.textContent = formatCurrency(subtotal);
        quoteIvaEl.textContent      = formatCurrency(iva);
        quoteTotalEl.textContent    = formatCurrency(total);
        sendWhatsappBtn.disabled = false;
        generatePdfBtn.disabled   = false;
    }

    function calculateDiscountedPrice(base, pct) {
        return base * (1 - pct / 100);
    }

    function formatCurrency(val) {
        return new Intl.NumberFormat('es-MX', {
            style: 'currency', currency: 'MXN'
        }).format(val);
    }

    function formatDate(dateStr) {
        if (!dateStr) return '';
        const d = new Date(dateStr);
        const dd = String(d.getDate()).padStart(2, '0');
        const mm = String(d.getMonth()+1).padStart(2, '0');
        const yyyy = d.getFullYear();
        return `${dd}/${mm}/${yyyy}`;
    }

    function generateWhatsAppMessage() {
        let msg = `*Cotización TPS*\n*Cliente:* ${clientNameEl.value}\n*Fecha:* ${formatDate(quoteDateEl.value)}\n\n`;
        msg += `*Productos:*\n`;
        quoteItems.forEach(item => {
            const unit = calculateDiscountedPrice(item.precioBase, parseFloat(priceLevelEl.value)||0);
            msg += `- ${item.clave} ${item.descripcion} x${item.quantity} = ${formatCurrency(unit*item.quantity)}\n`;
        });
        msg += `\n*Subtotal:* ${quoteSubtotalEl.textContent}\n*IVA:* ${quoteIvaEl.textContent}\n*Total:* ${quoteTotalEl.textContent}`;
        return msg;
    }

    function sendWhatsApp() {
        const num = whatsappNumberEl.value.replace(/\D/g, '');
        if (!num) { alert('Número WhatsApp inválido'); return; }
        const text = encodeURIComponent(generateWhatsAppMessage());
        window.open(`https://wa.me/${num}?text=${text}`, '_blank');
    }

    // --- Listeners ---
    filterClaveEl.addEventListener('input', () => setTimeout(applyFiltersAndDisplay, 300));
    filterDescripcionEl.addEventListener('input', () => setTimeout(applyFiltersAndDisplay, 300));
    prevPageBtn.addEventListener('click', () => changePage('prev'));
    nextPageBtn.addEventListener('click', () => changePage('next'));
    productsBodyEl.addEventListener('click', e => {
        const btn = e.target.closest('.add-to-quote-btn');
        if (!btn) return;
        const id = btn.dataset.productId;
        const inp = productsBodyEl.querySelector(`input[data-product-id="${id}"]`);
        const q = parseInt(inp.value,10);
        if (q > 0) addToQuote(id, q);
    });
    quoteBodyEl.addEventListener('click', e => {
        const btn = e.target.closest('.remove-from-quote-btn');
        if (!btn) return;
        removeFromQuote(btn.dataset.productId);
    });
    priceLevelEl.addEventListener('change', updateQuoteDisplay);
    sendWhatsappBtn.addEventListener('click', sendWhatsApp);
    generatePdfBtn.addEventListener('click', () => {
        document.getElementById('pdf-template').style.display = 'block';
        generatePdf();
    });

    // --- Init ---
    quoteDateEl.value = new Date().toISOString().slice(0,10);
    loadProducts();
});
