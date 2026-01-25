document.addEventListener('DOMContentLoaded', function () {
    
    // ==========================================
    // 1. Initialization
    // ==========================================
    const db = window.Imala.db;
    const auth = window.Imala.auth;
    
    // Auth Check
    auth.onAuthStateChanged(user => {
        if (!user) window.location.href = 'auth-login.html';
        else {
            initCategories();
            initEntities();
            loadTransactions();
            loadAgreements(); // New Module
        }
    });

    const txModal = new bootstrap.Modal(document.getElementById('transaction-modal'));
    let allTransactions = [];
    let categories = []; 
    let entities = []; // Local cache of entities

    // ==========================================
    // 2. Helper Functions (Currency, Date)
    // ==========================================
    
    const formatCurrency = (amount, currency) => {
        return new Intl.NumberFormat('es-AR', { style: 'currency', currency: currency }).format(amount);
    };

    const parseDate = (timestamp) => {
        if(!timestamp) return null;
        if(timestamp.seconds) return new Date(timestamp.seconds * 1000);
        return new Date(timestamp);
    };

    // ==========================================
    // 3. Categories Logic
    // ==========================================
    
    async function initCategories() {
        const defaultCategories = ['Alquiler', 'Expensas', 'Servicios', 'Honorarios', 'Ventas', 'Otros'];
        categories = []; // Reset local array

        try {
            const collectionRef = db.collection('cashflow_categories');
            const snap = await collectionRef.orderBy('createdAt', 'asc').get();
            
            // 1. Load Existing from DB
            const existingNames = new Set();
            snap.forEach(doc => {
                const d = doc.data();
                existingNames.add(d.name);
                // Only add to UI list if active
                if (d.active !== false) {
                   categories.push(d.name); 
                }
            });

            // 2. Migration Check: Do defaults exist?
            // If the collection is empty OR if specific defaults are missing, we should probably add them?
            // Let's assume if "Alquiler" is missing, we add it. 
            // BUT: What if user deleted it? We shouldn't re-add it.
            // Heuristic: If collection is completely empty, it's a fresh start -> Add Defaults.
            // If collection has items, assume migration done or user managing them.
            // Wait, currently defaults are NOT in DB. So for this user, existingNames might be empty (or only contain the ones they just added).
            
            // Refined Heuristic: Check for a "migration_complete" marker or just check if ANY default exists.
            // Since this user just started using the DB for categories, they might have their custom ones but NOT the defaults.
            
            // Let's iterate defaults. If default is NOT in existingNames, add it.
            // Risky if user deleted it already? No, because they COULDN'T delete it before this feature.
            // So for this specific user/session, it is safe to add them if missing.
            
            const batch = db.batch();
            let hasNewDefaults = false;

            defaultCategories.forEach(defCat => {
                if (!existingNames.has(defCat)) {
                    // Add it
                    const newRef = collectionRef.doc();
                    batch.set(newRef, {
                        name: defCat,
                        active: true,
                        createdAt: new Date(),
                        createdBy: 'SYSTEM'
                    });
                    categories.push(defCat); // Add to local list immediately
                    existingNames.add(defCat); // Prevent dupes locally
                    hasNewDefaults = true;
                }
            });

            if (hasNewDefaults) {
                await batch.commit();
                console.log("Default categories migrated to Firestore.");
            }
            
            // Re-sort alphabetically or keep creation order? 
            // Let's sort alphabetically for better UX now that they are mixed.
            categories.sort();

        } catch (error) {
            console.error("Error loading/migrating categories:", error);
            // Fallback just in case
            if(categories.length === 0) categories = [...defaultCategories];
        }

        renderCategoryOptions();
    }

    function renderCategoryOptions() {
        const select = document.getElementById('tx-category');
        select.innerHTML = '<option value="">Seleccione...</option>';
        categories.forEach(c => {
            select.innerHTML += `<option value="${c}">${c}</option>`;
        });
        
        // Filter Select
        const filterSelect = document.getElementById('filter-category');
        const currentVal = filterSelect.value; // Store value to restore if possible
        filterSelect.innerHTML = '<option value="ALL">Todas</option>';
        categories.forEach(c => {
            filterSelect.innerHTML += `<option value="${c}">${c}</option>`;
        });
        if(currentVal) filterSelect.value = currentVal;
    }

    // Inline Add Logic
    const containerNewCat = document.getElementById('container-new-category');
    const inputNewCat = document.getElementById('input-new-category');
    
    document.getElementById('btn-add-category').addEventListener('click', () => {
         containerNewCat.style.display = 'block';
         inputNewCat.focus();
    });

    document.getElementById('btn-cancel-new-cat').addEventListener('click', () => {
         containerNewCat.style.display = 'none';
         inputNewCat.value = '';
    });

    document.getElementById('btn-save-new-cat').addEventListener('click', async () => {
        const cat = inputNewCat.value.trim();
        if(!cat) return;

        try {
            const btn = document.getElementById('btn-save-new-cat');
            btn.innerHTML = '<i class="bx bx-loader bx-spin"></i>';
            btn.disabled = true;

            await db.collection('cashflow_categories').add({
                name: cat,
                active: true,
                createdAt: new Date(),
                createdBy: auth.currentUser.uid
            });

            categories.push(cat); 
            renderCategoryOptions();
            
            // Select it
            document.getElementById('tx-category').value = cat;
            
            // Reset UI
            containerNewCat.style.display = 'none';
            inputNewCat.value = '';
            
        } catch (error) {
            console.error(error);
            Swal.fire('Error', 'No se pudo guardar la categoría.', 'error');
        } finally {
            const btn = document.getElementById('btn-save-new-cat');
            btn.innerHTML = '<i class="mdi mdi-check"></i>';
            btn.disabled = false;
        }
    });

    // Category Management
    const modalManage = new bootstrap.Modal(document.getElementById('modal-manage-categories'));
    
    document.getElementById('btn-manage-categories').addEventListener('click', async () => {
        loadManageCategories();
        modalManage.show();
    });

    async function loadManageCategories() {
         const tbody = document.querySelector('#table-manage-categories tbody');
         tbody.innerHTML = '<tr><td>Cargando...</td></tr>';
         
         try {
             const snap = await db.collection('cashflow_categories').where('active', '!=', false).get();
             // Note: 'active' might be missing in old ones, so better get all and filter in JS if index is issue.
             // Or simpler: get all from 'categories' array? No, need IDs to delete.
             // We need IDs. So fetch query is needed.
             
             // Issue: we used an array `categories` mixing defaults and DB.
             // Defaults cannot be deleted (hardcoded). DB ones can.
             
             // Fetch all DB categories
             const dbCats = await db.collection('cashflow_categories').orderBy('createdAt', 'desc').get();
             
             tbody.innerHTML = '';
             
             dbCats.forEach(doc => {
                 const d = doc.data();
                 if(d.active === false) return; // Skip inactive
                 
                 tbody.innerHTML += `
                    <tr>
                        <td class="align-middle">${d.name}</td>
                        <td class="text-end">
                            <button class="btn btn-sm btn-soft-danger" onclick="softDeleteCategory('${doc.id}', '${d.name}')">
                                <i class="mdi mdi-trash-can-outline"></i>
                            </button>
                        </td>
                    </tr>
                 `;
             });
             
             if(tbody.innerHTML === '') tbody.innerHTML = '<tr><td colspan="2" class="text-center text-muted">No hay categorías personalizadas.</td></tr>';
             
         } catch(e) {
             console.error(e);
             tbody.innerHTML = '<tr><td>Error al cargar.</td></tr>';
         }
    }

    window.softDeleteCategory = async function(id, name) {
        if(confirm(`¿Eliminar "${name}" del selector?`)) {
            await db.collection('cashflow_categories').doc(id).update({ active: false });
            
            // Update local array
            categories = categories.filter(c => c !== name);
            renderCategoryOptions();
            
            // Reload list
            loadManageCategories();
        }
    };


    // ==========================================
    // 4. Transaction CRUD
    // ==========================================

    const formTx = document.getElementById('form-transaction');
    const btnNewIncome = document.getElementById('btn-new-income');
    const btnNewExpense = document.getElementById('btn-new-expense');

    const btnNewSaving = document.getElementById('btn-new-saving');

    function openModal(type, data = null) {
        formTx.reset();
        document.getElementById('tx-type').value = type;
        
        let title = '';
        let labelEntity = '';
        
        if (type === 'INCOME') {
             title = 'Registrar Ingreso';
             labelEntity = 'Cliente / Entidad';
        } else if (type === 'EXPENSE') {
             title = 'Registrar Gasto';
             labelEntity = 'Proveedor / Entidad';
        } else if (type === 'SAVING') {
             title = 'Registrar Ahorro';
             labelEntity = 'Nombre del Ahorro / Meta';
        }

        document.getElementById('transactionModalLabel').textContent = title;
        document.getElementById('label-entity').textContent = labelEntity;
        document.getElementById('tx-date').valueAsDate = new Date();

        if(data) {
             // Future: pre-fill implementation
        }
        
        txModal.show();
    }

    btnNewIncome.addEventListener('click', () => openModal('INCOME'));
    btnNewExpense.addEventListener('click', () => openModal('EXPENSE'));
    btnNewSaving.addEventListener('click', () => openModal('SAVING'));

    // ==========================================
    // 5. Entities Registry
    // ==========================================
    
    async function initEntities() {
         const datalist = document.getElementById('list-entities');
         datalist.innerHTML = '';
         entities = [];
         
         try {
             const snap = await db.collection('cashflow_entities').orderBy('name').get();
             snap.forEach(doc => {
                 const name = doc.data().name;
                 if(!entities.includes(name)) {
                     entities.push(name);
                     const opt = document.createElement('option');
                     opt.value = name;
                     datalist.appendChild(opt);
                 }
             });
         } catch(e) {
             console.error("Error loading entities", e);
         }
    }

    async function checkAndSaveEntity(name, type) {
        if(!name) return;
        // Check local cache
        // Using lowercase comparison for better duplicate detection
        const exists = entities.some(e => e.toLowerCase() === name.toLowerCase());
        
        if(!exists) {
            try {
                await db.collection('cashflow_entities').add({
                    name: name,
                    type: type, // 'PROVIDER', 'CLIENT', or 'BOTH' (simplified to just type of tx)
                    createdAt: new Date(),
                    createdBy: auth.currentUser.uid
                });
                // Add to local list/DOM to avoid reload
                entities.push(name);
                const datalist = document.getElementById('list-entities');
                const opt = document.createElement('option');
                opt.value = name;
                datalist.appendChild(opt);
                
                console.log(`New entity ${name} saved.`);
            } catch(e) {
                console.error("Error auto-saving entity", e);
            }
        }
    }

    formTx.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const btnSave = document.getElementById('btn-save-tx');
        const originalText = btnSave.innerHTML;
        btnSave.disabled = true;
        btnSave.innerHTML = '<i class="bx bx-loader bx-spin"></i> Guardando...';

        try {
            const type = document.getElementById('tx-type').value;
            const id = document.getElementById('tx-id').value;
            
            const entityName = document.getElementById('tx-entity-name').value;
            // Auto-save entity
            // Determine type hint
            let entityType = 'OTHER';
            if(type === 'INCOME') entityType = 'CLIENT';
            else if (type === 'EXPENSE') entityType = 'PROVIDER';
            
            // Fire and forget (don't await) to speed up UI, or await if critical?
            // Let's await to be safe.
            await checkAndSaveEntity(entityName, entityType);

            const data = {
                type: type,
                entityName: entityName,
                cuit: document.getElementById('tx-cuit').value,
                address: document.getElementById('tx-address').value,
                category: document.getElementById('tx-category').value,
                status: document.getElementById('tx-status').value,
                currency: document.getElementById('tx-currency').value,
                amount: parseFloat(document.getElementById('tx-amount').value),
                date: firebase.firestore.Timestamp.fromDate(document.getElementById('tx-date').valueAsDate),
                isRecurring: document.getElementById('tx-recurring').checked,
                createdAt: new Date(),
                createdBy: auth.currentUser.uid
            };

            await db.collection('transactions').add(data);
            
            txModal.hide();
            Swal.fire('Guardado', 'Movimiento registrado correctamente.', 'success');
            
            // Check recurrence immediately? Not needed, loadTransactions will listen
            
        } catch (error) {
            console.error(error);
            Swal.fire('Error', error.message, 'error');
        } finally {
            btnSave.disabled = false;
            btnSave.innerHTML = originalText;
        }
    });

    // ==========================================
    // 5. Load & Recurrence Logic
    // ==========================================

    function loadTransactions() {
        db.collection('transactions').onSnapshot(snap => {
            allTransactions = [];
            snap.forEach(doc => allTransactions.push({ id: doc.id, ...doc.data() }));
            
            // 1. Run Recurrence Engine
            checkRecurrences(allTransactions);

            // 2. Render
            applyFilters();
        });
    }

    async function checkRecurrences(transactions) {
        // Logic: Find recurring items. Check if current month entry exists. If not, create it.
        // This is a "Client-side trigger" approach. Robust enough for this scale.
        
        const recurringParents = transactions.filter(t => t.isRecurring && !t.parentRecurringId); // Only parents
        const today = new Date();
        const currentMonthKey = `${today.getFullYear()}-${today.getMonth()}`; // YYYY-M

        let createdCount = 0;

        for (const parent of recurringParents) {
            // Check if there is already a child for this month
            // We can check by some metadata tag like "generatedPeriod: '2025-01'"
            
            // Simplified check: Do we have a transaction with same entity, amount, category created this month?
            // Better: Store 'lastGenerated' on parent? Or query children.
            // Let's rely on finding a child with 'parentRecurringId' == parent.id AND date in current month.
            
            const AlreadyExists = transactions.find(t => 
                t.parentRecurringId === parent.id && 
                parseDate(t.date).getMonth() === today.getMonth() &&
                parseDate(t.date).getFullYear() === today.getFullYear()
            );

            if (!AlreadyExists) {
                // Determine Date: 1st of current month? Or same day of month as parent?
                // Let's use 10th of valid month or present day. Default to today for simplicity or 1st.
                const newDate = new Date(today.getFullYear(), today.getMonth(), 1); 
                
                // CREATE CHILD
                const childData = { ...parent };
                delete childData.id;
                delete childData.createdAt; // New creation time
                
                childData.isRecurring = false; // Child is not the generator
                childData.parentRecurringId = parent.id;
                childData.status = 'PENDING'; // Always pending initially
                childData.date = newDate;
                childData.createdAt = new Date();
                childData.description = `${parent.address || ''} (Recurrente Mes ${today.getMonth()+1})`; 

                console.log("Generating recurring tx for", parent.entityName);
                await db.collection('transactions').add(childData);
                createdCount++;
            }
        }
        
        if(createdCount > 0) console.log(`Generated ${createdCount} recurring transactions.`);
    }

    // ==========================================
    // 6. Filters & Render
    // ==========================================

    const filterYear = document.getElementById('filter-year');
    const filterPeriod = document.getElementById('filter-period');
    const filterSearch = document.getElementById('filter-search');
    const filterCategory = document.getElementById('filter-category');
    const btnApplyFilters = document.getElementById('btn-apply-filters');

    // Initialize Filters to Current Date
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = (now.getMonth() + 1).toString().padStart(2, '0');

    // Set Year
    // Check if option exists, if not add it (though HTML should have it)
    if (![...filterYear.options].some(o => o.value == currentYear)) {
         let opt = document.createElement('option');
         opt.value = currentYear;
         opt.textContent = currentYear;
         filterYear.appendChild(opt);
    }
    filterYear.value = currentYear;

    // Set Period (Month)
    filterPeriod.value = currentMonth;

    btnApplyFilters.addEventListener('click', applyFilters);
    
    // Auto-update on select change
    [filterYear, filterPeriod, filterCategory].forEach(el => el.addEventListener('change', applyFilters));
    
    // 6. Filters & Render Update for YTD
    function applyFilters() {
        let filtered = [...allTransactions];
        
        const year = parseInt(filterYear.value);
        const period = filterPeriod.value;
        const search = filterSearch.value.toLowerCase();
        const cat = filterCategory.value;

        // Year Filter
        filtered = filtered.filter(t => parseDate(t.date).getFullYear() === year);

        // Period Filter
        if(period === 'YTD') {
             const now = new Date();
             filtered = filtered.filter(t => parseDate(t.date) <= now);
        } else if(period !== 'ALL') {
             filtered = filtered.filter(t => {
                 const d = parseDate(t.date);
                 const m = d.getMonth() + 1; // 1-12
                 
                 if (period === 'Q1') return m >= 1 && m <= 3;
                 if (period === 'Q2') return m >= 4 && m <= 6;
                 if (period === 'Q3') return m >= 7 && m <= 9;
                 if (period === 'Q4') return m >= 10 && m <= 12;
                 if (period === 'S1') return m >= 1 && m <= 6;
                 if (period === 'S2') return m >= 7 && m <= 12;
                 
                 // Specific Month (01-12)
                 return m === parseInt(period);
             });
        }

        // Category Filter
        if(cat !== 'ALL') filtered = filtered.filter(t => t.category === cat);

        // Search Filter
        if(search) {
            filtered = filtered.filter(t => 
                t.entityName.toLowerCase().includes(search) || 
                (t.address && t.address.toLowerCase().includes(search))
            );
        }

        calculateKPIs(filtered);
        renderTables(filtered);
        renderMonthlyControl(); 
        renderAgreementsList(); // Fix: Update Bottom Table too
    }

    // Call applyFilters when agreements data changes to update Monthly Control too 
    // Wait, Monthly Control depends on Agreements Data AND Filters.
    // The main applyFilters triggers renderTables, but we should also trigger renderMonthlyControl.
    // Let's hook renderMonthlyControl into applyFilters or just call it.
    // Actually, renderMonthlyControl needs access to the filter values. It can read DOM.

    // 8.2 UI Rendering (SPLIT & FILTERED)
    
    // Initialize Filters to Current Date (Wrapped to avoid scope conflicts)
    (function initFilters() {
        const _now = new Date();
        const _currentYear = _now.getFullYear();
        const _currentMonth = (_now.getMonth() + 1).toString().padStart(2, '0');

        // Ensure Filters exist before setting
        const fYear = document.getElementById('filter-year');
        const fPeriod = document.getElementById('filter-period');

        if(fYear && fPeriod) {
            // Set Year
            if (![...fYear.options].some(o => o.value == _currentYear)) {
                 let opt = document.createElement('option');
                 opt.value = _currentYear;
                 opt.textContent = _currentYear;
                 fYear.appendChild(opt);
            }
            fYear.value = _currentYear;

            // Set Period (Month)
            fPeriod.value = _currentMonth;
        }
    })();


    // A. Main List (Bottom) - Respects Filters
    function renderAgreementsList() {
        const tbody = document.querySelector('#table-agreements tbody');
        tbody.innerHTML = '';
        
        // Use Global Filters
        const period = document.getElementById('filter-period').value;
        const year = document.getElementById('filter-year').value;
        const monthMap = { '01': 'Enero', '02': 'Febrero', '03': 'Marzo', '04': 'Abril', '05': 'Mayo', '06': 'Junio', '07': 'Julio', '08': 'Agosto', '09': 'Septiembre', '10': 'Octubre', '11': 'Noviembre', '12': 'Diciembre' };

        // Determine Mode for "History Column"
        const isMonthlyView = !!monthMap[period];
        // const label = period === 'YTD' ? 'Acumulado a Hoy' : (isMonthlyView ? monthMap[period] : period);
        
        // ALWAYS SHOW ALL ACTIVE AGREEMENTS (Roster View)
        // User wants to see potential activity for the selected month to check status.
        
        if(agreements.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" class="text-center text-muted">No hay acuerdos registrados.</td></tr>';
            return;
        }

        agreements.forEach(a => {
            const amountStr = formatCurrency(a.amount, a.currency);
            let statusHTML = '';
            
            // --- STRICT STATUS CALCULATION ---
            
            if (isMonthlyView) {
                 // Check SPECIFICALLY for the selected Month/Year
                 const targetKey = `${year}-${period}`;
                 const isGen = a.invoices && a.invoices[targetKey] && a.invoices[targetKey].sent;
                 
                  // Label semantics based on "hasInvoice"
                const activeLabel = a.hasInvoice ? 'ENVIADA' : 'GENERADO';
                const inactiveLabel = a.hasInvoice ? 'NO ENVIADA' : 'PENDIENTE';

                // Checkbox: Only if hasInvoice? 
                // Wait, if it's Monthly view, we want to allow toggling here too? 
                // The user said "listado de acuerdos ese quiero q tenga el filtro de arriba".
                // And "si aplico el filtro por ejemplo en marzo aun me siguen apareciendo lo de enero".
                
                // If I show a checkbox here, it's duplicating the Top Card for invoiced items.
                // BUT for non-invoiced items (which are NOT in the Top Card), this is the ONLY place to toggle "Generado".
                
                // So: Show Interactive Checkbox for EVERYONE in Monthly View.
                // This effectively merges functionality but keeps the Top Card as a "Focused Priority List".
                
                statusHTML = `
                    <div class="form-check form-switch mb-0">
                        <input class="form-check-input" type="checkbox" id="list-invoice-${a.id}" ${isGen ? 'checked' : ''} onchange="toggleInvoiceSent('${a.id}', '${targetKey}', this)">
                        <label class="form-check-label text-muted small" for="list-invoice-${a.id}">${isGen ? activeLabel : inactiveLabel}</label>
                    </div>
                `;

            } else {
                 // RANGE VIEW (History Log)
                 // Count actual generation in the Range.
                 let totalGenerated = 0;
                 let count = 0;

                 if(a.invoices) {
                    Object.keys(a.invoices).forEach(key => {
                        const [invYear, invMonth] = key.split('-');
                        if(invYear !== year) return;
                        
                        const m = parseInt(invMonth);
                        let include = false;
                        
                        // Strict Inclusion Logic
                        if(period === 'ALL') include = true;
                        else if(period === 'YTD') {
                            const now = new Date();
                            const invDate = new Date(parseInt(invYear), m-1, 1);
                            if(invDate <= now) include = true;
                        }
                        else if (period === 'Q1') include = m >= 1 && m <= 3;
                        else if (period === 'Q2') include = m >= 4 && m <= 6;
                        else if (period === 'Q3') include = m >= 7 && m <= 9;
                        else if (period === 'Q4') include = m >= 10 && m <= 12;
                        else if (period === 'S1') include = m >= 1 && m <= 6;
                        else if (period === 'S2') include = m >= 7 && m <= 12;

                        if(include && a.invoices[key].sent) {
                            count++;
                            totalGenerated += a.amount;
                        }
                    });
                 }
                 
                 if(count > 0) statusHTML = `<span class="badge bg-success-subtle text-success font-size-12 p-2">${count} Gen. (${formatCurrency(totalGenerated, a.currency)})</span>`;
                 else statusHTML = `<span class="text-muted small">-</span>`;
            }

            tbody.innerHTML += `
                <tr>
                    <td>
                        <h6 class="mb-0 text-truncate font-size-14">${a.name}</h6>
                        <small class="text-muted d-block d-lg-none">${a.description || '-'}</small>
                    </td>
                    <td class="d-none d-lg-table-cell">
                        <small class="d-block text-muted">${a.description || '-'}</small>
                        <small class="d-block code">${a.cuit || ''}</small>
                    </td>
                    <td class="fw-bold">${amountStr}</td>
                    <td>${a.hasInvoice ? (a.biller || '-') : '<span class="text-muted font-size-11 fst-italic">No Factura</span>'}</td>
                    <td>${statusHTML}</td>
                    <td>
                        <button class="btn btn-sm btn-soft-primary" onclick="editAgreement('${a.id}')"><i class="mdi mdi-pencil"></i></button>
                    </td>
                </tr>
            `;
        });
    }

    // B. Monthly Control Card (Top) - SPECIFIC LOGIC
    // Shows ONLY: Invoiced Agreements
    // For: Current Month (or Selected Month if Period filter is a Month)
    function renderMonthlyControl() {
        const tbody = document.getElementById('monthly-control-list');
        tbody.innerHTML = '';
        
        const period = document.getElementById('filter-period').value;
        const year = document.getElementById('filter-year').value;
        const monthMap = { '01': 'Enero', '02': 'Febrero', '03': 'Marzo', '04': 'Abril', '05': 'Mayo', '06': 'Junio', '07': 'Julio', '08': 'Agosto', '09': 'Septiembre', '10': 'Octubre', '11': 'Noviembre', '12': 'Diciembre' };

        // Determine Target Month
        let targetMonthKey = '';
        let targetMonthLabel = '';

        if(monthMap[period]) {
            targetMonthKey = `${year}-${period}`;
            targetMonthLabel = `${monthMap[period]} ${year}`;
        } else {
            // If viewing range, default to CURRENT REAL MONTH for the checklist?
            // Or hide the card?
            // User said: "y si pongo por ejemplo marzo aun me sale abajo el listado de lo de enero".
            // That was about the LIST. 
            // For the Control Card, it makes sense to show CURRENT MONTH by default if range is YTD.
            const now = new Date();
            const currM = (now.getMonth()+1).toString().padStart(2, '0');
            targetMonthKey = `${now.getFullYear()}-${currM}`;
            targetMonthLabel = `${monthMap[currM]} ${now.getFullYear()} (Actual)`;
        }

        // Filter: Active, Monthly Frequency, Has Invoice = TRUE
        const pendingList = agreements.filter(a => a.frequency === 'MONTHLY' && a.hasInvoice === true);

        if(pendingList.length === 0) {
             tbody.innerHTML = '<tr><td colspan="4" class="text-center text-muted">No hay clientes con factura mensual activos.</td></tr>';
             return;
        }

        document.querySelector('#card-monthly-control .card-title').innerHTML = `<i class="mdi mdi-playlist-check me-1"></i> Control de Facturación: ${targetMonthLabel}`;

        pendingList.forEach(a => {
             const amountStr = formatCurrency(a.amount, a.currency);
             let isSent = false;
             
             if(a.invoices && a.invoices[targetMonthKey] && a.invoices[targetMonthKey].sent) {
                 isSent = true;
             }

             const checkbox = `
                <div class="form-check form-switch mb-0">
                    <input class="form-check-input" type="checkbox" id="ctrl-invoice-${a.id}" ${isSent ? 'checked' : ''} onchange="toggleInvoiceSent('${a.id}', '${targetMonthKey}', this)">
                    <label class="form-check-label text-muted small" for="ctrl-invoice-${a.id}">${isSent ? 'ENVIADA' : 'NO ENVIADA'}</label>
                </div>
             `;

             tbody.innerHTML += `
                <tr class="${isSent ? 'bg-success-subtle' : ''}">
                    <td><strong>${a.name}</strong></td>
                    <td>${amountStr}</td>
                    <td>${a.biller || '-'}</td>
                    <td>${checkbox}</td>
                </tr>
             `;
        });
    }

    // 8.5 Automated Logic (Non-Invoiced)
    async function processAutomaticAgreements() {
        // Runs on load (called from loadAgreements)
        // Target: Inactive Invoice, Monthly, Recurring -> Auto Generate for CURRENT MONTH
        
        const now = new Date();
        const currentPeriodKey = `${now.getFullYear()}-${(now.getMonth()+1).toString().padStart(2, '0')}`;
        
        // Find candidates
        const candidates = agreements.filter(a => 
            a.frequency === 'MONTHLY' && 
            a.hasInvoice === false
        );

        let created = 0;

        for (const a of candidates) {
            // Check if already generated for this month
            if (a.invoices && a.invoices[currentPeriodKey] && a.invoices[currentPeriodKey].sent) {
                continue; // Already done
            }

            // Create Income Automatically
            try {
                const newTx = {
                      type: 'INCOME',
                      entityName: a.name,
                      cuit: a.cuit,
                      address: 'Cobro Recurrente Automático',
                      category: 'Honorarios', 
                      status: 'PENDING', // User said "vaya a ingresos", usually pending until collected? Or status PAID? 
                      // "Control mes a mes si se envió... si se envió entonces va a ingresos".
                      // For non-factured, maybe we assume it's just "Expected Income"? Let's set Pending.
                      // If it's recurrent payment (like subscription), maybe Paid? 
                      // Safest is PENDING.
                      currency: a.currency,
                      amount: a.amount,
                      date: firebase.firestore.Timestamp.fromDate(new Date()), // Today
                      isRecurring: false, 
                      agreementId: a.id,
                      periodKey: currentPeriodKey,
                      createdAt: new Date(),
                      createdBy: 'SYSTEM'
                };
                 
                const docRef = await db.collection('transactions').add(newTx);
                
                // Update Agreement Record
                const updateMap = {};
                updateMap[`invoices.${currentPeriodKey}`] = {
                     sent: true, // "Sent" here just means "Generated" for non-invoice items
                     date: new Date().toISOString().split('T')[0],
                     incomeId: docRef.id
                };
                
                await db.collection('cashflow_agreements').doc(a.id).update(updateMap);
                console.log(`Auto-generated income for agreement: ${a.name}`);
                created++;

            } catch(e) {
                console.error("Error auto-generating agreement income:", e);
            }
        }
        
        if(created > 0) {
            Swal.fire({
                toast: true,
                position: 'top-end',
                icon: 'info',
                title: `${created} Ingresos recurrentes generados automáticamente.`,
                showConfirmButton: false,
                timer: 4000
            });
        }
    }
    
    // Update loadAgreements to call this
    // We need to inject the call inside the onSnapshot
    // We can do it by redefining loadAgreements or just ensuring it's called.
    // Let's redefine loadAgreements slightly to include it.



    // Make sure applyFilters calls renderMonthlyControl
    // We can just overwrite the listener assignment
    const oldApply = applyFilters;
    // Actually, I redefined applyFilters above completely.
    // But I need to make sure the EVENT LISTENERS call logic that *includes* renderMonthlyControl.
    // The previous tool call set listeners to 'applyFilters'.
    // So if I redefine applyFilters, it works.
    
    // BUT I need to add the call to renderMonthlyControl inside the new applyFilters I just defined (lines 8-50 above).
    // I forgot to add it in the replacement content above? No, I am writing it now.
    
    // Correction:
    // I should modify the replacement content of applyFilters function to include `renderMonthlyControl();` at the end.
    
    // Since I cannot edit the previous replacement inside the tool call, I will do it correctly in THIS tool call's content.
    
    /* RE-WRITING THE REPLACEMENT CONTENT FOR CORRECTNESS */
    


    function calculateKPIs(data) {
        // Income
        const income = data.filter(t => t.type === 'INCOME');
        const incExpARS = income.reduce((acc, t) => t.currency === 'ARS' ? acc + t.amount : acc, 0);
        const incExpUSD = income.reduce((acc, t) => t.currency === 'USD' ? acc + t.amount : acc, 0);
        
        const incPendARS = income.filter(t => t.status !== 'PAID').reduce((acc, t) => t.currency === 'ARS' ? acc + t.amount : acc, 0);
        const incPendUSD = income.filter(t => t.status !== 'PAID').reduce((acc, t) => t.currency === 'USD' ? acc + t.amount : acc, 0);

        // Expense
        const expense = data.filter(t => t.type === 'EXPENSE');
        const expExpARS = expense.reduce((acc, t) => t.currency === 'ARS' ? acc + t.amount : acc, 0);
        const expExpUSD = expense.reduce((acc, t) => t.currency === 'USD' ? acc + t.amount : acc, 0);

        const expPendARS = expense.filter(t => t.status !== 'PAID').reduce((acc, t) => t.currency === 'ARS' ? acc + t.amount : acc, 0);
        const expPendUSD = expense.filter(t => t.status !== 'PAID').reduce((acc, t) => t.currency === 'USD' ? acc + t.amount : acc, 0);

        // Savings
        const savings = data.filter(t => t.type === 'SAVING');

        // Net Balance Calculation (Paid Income - Paid Expenses)
        // Note: Savings are "money set aside" but technically still an asset.
        // The user asked for "Income - Expense" balance.
        
        const incomePaidARS = income.filter(t => t.status === 'PAID').reduce((acc, t) => t.currency === 'ARS' ? acc + t.amount : acc, 0);
        const incomePaidUSD = income.filter(t => t.status === 'PAID').reduce((acc, t) => t.currency === 'USD' ? acc + t.amount : acc, 0);
        
        const expensePaidARS = expense.filter(t => t.status === 'PAID').reduce((acc, t) => t.currency === 'ARS' ? acc + t.amount : acc, 0);
        const expensePaidUSD = expense.filter(t => t.status === 'PAID').reduce((acc, t) => t.currency === 'USD' ? acc + t.amount : acc, 0);

        const balanceARS = incomePaidARS - expensePaidARS;
        const balanceUSD = incomePaidUSD - expensePaidUSD;

        // Savings Total (Active)
        const savingsTotalARS = savings.filter(t => t.status !== 'USED').reduce((acc, t) => t.currency === 'ARS' ? acc + t.amount : acc, 0);
        const savingsTotalUSD = savings.filter(t => t.status !== 'USED').reduce((acc, t) => t.currency === 'USD' ? acc + t.amount : acc, 0);

        // Update DOM
        updateKPI('kpi-balance-ars', balanceARS);
        updateKPI('kpi-balance-usd', balanceUSD);
        
        updateKPI('kpi-savings-ars', savingsTotalARS);
        updateKPI('kpi-savings-usd', savingsTotalUSD);

        updateKPI('kpi-income-expected-ars', incExpARS);
        updateKPI('kpi-income-expected-usd', incExpUSD);
        updateKPI('kpi-income-pending-ars', incPendARS);
        updateKPI('kpi-income-pending-usd', incPendUSD);
        
        updateKPI('kpi-expense-expected-ars', expExpARS);
        updateKPI('kpi-expense-expected-usd', expExpUSD);
        updateKPI('kpi-expense-pending-ars', expPendARS);
        updateKPI('kpi-expense-pending-usd', expPendUSD);
    }

    function updateKPI(id, val) {
        // Simple animation or just set text
        document.getElementById(id).textContent = new Intl.NumberFormat('es-AR').format(val);
    }

    function renderTables(data) {
        const tBodyInc = document.querySelector('#table-income tbody');
        const tBodyExp = document.querySelector('#table-expense tbody');
        const tBodySav = document.querySelector('#table-saving tbody');
        
        tBodyInc.innerHTML = '';
        tBodyExp.innerHTML = '';
        tBodySav.innerHTML = '';

        const createRow = (t, isSaving = false) => {
            const dateStr = parseDate(t.date).toLocaleDateString();
            const amountStr = formatCurrency(t.amount, t.currency);
            
            let statusBadge = 'badge bg-warning text-dark';
            let statusLabel = 'Pendiente';
            if(t.status === 'PAID') { statusBadge = 'badge bg-success'; statusLabel = 'Cobrado/Pagado'; }
            if(t.status === 'USED') { statusBadge = 'badge bg-secondary'; statusLabel = 'Usado'; }

            if (isSaving) {
                 return `
                    <tr>
                        <td>${dateStr}</td>
                        <td>
                            <h6 class="mb-0 font-size-14 text-truncate">${t.entityName}</h6>
                        </td>
                        <td><span class="badge badge-soft-primary">${t.category}</span></td>
                        <td>${t.address || '-'}</td>
                        <td>${t.currency === 'ARS' ? amountStr : '-'}</td>
                        <td>${t.currency === 'USD' ? amountStr : '-'}</td>
                        <td><div class="${statusBadge}">${statusLabel}</div></td>
                        <td>
                            <div class="d-flex gap-2">
                                ${ t.status !== 'USED' ? `<button class="btn btn-sm btn-info" onclick="useSavingForExpense('${t.id}')" title="Usar para Gasto"><i class="mdi mdi-arrow-right-bold-circle-outline"></i> Mover a Gasto</button>` : '' }
                                <button class="btn btn-sm btn-soft-danger" onclick="deleteTransaction('${t.id}')"><i class="mdi mdi-trash-can"></i></button>
                            </div>
                        </td>
                    </tr>
                 `;
            }

            // Normal Income/Expense
            const btnAction = t.status === 'PENDING' 
                ? `<button class="btn btn-sm btn-soft-success" onclick="toggleStatus('${t.id}', 'PAID')" title="Marcar como Completado"><i class="bx bx-check"></i></button>`
                : `<button class="btn btn-sm btn-soft-warning" onclick="toggleStatus('${t.id}', 'PENDING')" title="Marcar Pendiente"><i class="bx bx-undo"></i></button>`;

            return `
                <tr>
                    <td>${dateStr}</td>
                    <td>
                        <h6 class="mb-0 font-size-14 text-truncate">${t.entityName}</h6>
                        <small class="text-muted text-truncate">${t.cuit || '-'}</small>
                    </td>
                    <td><span class="badge badge-soft-primary">${t.category}</span></td>
                    <td>${t.address || '-'}</td>
                    <td>${t.currency === 'ARS' ? amountStr : '-'}</td>
                    <td>${t.currency === 'USD' ? amountStr : '-'}</td>
                    <td>${t.isRecurring ? '<i class="bx bx-revision text-primary"></i>' : '-'}</td>
                    <td><div class="${statusBadge}">${statusLabel}</div></td>
                    <td>
                        <div class="d-flex gap-2">
                            ${btnAction}
                            <button class="btn btn-sm btn-soft-danger" onclick="deleteTransaction('${t.id}')"><i class="mdi mdi-trash-can"></i></button>
                        </div>
                    </td>
                </tr>
            `;
        };

        // Render Incomes
        data.filter(t => t.type === 'INCOME').forEach(t => {
            tBodyInc.innerHTML += createRow(t, false);
        });

        // Render Expenses
        data.filter(t => t.type === 'EXPENSE').forEach(t => {
             tBodyExp.innerHTML += createRow(t, false);
        });

        // Render Savings
        data.filter(t => t.type === 'SAVING').forEach(t => {
             tBodySav.innerHTML += createRow(t, true);
        });
    }

    // ==========================================
    // 7. Global Actions
    // ==========================================
    
    window.toggleStatus = function(id, newStatus) {
         db.collection('transactions').doc(id).update({ status: newStatus });
    };

    window.deleteTransaction = function(id) {
        Swal.fire({
            title: '¿Eliminar?',
            text: "No podrás revertir esto.",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#f46a6a',
            cancelButtonText: 'Cancelar'
        }).then((result) => {
            if (result.isConfirmed) {
                db.collection('transactions').doc(id).delete();
            }
        });
    };

    window.useSavingForExpense = async function(savingId) {
        // Logic:
        // 1. Get the saving data
        // 2. Open Expense Modal pre-filled
        // 3. Mark saving as USED (or delete it? The user said "Mover a gasto", implying transformation)
        // Better: Convert directly confirms "Are you sure you want to use this saving for an expense?"
        // Then delete the saving and create an expense.
        
        const saving = allTransactions.find(t => t.id === savingId);
        if(!saving) return;

        Swal.fire({
            title: '¿Mover Ahorro a Gasto?',
            text: `Esto convertirá el ahorro "${saving.entityName}" en un Gasto.`,
            icon: 'question',
            showCancelButton: true,
            confirmButtonText: 'Sí, convertir',
            cancelButtonText: 'Cancelar'
        }).then(async (result) => {
            if (result.isConfirmed) {
                 // Open Modal as Expense but with pre-filled Data
                 // Actually, let's just update the doc type to EXPENSE effectively "moving" it.
                 // But Expenses have "Provider", Savings have "Name".
                 // Let's open the modal so user can adjust details (e.g. set the Provider name instead of Saving Name)
                 
                 openModal('EXPENSE');
                 // Pre-fill
                 setTimeout(() => {
                     document.getElementById('tx-amount').value = saving.amount;
                     document.getElementById('tx-currency').value = saving.currency;
                     document.getElementById('tx-entity-name').value = saving.entityName + " (Pago con Ahorro)";
                     document.getElementById('tx-category').value = saving.category;
                 }, 200);

                 // Delete the old saving automatically upon successful save? 
                 // It's tricky with the current generic SAVE handler.
                 // Alternative: Update the doc directly to Type=EXPENSE.
                 // Let's try the direct update approach for simplicity.
                 
                 /*
                 await db.collection('transactions').doc(savingId).update({
                     type: 'EXPENSE',
                     status: 'PAID', // Usually if you use savings, you pay immediately
                     entityName: saving.entityName + " (Usado)"
                 });
                 */
                 
                 // Re-reading user request: "possibility to move or transfer savings to an expense".
                 // Let's do: Delete Saving -> Open Modal pre-filled.
                 // No, that's risky if they cancel modal.
                 
                 // Ideal: Open Modal. Add a hidden field "originSavingId". 
                 // Modify Submit handler: if originSavingId is present, delete that doc after successful add.
                 
                 // Let's inject a hidden field processing into form handler.
                 // Since I cannot change HTML easily right now without another call, 
                 // I will use a global variable or dataset on the form.
                 
                 formTx.dataset.originSavingId = savingId;
                 
                 // Pre-fill
                 document.getElementById('tx-entity-name').value = saving.entityName;
                 document.getElementById('tx-amount').value = saving.amount;
                 document.getElementById('tx-currency').value = saving.currency;
                 
                 Swal.fire('Listo', 'Completa los datos del nuevo gasto.', 'info');
            }
        });
    }
    
    // Modify Submit Handler to check for originSavingId
    const originalSubmit = formTx.onsubmit; // Wait, I added event listener, not onsubmit property.
    // I need to hook into the existing listener... which is hard.
    // I can replace the listener logic by overwriting the element? No.
    // I can modify the existing `formTx.addEventListener('submit', ...)` block in the previous tool call?
    // No, I am in a multi_replace for lines 373+.
    
    // Workaround: I will re-implement the submit handler logic here and remove the old listener? 
    // Creating a new listener will just run AFTER the old one.
    
    // Let's just create a separate function `handleSaveTransaction` and call it from the listener.
    // Too much refactoring.
    
    // Alternative: The `useSavingForExpense` simply DELETEs the saving and CREATES the expense in one go?
    // "Convertir Ahorro en Gasto"
    // Updates transaction type to EXPENSE.
    // Ask user for Provider Name.
    
    window.convertSaving = async function(savingId) {
         const saving = allTransactions.find(t => t.id === savingId);
         if(!saving) return;
         
         const { value: provider } = await Swal.fire({
            title: 'Mover a Gasto',
            text: `Ingresa el nombre del Proveedor/Entidad para este gasto:`,
            input: 'text',
            inputValue: saving.entityName,
            showCancelButton: true,
            confirmButtonText: 'Convertir'
        });

        if (provider) {
             try {
                 await db.collection('transactions').doc(savingId).update({
                     type: 'EXPENSE',
                     entityName: provider,
                     status: 'PAID' // Assume paid if using savings
                 });
                 Swal.fire('Éxito', 'Ahorro convertido en gasto correctamente.', 'success');
             } catch (e) {
                 console.error(e);
                 Swal.fire('Error', e.message, 'error');
             }
        }
    }
    
    // Override the button action to use this new simpler function
    window.useSavingForExpense = window.convertSaving;


    // ==========================================
    // 8. AGREEMENTS MODULE (New)
    // ==========================================
    
    let agreements = [];
    const modalAgreements = new bootstrap.Modal(document.getElementById('agreement-modal'));
    const formAgreement = document.getElementById('form-agreement');

    async function loadAgreements() {
        // Real-time listener
        db.collection('cashflow_agreements').where('isActive', '!=', false).onSnapshot(snap => {
            agreements = [];
            snap.forEach(doc => agreements.push({ id: doc.id, ...doc.data() }));
            
            checkAgreementsDefaults(); 
            
            renderAgreementsList();
            renderMonthlyControl();
            
            processAutomaticAgreements(); // Auto-Run for Non-Invoiced
        });
    }

    // Call this in init
    // We'll append the call to loadAgreements() inside the Auth Check block at the top via another replace later, 
    // or just trigger it here if auth already valid (but better to be clean).
    // For now, let's expose it or run it check auth state.
    if(auth.currentUser) loadAgreements();
    // Also hook into the main Auth listener at line 16 if possible, but for now this works as script runs after auth loads usually.

    function checkAgreementsDefaults() {
        // Optional: Data migration if schema changes
    }

    // 8.2 UI Rendering
    function renderAgreementsList() {
        const tbody = document.querySelector('#table-agreements tbody');
        tbody.innerHTML = '';

        if(agreements.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" class="text-center text-muted">No hay acuerdos registrados.</td></tr>';
            return;
        }

        agreements.forEach(a => {
            const amountStr = formatCurrency(a.amount, a.currency);
            
            tbody.innerHTML += `
                <tr>
                    <td>
                        <h6 class="mb-0 text-truncate font-size-14">${a.name}</h6>
                        <small class="text-muted">${a.biller || '-'}</small>
                    </td>
                    <td>${a.cuit || '-'}</td>
                    <td>${a.description || '-'}</td>
                    <td><span class="badge ${a.frequency === 'MONTHLY' ? 'bg-info' : 'bg-secondary'}">${a.frequency === 'MONTHLY' ? 'Mensual' : 'Único'}</span></td>
                    <td class="fw-bold">${amountStr}</td>
                    <td>${a.lastUpdate || '-'}</td>
                    <td>
                        <button class="btn btn-sm btn-soft-primary" onclick="editAgreement('${a.id}')"><i class="mdi mdi-pencil"></i></button>
                    </td>
                </tr>
            `;
        });
    }

    function renderMonthlyControl() {
        const tbody = document.getElementById('monthly-control-list');
        tbody.innerHTML = '';
        
        // Filter: Only Recurring (Monthly) and Active
        const monthly = agreements.filter(a => a.frequency === 'MONTHLY');
        
        if(monthly.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" class="text-center text-muted">No hay acuerdos mensuales activos.</td></tr>';
            return;
        }

        const now = new Date();
        const currentPeriod = `${now.getFullYear()}-${(now.getMonth()+1).toString().padStart(2, '0')}`; // YYYY-MM

        monthly.forEach(a => {
            const amountStr = formatCurrency(a.amount, a.currency);
            
            // Check status for this period
            let isSent = false;
            let sentDate = null;
            if(a.invoices && a.invoices[currentPeriod] && a.invoices[currentPeriod].sent) {
                isSent = true;
                sentDate = a.invoices[currentPeriod].date;
            }

            // Checkbox logic
            // If sent, show Checked state. If disabled? Maybe allow unchecking? 
            // Better to allow toggle but confirm if unchecking (deleting income?).
            // Simplified: Allow toggle.
            
            const checkbox = `
                <div class="form-check form-switch mb-0">
                    <input class="form-check-input" type="checkbox" id="check-invoice-${a.id}" ${isSent ? 'checked' : ''} onchange="toggleInvoiceSent('${a.id}', '${currentPeriod}', this)">
                    <label class="form-check-label text-muted small" for="check-invoice-${a.id}">${isSent ? 'Enviada' : 'Pendiente'}</label>
                </div>
            `;

            tbody.innerHTML += `
                <tr class="${isSent ? 'bg-success-subtle' : ''}">
                    <td><strong>${a.name}</strong></td>
                    <td>${amountStr}</td>
                    <td>${a.biller || 'S/D'}</td>
                    <td>${checkbox}</td>
                </tr>
            `;
        });
    }

    // 8.3 CRUD Logic

    document.getElementById('btn-new-agreement').addEventListener('click', () => {
        formAgreement.reset();
        document.getElementById('agreement-id').value = '';
        document.getElementById('agreement-modal-title').textContent = 'Nuevo Acuerdo';
        document.getElementById('btn-delete-agreement').classList.add('d-none');
        document.getElementById('agr-last-update').textContent = new Date().toISOString().split('T')[0];
        document.getElementById('agr-biller').value = 'Lucre'; // Default
        document.getElementById('div-biller').style.display = 'block'; // Show
        document.getElementById('agr-currency').value = 'ARS';
        document.getElementById('agr-frequency').value = 'MONTHLY';
        document.getElementById('agr-hasInvoice').value = 'true';
        modalAgreements.show();
    });

    // Biller Toggle Logic
    document.getElementById('agr-hasInvoice').addEventListener('change', (e) => {
        const div = document.getElementById('div-biller');
        const select = document.getElementById('agr-biller');
        if(e.target.value === 'true') {
             div.style.display = 'block';
             select.value = 'Lucre'; // Default or keep previous?
        } else {
             div.style.display = 'none';
             select.value = ''; // Clear
        }
    });

    window.editAgreement = function(id) {
        const a = agreements.find(x => x.id === id);
        if(!a) return;

        document.getElementById('agreement-id').value = id;
        document.getElementById('agreement-modal-title').textContent = 'Editar Acuerdo';
        
        document.getElementById('agr-name').value = a.name;
        document.getElementById('agr-cuit').value = a.cuit || '';
        document.getElementById('agr-hasInvoice').value = a.hasInvoice ? 'true' : 'false';
        
        // Biller View State
        if (a.hasInvoice) {
            document.getElementById('div-biller').style.display = 'block';
            document.getElementById('agr-biller').value = a.biller || 'Lucre';
        } else {
            document.getElementById('div-biller').style.display = 'none';
            document.getElementById('agr-biller').value = '';
        }

        document.getElementById('agr-desc').value = a.description || '';
        document.getElementById('agr-frequency').value = a.frequency || 'MONTHLY';
        document.getElementById('agr-currency').value = a.currency || 'ARS';
        document.getElementById('agr-amount').value = a.amount;
        document.getElementById('agr-last-update').textContent = a.lastUpdate || '-';
        
        document.getElementById('btn-delete-agreement').classList.remove('d-none');
        modalAgreements.show();
    };

    formAgreement.addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = document.getElementById('agreement-id').value;
        const btn = document.getElementById('btn-save-agreement');
        
        btn.disabled = true;
        btn.innerHTML = '<i class="bx bx-loader bx-spin"></i>';

        try {
            const data = {
                name: document.getElementById('agr-name').value,
                cuit: document.getElementById('agr-cuit').value,
                hasInvoice: document.getElementById('agr-hasInvoice').value === 'true',
                biller: document.getElementById('agr-biller').value,
                description: document.getElementById('agr-desc').value,
                frequency: document.getElementById('agr-frequency').value,
                currency: document.getElementById('agr-currency').value,
                amount: parseFloat(document.getElementById('agr-amount').value) || 0,
                lastUpdate: document.getElementById('agr-last-update').textContent,
                isActive: true, // Soft delete logic
                updatedAt: new Date()
            };

            if(id) {
                await db.collection('cashflow_agreements').doc(id).update(data);
            } else {
                data.createdAt = new Date();
                data.invoices = {}; // Init map
                await db.collection('cashflow_agreements').add(data);
            }
            
            modalAgreements.hide();
            Swal.fire('Guardado', 'El acuerdo se actualizó correctamente.', 'success');

        } catch(err) {
            console.error(err);
            Swal.fire('Error', 'No se pudo guardar: ' + err.message, 'error');
        } finally {
            btn.disabled = false;
            btn.textContent = 'Guardar Acuerdo';
        }
    });

    document.getElementById('btn-delete-agreement').addEventListener('click', async () => {
        const id = document.getElementById('agreement-id').value;
        if(!id) return;
        
        /* 
        // Hard Delete
        if(confirm('¿Eliminar Acuerdo?')) {
             await db.collection('cashflow_agreements').doc(id).delete();
             modalAgreements.hide();
        }
        */
       // Soft Delete prefered
       Swal.fire({
            title: '¿Archivar Acuerdo?',
            text: "No aparecerá en los listados activos.",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: 'Sí, archivar',
            cancelButtonText: 'Cancelar'
       }).then(async (res) => {
           if(res.isConfirmed) {
               await db.collection('cashflow_agreements').doc(id).update({ isActive: false });
               modalAgreements.hide();
           }
       });
    });

    // 8.4 Calculator Logic
    document.getElementById('btn-calc-update').addEventListener('click', () => {
        const inputAmount = document.getElementById('agr-amount');
        const inputPercent = document.getElementById('agr-calc-percent');
        const labelDate = document.getElementById('agr-last-update');

        const currentVal = parseFloat(inputAmount.value) || 0;
        const pct = parseFloat(inputPercent.value) || 0;

        if(pct === 0) return;

        const newVal = currentVal + (currentVal * (pct / 100));
        inputAmount.value = newVal.toFixed(2);
        
        // Update Label Date
        labelDate.textContent = new Date().toISOString().split('T')[0];
        
        // Optional: Highlight change
        inputAmount.classList.add('is-valid');
        setTimeout(() => inputAmount.classList.remove('is-valid'), 2000);
        
        inputPercent.value = ''; // clear
    });

    // 8.5 Automated Invoice Logic (The "Magic")
    window.toggleInvoiceSent = async function(agreementId, periodKey, checkbox) {
         const isChecked = checkbox.checked;
         const agreement = agreements.find(a => a.id === agreementId);
         
         if(!agreement) { checkbox.checked = !isChecked; return; }

         try {
             const agRef = db.collection('cashflow_agreements').doc(agreementId);
             
             if(isChecked) {
                 // 1. Generate Income Transaction
                 const newTx = {
                      type: 'INCOME',
                      entityName: agreement.name,
                      cuit: agreement.cuit,
                      address: 'Facturación Mensual Automática', // Description/Address
                      category: 'Honorarios', // Default? Or 'Ventas'? 'Honorarios' fits service agreements.
                      status: 'PENDING', // Invoice sent, but maybe not paid yet? User said "se agregó a ingresos", usually implies "Expected Income".
                      currency: agreement.currency,
                      amount: agreement.amount,
                      date: firebase.firestore.Timestamp.fromDate(new Date()), // Today
                      isRecurring: false, // It's generated from an agreement, not the transaction recurrence engine
                      agreementId: agreementId,
                      periodKey: periodKey,
                      createdAt: new Date(),
                      createdBy: auth.currentUser.uid
                 };
                 
                 const docRef = await db.collection('transactions').add(newTx);
                 
                 // 2. Mark in Agreement
                 const updateMap = {};
                 updateMap[`invoices.${periodKey}`] = {
                     sent: true,
                     date: new Date().toISOString().split('T')[0],
                     incomeId: docRef.id
                 };
                 await agRef.update(updateMap);
                 
                 Swal.fire({
                     toast: true,
                     position: 'top-end',
                     icon: 'success',
                     title: 'Ingreso generado y Factura marcada.',
                     showConfirmButton: false,
                     timer: 3000
                 });

             } else {
                 // 1. Uncheck: Delete the generated income?
                 // Checking if we stored the ID.
                 const invoiceData = agreement.invoices ? agreement.invoices[periodKey] : null;
                 
                 if(invoiceData && invoiceData.incomeId) {
                     // Ask confirmation
                     const confirm = await Swal.fire({
                         title: '¿Deshacer?',
                         text: "Esto borrará el ingreso generado automáticamente.",
                         icon: 'warning',
                         showCancelButton: true,
                         confirmButtonText: 'Sí, borrar ingreso'
                     });
                     
                     if(!confirm.isConfirmed) {
                         checkbox.checked = true; // Revert UI
                         return; 
                     }
                     
                     // Delete
                     await db.collection('transactions').doc(invoiceData.incomeId).delete();
                 }
                 
                 // 2. Update Agreement
                 const updateMap = {};
                 updateMap[`invoices.${periodKey}`] = firebase.firestore.FieldValue.delete(); // Remove the key
                 await agRef.update(updateMap);
             }
             
         } catch(e) {
             console.error(e);
             checkbox.checked = !isChecked; // Revert UI
             Swal.fire('Error', e.message, 'error');
         }
    };


});
