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

    const incomeModal = new bootstrap.Modal(document.getElementById('modal-income'));
    const expenseModal = new bootstrap.Modal(document.getElementById('modal-expense'));
    const savingModal = new bootstrap.Modal(document.getElementById('modal-saving'));
    const transferModal = new bootstrap.Modal(document.getElementById('modal-saving-transfer'));
    
    let allTransactions = [];
    let categories = { INCOME: [], EXPENSE: [], SAVING: [] }; 
    let entities = { INCOME: [], EXPENSE: [] }; 

    // Concurrency Guards
    let isCheckingRecurrences = false;
    let isProcessingAgreements = false;
    let hasRunRecurrenceThisSession = false;

    // Sorting State
    let sortConfig = {
        INCOME: { column: 'date', direction: 'desc' },
        EXPENSE: { column: 'date', direction: 'desc' },
        SAVING: { column: 'date', direction: 'desc' }
    };

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

    // Recurrence/Installments Toggle Logic
    const initRecurrenceToggles = () => {
        const setups = [
            { check: 'in-recurring', container: 'container-in-installments' },
            { check: 'ex-recurring', container: 'container-ex-installments' },
            { check: 'sav-recurring', container: 'container-sav-installments' }
        ];

        setups.forEach(s => {
            const el = document.getElementById(s.check);
            const container = document.getElementById(s.container);
            if (el && container) {
                el.addEventListener('change', () => {
                    container.style.display = el.checked ? 'block' : 'none';
                    if (!el.checked) {
                        const input = container.querySelector('input');
                        if (input) input.value = '';
                    }
                });
            }
        });
    };
    initRecurrenceToggles();

    // ==========================================
    // 3. Categories Logic
    // ==========================================
    
    // Versión del Script: 3.1 (Separación de categorías mejorada)
    async function initCategories() {
        const defaultIncomeCategories = ['Ventas', 'Honorarios', 'Otros'];
        const defaultExpenseCategories = ['Alquiler', 'Expensas', 'Servicios', 'Sueldos', 'Impuestos', 'Otros'];
        const defaultSavingCategories = ['Fondo de Reserva', 'Inversión', 'Viajes', 'Bienes', 'Otros'];
        
        categories = { INCOME: [], EXPENSE: [], SAVING: [] };

        try {
            const collectionRef = db.collection('cashflow_categories');
            const snap = await collectionRef.orderBy('createdAt', 'asc').get();
            
            const existingNames = { INCOME: new Set(), EXPENSE: new Set(), SAVING: new Set() };
            const batch = db.batch();
            let hasMigration = false;
            
            snap.forEach(doc => {
                const d = doc.data();
                let type = d.type;
                
                // Si el tipo no existe, lo inferimos y lo guardamos PERMANENTEMENTE en la DB
                if (!type) {
                    if (defaultExpenseCategories.includes(d.name)) type = 'EXPENSE';
                    else type = 'INCOME';
                    
                    batch.update(doc.ref, { type: type });
                    hasMigration = true;
                }

                if (!existingNames[type]) existingNames[type] = new Set();
                
                existingNames[type].add(d.name);
                if (d.active !== false) {
                    if (!categories[type].includes(d.name)) {
                        categories[type].push(d.name);
                    }
                }
            });

            const checkDefaults = (defaults, type) => {
                defaults.forEach(defCat => {
                    if (!existingNames[type].has(defCat)) {
                        const newRef = collectionRef.doc();
                        batch.set(newRef, {
                            name: defCat,
                            type: type,
                            active: true,
                            createdAt: new Date(),
                            createdBy: 'SYSTEM'
                        });
                        categories[type].push(defCat);
                        existingNames[type].add(defCat);
                        hasMigration = true;
                    }
                });
            };

            checkDefaults(defaultIncomeCategories, 'INCOME');
            checkDefaults(defaultExpenseCategories, 'EXPENSE');
            checkDefaults(defaultSavingCategories, 'SAVING');

            if (hasMigration) {
                await batch.commit();
                console.log("Categorías sincronizadas y tipos actualizados permanentemente.");
            }
            
            categories.INCOME.sort();
            categories.EXPENSE.sort();
            categories.SAVING.sort();

        } catch (error) {
            console.error("Error loading categories:", error);
            if(categories.INCOME.length === 0) categories.INCOME = [...defaultIncomeCategories];
            if(categories.EXPENSE.length === 0) categories.EXPENSE = [...defaultExpenseCategories];
            if(categories.SAVING.length === 0) categories.SAVING = [...defaultSavingCategories];
        }

        renderCategoryOptions('INCOME');
        renderCategoryOptions('EXPENSE');
        renderCategoryOptions('SAVING');
        updateGlobalFilterCategories(); 
    }

    function renderCategoryOptions(type) {
        let selectId = '';
        if (type === 'INCOME') selectId = 'in-category';
        else if (type === 'EXPENSE') selectId = 'ex-category';
        else if (type === 'SAVING') selectId = 'sav-category';

        const select = document.getElementById(selectId);
        if(!select) return;
        
        select.innerHTML = '<option value="">Seleccione...</option>';
        categories[type].forEach(c => {
            select.innerHTML += `<option value="${c}">${c}</option>`;
        });
    }

    function updateGlobalFilterCategories() {
        const filterSelect = document.getElementById('filter-category');
        if (filterSelect) {
            const currentVal = filterSelect.value;
            filterSelect.innerHTML = '<option value="ALL">Todas</option>';
            const allCats = [...new Set([...categories.INCOME, ...categories.EXPENSE])].sort();
            allCats.forEach(c => {
                filterSelect.innerHTML += `<option value="${c}">${c}</option>`;
            });
            if(currentVal) filterSelect.value = currentVal;
        }
    }

    // Generic Category Add Logic using delegation
    // Category UI Handlers (Event Delegation for robustness)
    document.addEventListener('click', async (e) => {
        const target = e.target.closest('button');
        if (!target) return;

        // 1. Add Category Button (Plus)
        if (target.classList.contains('btn-add-category')) {
            const type = target.dataset.type;
            let containerId = '';
            if (type === 'INCOME') containerId = 'container-new-category-in';
            else if (type === 'EXPENSE') containerId = 'container-new-category-ex';
            else if (type === 'SAVING') containerId = 'container-new-category-sav';

            const container = document.getElementById(containerId);
            if (container) {
                const input = container.querySelector('.input-new-cat');
                container.style.display = 'block';
                if (input) input.focus();
            }
        }

        // 2. Cancel New Category
        if (target.classList.contains('btn-cancel-new-cat')) {
            const container = target.closest('.container-new-cat');
            if (container) container.style.display = 'none';
        }

        // 3. Save New Category
        if (target.classList.contains('btn-save-new-cat')) {
            const type = target.dataset.type;
            const container = target.closest('.container-new-cat');
            const input = container.querySelector('.input-new-cat');
            const cat = input.value.trim();
            if(!cat) return;

            const btnSave = target;
            const originalHTML = btnSave.innerHTML;

            try {
                btnSave.innerHTML = '<i class="bx bx-loader bx-spin"></i>';
                btnSave.disabled = true;

                await db.collection('cashflow_categories').add({
                    name: cat,
                    type: type,
                    active: true,
                    createdAt: new Date(),
                    createdBy: auth.currentUser.uid
                });

                categories[type].push(cat);
                categories[type].sort();
                renderCategoryOptions(type);
                updateGlobalFilterCategories();
                
                const selectId = type === 'INCOME' ? 'in-category' : (type === 'EXPENSE' ? 'ex-category' : 'sav-category');
                const sel = document.getElementById(selectId);
                if (sel) sel.value = cat;
                
                container.style.display = 'none';
                input.value = '';
                
            } catch (error) {
                console.error(error);
                Swal.fire('Error', 'No se pudo guardar la categoría.', 'error');
            } finally {
                btnSave.innerHTML = originalHTML;
                btnSave.disabled = false;
            }
        }

        // 4. Manage Categories Button (Gear)
        if (target.classList.contains('btn-manage-categories')) {
            currentManageType = target.dataset.type;
            await loadManageCategories(currentManageType);
            modalManage.show();
        }
    });

    // Initialize Management Modal
    const modalManage = new bootstrap.Modal(document.getElementById('modal-manage-categories'));
    let currentManageType = 'INCOME';

    async function loadManageCategories(type) {
         const tbody = document.querySelector('#table-manage-categories tbody');
         tbody.innerHTML = '<tr><td>Cargando...</td></tr>';
         
         const title = document.querySelector('#modal-manage-categories .modal-title');
         let typeLabel = 'Ingresos';
         if (type === 'EXPENSE') typeLabel = 'Gastos';
         else if (type === 'SAVING') typeLabel = 'Ahorros';
         
         if(title) title.textContent = `Gestionar Categorías (${typeLabel})`;

         try {
             // Fetch DB categories for this specific type
             // Removed .orderBy('createdAt', 'desc') to avoid index requirement
             const snap = await db.collection('cashflow_categories')
                                    .where('type', '==', type)
                                    .get();
             
             tbody.innerHTML = '';
             
             // Convert to array and sort client-side
             const dbCats = [];
             snap.forEach(doc => {
                 dbCats.push({ id: doc.id, ...doc.data() });
             });

             // Sort by createdAt descending
             dbCats.sort((a, b) => {
                 const dateA = a.createdAt ? (a.createdAt.toDate ? a.createdAt.toDate() : new Date(a.createdAt)) : new Date(0);
                 const dateB = b.createdAt ? (b.createdAt.toDate ? b.createdAt.toDate() : new Date(b.createdAt)) : new Date(0);
                 return dateB - dateA;
             });
             
             dbCats.forEach(d => {
                 if(d.active === false) return; 
                 
                 tbody.innerHTML += `
                    <tr>
                        <td class="align-middle">${d.name}</td>
                        <td class="text-end">
                            <button class="btn btn-sm btn-soft-danger" onclick="softDeleteCategory('${d.id}', '${d.name}', '${type}')">
                                <i class="mdi mdi-trash-can-outline"></i>
                            </button>
                        </td>
                    </tr>
                 `;
             });
             
             if(tbody.innerHTML === '') tbody.innerHTML = '<tr><td colspan="2" class="text-center text-muted">No hay categorías personalizadas para este tipo.</td></tr>';
             
         } catch(e) {
             console.error(e);
             tbody.innerHTML = '<tr><td>Error al cargar.</td></tr>';
         }
    }

    window.softDeleteCategory = async function(id, name, type) {
        if(confirm(`¿Eliminar "${name}" del selector?`)) {
            await db.collection('cashflow_categories').doc(id).update({ active: false });
            
            // Update local array
            categories[type] = categories[type].filter(c => c !== name);
            renderCategoryOptions(type);
            
            // Reload list
            loadManageCategories(type);
        }
    }


    // ==========================================
    // 4. Transaction CRUD
    // ==========================================

    const formTx = document.getElementById('form-transaction');
    const btnNewIncome = document.getElementById('btn-new-income');
    const btnNewExpense = document.getElementById('btn-new-expense');
    const btnNewSaving = document.getElementById('btn-new-saving');
    const btnTransferSaving = document.getElementById('btn-transfer-saving');

    if(btnNewIncome) btnNewIncome.addEventListener('click', () => openModal('INCOME'));
    if(btnNewExpense) btnNewExpense.addEventListener('click', () => openModal('EXPENSE'));
    if(btnNewSaving) btnNewSaving.addEventListener('click', () => openModal('SAVING'));
    if(btnTransferSaving) btnTransferSaving.addEventListener('click', openTransferModal);

    const formTransfer = document.getElementById('form-transfer-saving');
    if(formTransfer) formTransfer.addEventListener('submit', handleTransferSubmit);
    const selectSource = document.getElementById('trans-source');
    if(selectSource) selectSource.addEventListener('change', updateTransferCurrency);

    function openModal(type, data = null) {
        if (type === 'INCOME') {
            const form = document.getElementById('form-income');
            form.reset();
            document.getElementById('in-id').value = '';
            document.getElementById('in-date').valueAsDate = new Date();
            incomeModal.show();
        } else if (type === 'EXPENSE') {
            const form = document.getElementById('form-expense');
            form.reset();
            document.getElementById('ex-id').value = '';
            document.getElementById('ex-date').valueAsDate = new Date();
            expenseModal.show();
        } else if (type === 'SAVING') {
            const form = document.getElementById('form-saving');
            form.reset();
            document.getElementById('sav-id').value = '';
            document.getElementById('sav-date').valueAsDate = new Date();
            
            if (data) {
                document.getElementById('sav-id').value = data.id || '';
                document.getElementById('sav-name').value = data.entityName || '';
                document.getElementById('sav-amount').value = data.amount || 0;
                document.getElementById('sav-target-amount').value = data.targetAmount || '';
                document.getElementById('sav-currency').value = data.currency || 'ARS';
                document.getElementById('sav-category').value = data.category || 'Fondo de Reserva';
                document.getElementById('sav-status').value = data.status || 'ACTIVE';
                document.getElementById('sav-is-initial').checked = data.isInitial || false;
                document.getElementById('sav-recurring').checked = data.isRecurring || false;
                if (data.isRecurring) {
                    document.getElementById('container-sav-installments').style.display = 'block';
                    document.getElementById('sav-installments').value = data.installmentsTotal || '';
                }
                if(data.date) document.getElementById('sav-date').valueAsDate = parseDate(data.date);
                document.getElementById('sav-address').value = data.address || '';
            }
            
            savingModal.show();
        }
    }


    // ==========================================
    // 5. Entities Registry
    // ==========================================
    
    async function initEntities() {
         const listIn = document.getElementById('list-entities-income');
         const listEx = document.getElementById('list-entities-expense');
         if(listIn) listIn.innerHTML = '';
         if(listEx) listEx.innerHTML = '';
         
         entities = { INCOME: [], EXPENSE: [] };
         
         try {
             const snap = await db.collection('cashflow_entities').orderBy('name').get();
             snap.forEach(doc => {
                 const d = doc.data();
                 // Default to BOTH for old records to ensure they appear in one of the lists
                 const type = d.type || 'BOTH';
                 
                 const addToList = (list, typeKey) => {
                     if(list) {
                         const opt = document.createElement('option');
                         opt.value = d.name;
                         list.appendChild(opt);
                         if (!entities[typeKey].includes(d.name)) {
                             entities[typeKey].push(d.name);
                         }
                     }
                 };

                 if(type === 'CLIENT' || type === 'BOTH') addToList(listIn, 'INCOME');
                 if(type === 'PROVIDER' || type === 'BOTH') addToList(listEx, 'EXPENSE');
             });
         } catch(e) {
             console.error("Error loading entities", e);
         }
    }

    async function checkAndSaveEntity(name, typeHint) {
        if(!name) return;
        const targetType = typeHint === 'INCOME' ? 'CLIENT' : 'PROVIDER';
        const typeKey = typeHint;
        
        const exists = entities[typeKey].some(e => e.toLowerCase() === name.toLowerCase());
        
        if(!exists) {
            try {
                await db.collection('cashflow_entities').add({
                    name: name,
                    type: targetType, 
                    createdAt: new Date(),
                    createdBy: auth.currentUser.uid
                });
                
                entities[typeKey].push(name);
                const listId = typeHint === 'INCOME' ? 'list-entities-income' : 'list-entities-expense';
                const datalist = document.getElementById(listId);
                if(datalist) {
                    const opt = document.createElement('option');
                    opt.value = name;
                    datalist.appendChild(opt);
                }
                
                console.log(`New entity ${name} saved as ${targetType}.`);
            } catch(e) {
                console.error("Error auto-saving entity", e);
            }
        }
    }

    // --- SUBMIT HANDLERS ---

    async function handleTxSubmit(e, type) {
        e.preventDefault();
        const prefix = type === 'INCOME' ? 'in' : 'ex';
        const form = e.target;
        const btnSave = form.querySelector('button[type="submit"]');
        const originalText = btnSave.innerHTML;
        
        btnSave.disabled = true;
        btnSave.innerHTML = '<i class="bx bx-loader bx-spin"></i> Guardando...';

        try {
            const id = document.getElementById(`${prefix}-id`).value;
            const entityName = document.getElementById(`${prefix}-entity-name`).value;
            
            await checkAndSaveEntity(entityName, type);

            const data = {
                type: type,
                entityName: entityName,
                cuit: document.getElementById(`${prefix}-cuit`).value,
                address: document.getElementById(`${prefix}-address`).value,
                category: document.getElementById(`${prefix}-category`).value,
                status: document.getElementById(`${prefix}-status`).value,
                currency: document.getElementById(`${prefix}-currency`).value,
                amount: parseFloat(document.getElementById(`${prefix}-amount`).value) || 0,
                date: firebase.firestore.Timestamp.fromDate(document.getElementById(`${prefix}-date`).valueAsDate || new Date()),
                isRecurring: document.getElementById(`${prefix}-recurring`).checked,
                installmentsTotal: parseInt(document.getElementById(`${prefix}-installments`).value) || null,
                installmentNumber: 1,
                updatedAt: new Date()
            };

            if (id) {
                await db.collection('transactions').doc(id).update(data);
            } else {
                data.createdAt = new Date();
                data.createdBy = auth.currentUser.uid;
                await db.collection('transactions').add(data);
            }

            const modal = type === 'INCOME' ? incomeModal : expenseModal;
            modal.hide();
            Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: 'Guardado correctamente.', showConfirmButton: false, timer: 3000 });

        } catch (error) {
            console.error(error);
            Swal.fire('Error', 'No se pudo guardar el movimiento: ' + error.message, 'error');
        } finally {
            btnSave.disabled = false;
            btnSave.innerHTML = originalText;
        }
    }

    document.getElementById('form-income').addEventListener('submit', (e) => handleTxSubmit(e, 'INCOME'));
    document.getElementById('form-expense').addEventListener('submit', (e) => handleTxSubmit(e, 'EXPENSE'));

    async function handleSavingSubmit(e) {
        e.preventDefault();
        const form = e.target;
        const btnSave = document.getElementById('btn-save-saving');
        const originalText = btnSave.innerHTML;
        
        btnSave.disabled = true;
        btnSave.innerHTML = '<i class="bx bx-loader bx-spin"></i> Guardando...';

        try {
            const id = document.getElementById('sav-id').value;
            const data = {
                type: 'SAVING',
                entityName: document.getElementById('sav-name').value,
                category: document.getElementById('sav-category').value,
                status: document.getElementById('sav-status').value,
                currency: document.getElementById('sav-currency').value,
                amount: parseFloat(document.getElementById('sav-amount').value) || 0,
                targetAmount: parseFloat(document.getElementById('sav-target-amount').value) || 0,
                isInitial: document.getElementById('sav-is-initial').checked,
                isRecurring: document.getElementById('sav-recurring').checked,
                date: firebase.firestore.Timestamp.fromDate(document.getElementById('sav-date').valueAsDate || new Date()),
                address: document.getElementById('sav-address').value,
                installmentsTotal: parseInt(document.getElementById('sav-installments').value) || null,
                installmentNumber: 1,
                updatedAt: new Date()
            };

            if (id) {
                await db.collection('transactions').doc(id).update(data);
            } else {
                data.createdAt = new Date();
                data.createdBy = auth.currentUser.uid;
                await db.collection('transactions').add(data);
            }

            savingModal.hide();
            Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: 'Ahorro guardado.', showConfirmButton: false, timer: 3000 });
        } catch (error) {
            console.error(error);
            Swal.fire('Error', 'No se pudo guardar el ahorro.', 'error');
        } finally {
            btnSave.disabled = false;
            btnSave.innerHTML = originalText;
        }
    }
    document.getElementById('form-saving').addEventListener('submit', handleSavingSubmit);

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
        if (isCheckingRecurrences || hasRunRecurrenceThisSession) return;
        isCheckingRecurrences = true;

        try {
            const recurringParents = transactions.filter(t => t.isRecurring && !t.parentRecurringId); 
            const today = new Date();
            const startOfCurrentMonth = new Date(today.getFullYear(), today.getMonth(), 1);
            let createdCount = 0;

            for (const parent of recurringParents) {
                const parentDate = parseDate(parent.date);
                
                // Skip if parent is already in the current month or future
                if (parentDate >= startOfCurrentMonth) continue;

                const AlreadyExists = transactions.find(t => 
                    t.parentRecurringId === parent.id && 
                    parseDate(t.date).getMonth() === today.getMonth() &&
                    parseDate(t.date).getFullYear() === today.getFullYear()
                );

                if (!AlreadyExists) {
                    const childrenCount = transactions.filter(t => t.parentRecurringId === parent.id).length;
                    
                    // Installment limit check
                    if (parent.installmentsTotal && (childrenCount + 1 >= parent.installmentsTotal)) {
                        continue;
                    }

                    const newDate = new Date(today.getFullYear(), today.getMonth(), 1); 
                    
                    const childData = { ...parent };
                    delete childData.id;
                    delete childData.createdAt; 
                    
                    childData.isRecurring = false; 
                    childData.parentRecurringId = parent.id;
                    childData.status = parent.type === 'SAVING' ? 'ACTIVE' : 'PENDING'; 
                    childData.date = newDate;
                    childData.createdAt = new Date();
                    childData.description = `${parent.address || ''} (Recurrente Mes ${today.getMonth()+1})`; 
                    
                    if (parent.installmentsTotal) {
                        childData.installmentNumber = childrenCount + 2;
                    }

                    if (parent.type === 'SAVING') childData.isInitial = false; 

                    console.log("Generating recurring tx for", parent.entityName, parent.installmentsTotal ? `(Cuota ${childData.installmentNumber}/${parent.installmentsTotal})` : '');
                    await db.collection('transactions').add(childData);
                    createdCount++;
                }
            }
            
            if(createdCount > 0) console.log(`Generated ${createdCount} recurring transactions.`);
            hasRunRecurrenceThisSession = true;
        } catch (error) {
            console.error("Error in checkRecurrences:", error);
        } finally {
            isCheckingRecurrences = false;
        }
    }

    // ==========================================
    // 6. Filters & Render
    // ==========================================

    const filterYear = document.getElementById('filter-year');
    const filterPeriod = document.getElementById('filter-period');
    const filterSearch = document.getElementById('filter-search');
    const filterCategory = document.getElementById('filter-category');
    const filterOnlyRecurring = document.getElementById('filter-only-recurring');
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
    [filterYear, filterPeriod, filterCategory, filterOnlyRecurring].forEach(el => el.addEventListener('change', applyFilters));
    
    // --- SORTING EVENT LISTENERS ---
    function initSortingListeners() {
        const tables = ['table-income', 'table-expense', 'table-saving'];
        tables.forEach(tableId => {
            const table = document.getElementById(tableId);
            if (!table) return;

            const headers = table.querySelectorAll('th[data-sort]');
            headers.forEach(th => {
                th.style.cursor = 'pointer';
                th.addEventListener('click', () => {
                    const type = tableId.split('-')[1].toUpperCase();
                    const column = th.dataset.sort;
                    
                    if (sortConfig[type].column === column) {
                        sortConfig[type].direction = sortConfig[type].direction === 'asc' ? 'desc' : 'asc';
                    } else {
                        sortConfig[type].column = column;
                        sortConfig[type].direction = 'asc';
                    }
                    
                    updateSortIndicators(tableId, column, sortConfig[type].direction);
                    applyFilters();
                });
            });
        });
    }

    function updateSortIndicators(tableId, activeColumn, direction) {
        const table = document.getElementById(tableId);
        const headers = table.querySelectorAll('th[data-sort]');
        headers.forEach(th => {
            // Remove existing markers
            th.querySelectorAll('.sort-icon').forEach(i => i.remove());
            
            if (th.dataset.sort === activeColumn) {
                const icon = document.createElement('i');
                icon.className = `mdi mdi-arrow-${direction === 'asc' ? 'up' : 'down'} ms-1 sort-icon`;
                th.appendChild(icon);
            }
        });
    }

    initSortingListeners();
    function applyFilters() {
        let filtered = [...allTransactions];
        
        const year = parseInt(filterYear.value);
        const period = filterPeriod.value;
        const search = filterSearch.value.toLowerCase();
        const cat = filterCategory.value;
        const onlyRecurring = filterOnlyRecurring.checked;

        if (onlyRecurring) {
            // When "Only Recurring" is ON, we only show parents (rules).
            // Robust check for isRecurring (handle boolean or string "true")
            filtered = filtered.filter(t => (t.isRecurring === true || t.isRecurring === 'true') && !t.parentRecurringId);
        } else {
            // Normal behavior: Filter by Year and Period
            const yearNum = parseInt(filterYear.value || new Date().getFullYear());
            filtered = filtered.filter(t => {
                const d = parseDate(t.date);
                return d && d.getFullYear() === yearNum;
            });

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

        // --- SORTING LOGIC ---
        const sortData = (data, config) => {
            return data.sort((a, b) => {
                let valA = a[config.column];
                let valB = b[config.column];

                // Handle nesting or special field parsing
                if (config.column === 'date') {
                    valA = parseDate(a.date).getTime();
                    valB = parseDate(b.date).getTime();
                }

                if (typeof valA === 'string') valA = valA.toLowerCase();
                if (typeof valB === 'string') valB = valB.toLowerCase();

                if (valA < valB) return config.direction === 'asc' ? -1 : 1;
                if (valA > valB) return config.direction === 'asc' ? 1 : -1;
                return 0;
            });
        };

        const incomes = sortData(filtered.filter(t => t.type === 'INCOME'), sortConfig.INCOME);
        const expenses = sortData(filtered.filter(t => t.type === 'EXPENSE'), sortConfig.EXPENSE);
        const savings = sortData(filtered.filter(t => t.type === 'SAVING'), sortConfig.SAVING);

        calculateKPIs(filtered, year, period);
        renderTables([...incomes, ...expenses, ...savings]);
        renderMonthlyControl(); 
        renderAgreementsList();
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
        if (isProcessingAgreements) return;
        isProcessingAgreements = true;

        try {
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
    } catch (error) {
        console.error("Error in processAutomaticAgreements:", error);
    } finally {
        isProcessingAgreements = false;
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
    


    function calculateKPIs(currentFilteredData, year, period) {
        const getSum = (arr, currency) => arr.reduce((acc, t) => t.currency === currency ? acc + (Number(t.amount) || 0) : acc, 0);

        // --- 1. PERIOD SPECIFIC KPIs (Facturación, Cobro, Gastos) ---
        // Based ONLY on currentFilteredData (what the user sees in the table for this year/month)
        const pIncome = currentFilteredData.filter(t => t.type === 'INCOME');
        const pExpense = currentFilteredData.filter(t => t.type === 'EXPENSE');

        // Facturación Esperada (Total of the period)
        updateKPI('kpi-income-expected-ars', getSum(pIncome, 'ARS'));
        updateKPI('kpi-income-expected-usd', getSum(pIncome, 'USD'));

        // Pendiente de Cobro (Income Not Paid)
        updateKPI('kpi-income-pending-ars', getSum(pIncome.filter(t => t.status !== 'PAID'), 'ARS'));
        updateKPI('kpi-income-pending-usd', getSum(pIncome.filter(t => t.status !== 'PAID'), 'USD'));

        // Gastos Esperados (Total Expenses of the period)
        updateKPI('kpi-expense-expected-ars', getSum(pExpense, 'ARS'));
        updateKPI('kpi-expense-expected-usd', getSum(pExpense, 'USD'));

        // Gastos Pendientes (Expenses Not Paid)
        updateKPI('kpi-expense-pending-ars', getSum(pExpense.filter(t => t.status !== 'PAID'), 'ARS'));
        updateKPI('kpi-expense-pending-usd', getSum(pExpense.filter(t => t.status !== 'PAID'), 'USD'));


        // --- 2. ACCUMULATED BALANCE KPIs (Caja, Reservas, Patrimonio) ---
        // Up to selected period (Historical context)
        let historicalData = [...allTransactions];
        
        // Define terminal date of period for historical balance
        let endOfPeriodDate = new Date();
        if (period === 'ALL') {
             // No date filter needed
        } else if (period === 'YTD') {
             endOfPeriodDate = new Date(); // Current moment
        } else {
             const m = parseInt(period);
             if (!isNaN(m)) {
                 endOfPeriodDate = new Date(year, m, 0, 23, 59, 59); // Last day of month
             } else {
                 // Quarters and Semesters
                 const map = { 'Q1': 3, 'Q2': 6, 'Q3': 9, 'Q4': 12, 'S1': 6, 'S2': 12 };
                 if(map[period]) endOfPeriodDate = new Date(year, map[period], 0, 23, 59, 59);
             }
        }

        // Filter historical data up to end of period
        if (period !== 'ALL') {
             historicalData = historicalData.filter(t => parseDate(t.date) <= endOfPeriodDate);
        }

        const hIncome = historicalData.filter(t => t.type === 'INCOME' && t.status === 'PAID');
        const hExpense = historicalData.filter(t => t.type === 'EXPENSE' && t.status === 'PAID');
        
        const hSavingsAll = historicalData.filter(t => t.type === 'SAVING');
        const hSavingsActive = hSavingsAll.filter(t => t.status !== 'USED');
        const hSavingsToSubtract = hSavingsAll.filter(t => t.isInitial !== true);

        const balanceARS = getSum(hIncome, 'ARS') - getSum(hExpense, 'ARS') - getSum(hSavingsToSubtract, 'ARS');
        const balanceUSD = getSum(hIncome, 'USD') - getSum(hExpense, 'USD') - getSum(hSavingsToSubtract, 'USD');
        const totalSavARS = getSum(hSavingsActive, 'ARS');
        const totalSavUSD = getSum(hSavingsActive, 'USD');

        // Update DOM Cards (Balance and Wealth)
        updateKPI('kpi-balance-ars', balanceARS);
        updateKPI('kpi-balance-usd', balanceUSD);
        updateKPI('kpi-savings-ars', totalSavARS);
        updateKPI('kpi-savings-usd', totalSavUSD);
        updateKPI('kpi-total-ars', balanceARS + totalSavARS);
        updateKPI('kpi-total-usd', balanceUSD + totalSavUSD);

        // --- 3. SURPLUS ASSISTANT ---
        // We suggest saving based on what was effectively PAID/RECEIVED this month
        const monthlyProfitARS = getSum(pIncome.filter(t => t.status === 'PAID'), 'ARS') - getSum(pExpense.filter(t => t.status === 'PAID'), 'ARS');
        const monthlyProfitUSD = getSum(pIncome.filter(t => t.status === 'PAID'), 'USD') - getSum(pExpense.filter(t => t.status === 'PAID'), 'USD');

        checkSurplusAssistant(monthlyProfitARS, monthlyProfitUSD, balanceARS, balanceUSD);
    }

    function checkSurplusAssistant(monthlyARS, monthlyUSD, availableARS, availableUSD) {
        const container = document.getElementById('surplus-assistant-container');
        const msg = document.getElementById('surplus-msg');
        const period = document.getElementById('filter-period').value;
        
        // Show only if there is a surplus in the CURRENT MONTH and we have LIQUID CASH available
        if (monthlyARS > 100 || monthlyUSD > 0) {
            const arsToSave = Math.min(monthlyARS, availableARS);
            const usdToSave = Math.min(monthlyUSD, availableUSD);

            if (arsToSave <= 0 && usdToSave <= 0) {
                 container.style.display = 'none';
                 return;
            }

            const monthMap = { '01': 'Enero', '02': 'Febrero', '03': 'Marzo', '04': 'Abril', '05': 'Mayo', '06': 'Junio', '07': 'Julio', '08': 'Agosto', '09': 'Septiembre', '10': 'Octubre', '11': 'Noviembre', '12': 'Diciembre' };
            const monthName = monthMap[period];
            
            if (monthName) {
                container.style.display = 'block';
                msg.innerHTML = `Ganaste <strong>${formatCurrency(monthlyARS, 'ARS')}</strong> / <strong>${formatCurrency(monthlyUSD, 'USD')}</strong> netos en <strong>${monthName}</strong>. ¿Deseas ahorrar una parte?`;
                return;
            }
        }
        container.style.display = 'none';
    }

    window.openCapitalizeModal = async function() {
        const ars = parseFloat(document.getElementById('kpi-balance-ars').textContent.replace(/[$.]/g, '').replace(',', '.')) || 0;
        const usd = parseFloat(document.getElementById('kpi-balance-usd').textContent.replace(/[$.]/g, '').replace(',', '.')) || 0;
        
        const period = document.getElementById('filter-period').value;
        const year = document.getElementById('filter-year').value;
        const monthMap = { '01': 'Enero', '02': 'Febrero', '03': 'Marzo', '04': 'Abril', '05': 'Mayo', '06': 'Junio', '07': 'Julio', '08': 'Agosto', '09': 'Septiembre', '10': 'Octubre', '11': 'Noviembre', '12': 'Diciembre' };
        const monthName = monthMap[period];

        const { value: formValues } = await Swal.fire({
            title: `Capitalizar Excedente - ${monthName}`,
            html: `
                <div class="text-start">
                    <p class="text-muted small">Decide cuánto mover del saldo disponible actual a tus ahorros.</p>
                    <div class="mb-3">
                        <label class="form-label">Monto en Pesos (ARS) - Disponible: ${formatCurrency(ars, 'ARS')}</label>
                        <input id="swal-ars" class="form-control" type="number" step="0.01" value="${ars > 0 ? ars : 0}">
                    </div>
                    <div class="mb-3">
                        <label class="form-label">Monto en Dólares (USD) - Disponible: ${formatCurrency(usd, 'USD')}</label>
                        <input id="swal-usd" class="form-control" type="number" step="0.01" value="${usd > 0 ? usd : 0}">
                    </div>
                </div>
            `,
            focusConfirm: false,
            showCancelButton: true,
            confirmButtonText: 'Confirmar Ahorro',
            cancelButtonText: 'Cancelar',
            preConfirm: () => {
                return {
                    ars: parseFloat(document.getElementById('swal-ars').value) || 0,
                    usd: parseFloat(document.getElementById('swal-usd').value) || 0
                }
            }
        });

        if (formValues) {
            executeCapitalization(formValues, period, year, monthName);
        }
    }

    async function executeCapitalization(values, month, year, monthName) {
        const lastDay = new Date(year, parseInt(month), 0); // Last day of month
        const batch = db.batch();
        const col = db.collection('transactions');
        let created = 0;

        const createSaving = (amount, currency) => {
            if (amount <= 0) return;
            const ref = col.doc();
            batch.set(ref, {
                type: 'SAVING',
                entityName: `Capitalización Excedente ${monthName} ${year}`,
                category: 'Fondo de Reserva',
                status: 'ACTIVE',
                currency: currency,
                amount: amount,
                date: firebase.firestore.Timestamp.fromDate(lastDay),
                address: `Traspaso de saldo sobrante del periodo filtrado (${monthName} ${year}).`,
                createdAt: new Date(),
                createdBy: auth.currentUser.uid
            });
            created++;
        };

        createSaving(values.ars, 'ARS');
        createSaving(values.usd, 'USD');

        if (created > 0) {
            try {
                await batch.commit();
                Swal.fire('¡Éxito!', 'Excedente capitalizado correctamente.', 'success');
            } catch (e) {
                console.error(e);
                Swal.fire('Error', 'No se pudo realizar el traspaso.', 'error');
            }
        }
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
            const dateObj = parseDate(t.date);
            const dateStr = dateObj ? dateObj.toLocaleDateString() : 'N/A';
            const amountStr = formatCurrency(t.amount || 0, t.currency || 'ARS');
            
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
                            ${t.installmentsTotal ? `<div class="mt-1"><span class="badge badge-soft-info" style="border: 1px solid #0ab39c;">Cuota ${t.installmentNumber || 1}/${t.installmentsTotal}</span></div>` : ''}
                        </td>
                        <td><span class="badge badge-soft-primary">${t.category}</span></td>
                        <td><span class="text-truncate d-block" style="max-width: 150px;">${t.address || '-'}</span></td>
                        <td>${t.currency === 'ARS' ? amountStr : '-'}</td>
                        <td>${t.currency === 'USD' ? amountStr : '-'}</td>
                        <td>${(t.isRecurring === true || t.isRecurring === 'true') ? '<i class="bx bx-revision text-primary" title="Recurrente"></i>' : ''}</td>
                        <td><div class="${statusBadge}">${statusLabel}</div></td>
                        <td>
                            <div class="d-flex gap-2 text-end justify-content-end">
                                <button class="btn btn-sm btn-soft-primary" onclick="editSaving('${t.id}')" title="Editar"><i class="mdi mdi-pencil"></i></button>
                                ${ t.status !== 'USED' ? `<button class="btn btn-sm btn-info" onclick="useSavingForExpense('${t.id}')" title="Usar para Gasto"><i class="mdi mdi-arrow-right-bold-circle-outline"></i></button>` : '' }
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
                        <small class="text-muted text-truncate">
                            ${t.cuit || '-'} 
                            ${t.installmentsTotal ? ` <span class="badge badge-soft-info ms-1" style="border: 1px solid #0ab39c;">Cuota ${t.installmentNumber || 1}/${t.installmentsTotal}</span>` : ''}
                        </small>
                    </td>
                    <td><span class="badge badge-soft-primary">${t.category}</span></td>
                    <td>${t.address || '-'}</td>
                    <td>${t.currency === 'ARS' ? amountStr : '-'}</td>
                    <td>${t.currency === 'USD' ? amountStr : '-'}</td>
                    <td>${(t.isRecurring === true || t.isRecurring === 'true') ? '<i class="bx bx-revision text-primary"></i>' : '-'}</td>
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

    window.deleteTransaction = async function(id) {
        const result = await Swal.fire({
            title: '¿Eliminar?',
            text: "No podrás revertir esto.",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#f46a6a',
            confirmButtonText: 'Sí, eliminar',
            cancelButtonText: 'Cancelar'
        });

        if (result.isConfirmed) {
            try {
                await db.collection('transactions').doc(id).delete();
                Swal.fire({ 
                    toast: true, 
                    position: 'top-end', 
                    icon: 'success', 
                    title: 'Eliminado correctamente.', 
                    showConfirmButton: false, 
                    timer: 2000 
                });
            } catch (error) {
                console.error("Error al eliminar:", error);
                Swal.fire('Error', 'No se pudo eliminar: ' + error.message, 'error');
            }
        }
    };

    window.editSaving = function(id) {
        const t = allTransactions.find(x => x.id === id);
        if(t) openModal('SAVING', t);
    };

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
    };

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


    // ==========================================
    // 9. Savings Transfer Logic
    // ==========================================

    async function openTransferModal() {
        const sourceSelect = document.getElementById('trans-source');
        const destSelect = document.getElementById('trans-dest');
        const amountInput = document.getElementById('trans-amount');
        
        sourceSelect.innerHTML = '<option value="">Seleccione origen...</option>';
        destSelect.innerHTML = '<option value="">Seleccione destino...</option>';
        amountInput.value = '';

        // Filter active savings from allTransactions
        const savings = allTransactions.filter(t => t.type === 'SAVING' && t.status !== 'USED');
        
        if (savings.length === 0) {
            Swal.fire('Atención', 'No tienes ahorros activos para transferir.', 'info');
            return;
        }

        // Populate Source
        savings.forEach(s => {
            const amountStr = formatCurrency(s.amount, s.currency);
            sourceSelect.innerHTML += `<option value="${s.id}" data-currency="${s.currency}" data-amount="${s.amount}">${s.entityName} (${amountStr})</option>`;
        });

        // Populate Destination
        savings.forEach(s => {
            destSelect.innerHTML += `<option value="TRANS_TO_SAV_${s.id}">${s.entityName} (Existente)</option>`;
        });
        
        categories.SAVING.forEach(c => {
            destSelect.innerHTML += `<option value="TRANS_TO_CAT_${c}">Nueva meta: ${c}</option>`;
        });

        transferModal.show();
    }

    function updateTransferCurrency() {
        const sourceSelect = document.getElementById('trans-source');
        const selectedOption = sourceSelect.options[sourceSelect.selectedIndex];
        const currencyInput = document.getElementById('trans-currency');
        if (selectedOption && selectedOption.dataset.currency) {
            currencyInput.value = selectedOption.dataset.currency;
        } else {
            currencyInput.value = '';
        }
    }

    async function handleTransferSubmit(e) {
        e.preventDefault();
        const sourceId = document.getElementById('trans-source').value;
        const destKey = document.getElementById('trans-dest').value;
        const amount = parseFloat(document.getElementById('trans-amount').value);
        const btn = document.getElementById('btn-do-transfer');

        if (!sourceId || !destKey || !amount) return;

        const sourceTx = allTransactions.find(t => t.id === sourceId);
        if (amount > sourceTx.amount) {
            Swal.fire('Monto excedido', 'No puedes transferir más del saldo disponible en el origen.', 'error');
            return;
        }

        btn.disabled = true;
        btn.innerHTML = '<i class="bx bx-loader bx-spin"></i>';

        try {
            const batch = db.batch();
            const date = firebase.firestore.Timestamp.fromDate(new Date());

            // 1. Dec Source
            const sourceDecRef = db.collection('transactions').doc();
            batch.set(sourceDecRef, {
                type: 'SAVING',
                entityName: `Reducción por Transferencia: ${sourceTx.entityName}`,
                category: sourceTx.category,
                amount: -amount,
                currency: sourceTx.currency,
                date: date,
                isInitial: true, 
                status: 'ACTIVE',
                address: `Transferencia interna hacia: ${destKey.includes('SAV_') ? 'otra meta' : destKey.split('CAT_')[1]}`,
                createdAt: new Date(),
                createdBy: auth.currentUser.uid
            });

            // 2. Add to destination
            const destIncRef = db.collection('transactions').doc();
            let destName = '';
            let destCat = '';
            
            if (destKey.startsWith('TRANS_TO_SAV_')) {
                const targetId = destKey.replace('TRANS_TO_SAV_', '');
                const targetTx = allTransactions.find(t => t.id === targetId);
                destName = targetTx.entityName;
                destCat = targetTx.category;
            } else {
                destName = destKey.replace('TRANS_TO_CAT_', '');
                destCat = destName;
            }

            batch.set(destIncRef, {
                type: 'SAVING',
                entityName: `Recibo por Transferencia: ${destName}`,
                category: destCat,
                amount: amount,
                currency: sourceTx.currency,
                date: date,
                isInitial: true,
                status: 'ACTIVE',
                address: `Transferencia interna desde: ${sourceTx.entityName}`,
                createdAt: new Date(),
                createdBy: auth.currentUser.uid
            });

            await batch.commit();
            transferModal.hide();
            Swal.fire('Transferencia Exitosa', 'Monto reasignado correctamente.', 'success');
            loadTransactions(); 

        } catch (err) {
            console.error(err);
            Swal.fire('Error', 'Error al procesar: ' + err.message, 'error');
        } finally {
            btn.disabled = false;
            btn.textContent = 'Confirmar Transferencia';
        }
    }

});
