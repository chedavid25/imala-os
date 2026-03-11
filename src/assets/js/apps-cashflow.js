document.addEventListener("DOMContentLoaded", function() {
    // --- Initial Config & Global Variables ---
    const dbFirestore = window.Imala.db;
    const firebaseAuth = window.Imala.auth;
    let allClients = [];
    let allTransactions = []; 
    let allAccounts = []; 
    let allAgreements = []; 
    let allAssets = []; 
    let categoriesMap = { INCOME: [], EXPENSE: [], SAVING: [] }; 
    let entitiesMap = { INCOME: [], EXPENSE: [] }; 
    let isRecurrenceChecking = false; 
    let isAgreementChecking = false; 
    let initialRecurrenceCheckDone = false; 
    let sortSettings = { 
        INCOME: { column: "date", direction: "desc" }, 
        EXPENSE: { column: "date", direction: "desc" }, 
        SAVING: { column: "date", direction: "desc" } 
    };
    let mobileListLimit = 10; 
    
    const formatCurrency = (amount, currency) => new Intl.NumberFormat("es-AR", {
        style: "currency",
        currency: currency || "ARS"
    }).format(amount || 0);

    const getEffectiveUID = () => window.getEffectiveUID ? window.getEffectiveUID() : (sessionStorage.getItem("effectiveUID") || firebaseAuth.currentUser.uid);
    const parseFirestoreDate = e => e ? (e.seconds ? new Date(e.seconds * 1000) : new Date(e)) : null;

    // --- Core UI & Modals ---
    const modalIncome = new bootstrap.Modal(document.getElementById("modal-income"));
    const modalExpense = new bootstrap.Modal(document.getElementById("modal-expense"));
    const modalSaving = new bootstrap.Modal(document.getElementById("modal-saving"));
    const modalTransferUnified = new bootstrap.Modal(document.getElementById("modal-transfer-unified"));
    const modalAsset = new bootstrap.Modal(document.getElementById("modal-asset"));
    const modalManageAssetTypes = new bootstrap.Modal(document.getElementById("modal-manage-asset-types"));
    const modalAgreement = new bootstrap.Modal(document.getElementById("agreement-modal"));

    // --- Initialization & Data Fetching ---
    firebaseAuth.onAuthStateChanged(async (user) => {
        if (!user) {
            window.location.href = "auth-login.html";
            return;
        }

        initializeCategories();
        initializeEntities();
        initializeClients();
        initializeAccounts();
        initializeAssets();
        initializeAssetTypes();
        initTransactionsListener(); // Start recurrences check
        initAgreementsListener(); // Start agreements check
    });

    async function initializeCategories() {
        const categoriesRef = dbFirestore.collection("cashflow_categories");
        try {
            const querySnapshot = await categoriesRef.orderBy("createdAt", "asc").get();
            let typesMap = { INCOME: new Set(), EXPENSE: new Set(), SAVING: new Set() };
            let batch = dbFirestore.batch();
            let needsUpdate = false;

            querySnapshot.forEach(doc => {
                const data = doc.data();
                let type = data.type || (["Alquiler", "Expensas", "Servicios", "Sueldos", "Impuestos"].includes(data.name) ? "EXPENSE" : "INCOME");
                if (!data.type) { batch.update(doc.ref, { type: type }); needsUpdate = true; }
                if (data.active !== false) {
                    if (!categoriesMap[type].includes(data.name)) categoriesMap[type].push(data.name);
                }
            });

            if (needsUpdate) await batch.commit();
            ["INCOME", "EXPENSE", "SAVING"].forEach(t => { categoriesMap[t].sort(); updateCategorySelects(t); });
            updateGlobalFilterCategory(); // Update filters
        } catch (e) { console.error("Error loading categories", e); }
    }

    async function initializeEntities() {
        entitiesMap = { INCOME: [], EXPENSE: [] };
        try {
            const snapshot = await dbFirestore.collection("cashflow_entities").orderBy("name").get();
            snapshot.forEach(doc => {
                const data = doc.data();
                const type = data.type || "BOTH";
                if (type === "CLIENT" || type === "BOTH") if (!entitiesMap.INCOME.includes(data.name)) entitiesMap.INCOME.push(data.name);
                if (type === "PROVIDER" || type === "BOTH") if (!entitiesMap.EXPENSE.includes(data.name)) entitiesMap.EXPENSE.push(data.name);
            });
            updateEntityLists();
        } catch (e) { console.error("Error loading entities", e); }
    }

    function initializeClients() {
        const clientSelect = document.getElementById("agr-client-id");
        if (!clientSelect) return;
        dbFirestore.collection("clients").onSnapshot(snapshot => {
            allClients = [];
            clientSelect.innerHTML = '<option value="">Seleccione Cliente...</option>';
            snapshot.forEach(doc => {
                const data = doc.data();
                allClients.push({ id: doc.id, ...data });
                clientSelect.innerHTML += `<option value="${doc.id}">${data.name}</option>`;
            });
            renderAgreementsTable(); // Update agreements table if needed
        });
    }

    function initializeAccounts() {
        dbFirestore.collection("cashflow_accounts").onSnapshot(snapshot => {
            allAccounts = [];
            snapshot.forEach(doc => allAccounts.push({ id: doc.id, ...doc.data() }));
            updateAccountSelects();
            renderAccountsTable();
            if (typeof renderMobileAccounts === 'function') renderMobileAccounts();
            renderAccountSummary(); // Account summary
        });
    }

    function initializeAssets() {
        dbFirestore.collection("cashflow_assets").onSnapshot(snapshot => {
            allAssets = [];
            snapshot.forEach(doc => allAssets.push({ id: doc.id, ...doc.data() }));
            renderAssetsGrid();
            applyFilters(); // Refresh totals
        });
    }

    function initializeAssetTypes() {
        dbFirestore.collection("cashflow_asset_types").onSnapshot(snapshot => {
            let types = [];
            snapshot.forEach(doc => types.push({ id: doc.id, ...doc.data() }));
            updateAssetTypeSelect(types);
            renderAssetTypesTable(types);
        });
    }

    // --- Helper Functions ---
    function updateCategorySelects(type) {
        let selectId = type === "INCOME" ? "in-category" : (type === "EXPENSE" ? "ex-category" : "sav-category");
        let select = document.getElementById(selectId);
        if (select) {
            select.innerHTML = '<option value="">Seleccione...</option>';
            categoriesMap[type].forEach(cat => { select.innerHTML += `<option value="${cat}">${cat}</option>`; });
        }
        if (type === "INCOME") {
            let agrSelect = document.getElementById("agr-category");
            if (agrSelect) {
                agrSelect.innerHTML = '<option value="">Seleccione...</option>';
                categoriesMap.INCOME.forEach(cat => { agrSelect.innerHTML += `<option value="${cat}">${cat}</option>`; });
            }
        }
    }

    function updateGlobalFilterCategory() {
        let filterCat = document.getElementById("filter-category");
        if (filterCat) {
            let current = filterCat.value;
            filterCat.innerHTML = '<option value="ALL">Todas</option>';
            [...new Set([...categoriesMap.INCOME, ...categoriesMap.EXPENSE])].sort().forEach(cat => {
                filterCat.innerHTML += `<option value="${cat}">${cat}</option>`;
            });
            filterCat.value = current;
        }
    }

    function updateEntityLists() {
        const inList = document.getElementById("list-entities-income");
        const exList = document.getElementById("list-entities-expense");
        if (inList) inList.innerHTML = "";
        if (exList) exList.innerHTML = "";
        entitiesMap.INCOME.forEach(name => { if (inList) inList.innerHTML += `<option value="${name}">${name}</option>`; });
        entitiesMap.EXPENSE.forEach(name => { if (exList) exList.innerHTML += `<option value="${name}">${name}</option>`; });
    }

    function updateAccountSelects() {
        const selects = document.querySelectorAll(".select-account");
        const activeAccounts = allAccounts.filter(a => a.isActive !== false);
        selects.forEach(select => {
            const current = select.value;
            select.innerHTML = '<option value="">Seleccione cuenta...</option>';
            activeAccounts.forEach(acc => {
                select.innerHTML += `<option value="${acc.id}">${acc.name} (${acc.currency})</option>`;
            });
            select.value = current;
        });
    }

    // --- Transactions Management ---
    function initTransactionsListener() {
        dbFirestore.collection("transactions").onSnapshot(snapshot => {
            allTransactions = [];
            snapshot.forEach(doc => allTransactions.push({ id: doc.id, ...doc.data() }));
            checkRecurrences(allTransactions);
            applyFilters(); // Refresh filters and calculations
        });
    }

    async function checkRecurrences(allTx) {
        if (isRecurrenceChecking || initialRecurrenceCheckDone) return;
        isRecurrenceChecking = true;
        try {
            const recurs = allTx.filter(t => t.isRecurring && !t.parentRecurringId);
            const now = new Date();
            const firstOfCurrentMonth = new Date(Date.UTC(now.getFullYear(), now.getMonth(), 1));
            let generated = 0;

            for (let parent of recurs) {
                const parentDate = parseFirestoreDate(parent.date);
                if (!parentDate) continue;
                
                // Compare months accurately using UTC
                const parentMonth = parentDate.getUTCMonth();
                const parentYear = parentDate.getUTCFullYear();
                const currentMonth = now.getUTCMonth();
                const currentYear = now.getUTCFullYear();

                if (parentYear > currentYear || (parentYear === currentYear && parentMonth >= currentMonth)) continue;

                // Check if already generated for this month
                const alreadyDone = allTx.find(t => t.parentRecurringId === parent.id && parseFirestoreDate(t.date).getUTCMonth() === currentMonth && parseFirestoreDate(t.date).getUTCFullYear() === currentYear);
                if (alreadyDone) continue;

                // Check installments
                const count = allTx.filter(t => t.parentRecurringId === parent.id).length;
                if (parent.installmentsTotal && count + 1 >= parent.installmentsTotal) continue;

                const newTx = { ...parent };
                delete newTx.id;
                delete newTx.createdAt;
                newTx.isRecurring = false;
                newTx.parentRecurringId = parent.id;
                newTx.status = parent.type === "SAVING" ? "ACTIVE" : "PENDING";
                newTx.date = firebase.firestore.Timestamp.fromDate(firstOfCurrentMonth);
                newTx.createdAt = new Date();
                newTx.description = `${parent.address || ""} (Recurrente ${currentMonth + 1}/${currentYear})`;
                if (parent.installmentsTotal) newTx.installmentNumber = count + 2;
                
                await dbFirestore.collection("transactions").add(newTx);
                generated++;
            }
            if (generated > 0) console.log(`Generated ${generated} recurring transactions.`);
            initialRecurrenceCheckDone = true;
        } catch (e) { console.error("Error checking recurrences", e); }
        finally { isRecurrenceChecking = false; }
    }

    function applyFilters() {
        const year = parseInt(document.getElementById("filter-year").value);
        const period = document.getElementById("filter-period").value;
        const category = document.getElementById("filter-category").value;
        const accountId = document.getElementById("filter-account").value;
        const status = document.getElementById("filter-status").value;
        const search = document.getElementById("filter-search").value.toLowerCase();
        
        const filtered = allTransactions.filter(tx => {
            const date = parseFirestoreDate(tx.date);
            if (!date) return false;
            
            // UTC Filtering
            if (date.getFullYear() !== year) return false;
            
            let periodMatch = true;
            const monthVal = date.getMonth() + 1;
            if (period !== "ALL") {
                if (period === "YTD") periodMatch = date.getTime() <= Date.now();
                else if (period === "Q1") periodMatch = monthVal >= 1 && monthVal <= 3;
                else if (period === "Q2") periodMatch = monthVal >= 4 && monthVal <= 6;
                else if (period === "Q3") periodMatch = monthVal >= 7 && monthVal <= 9;
                else if (period === "Q4") periodMatch = monthVal >= 10 && monthVal <= 12;
                else if (period === "S1") periodMatch = monthVal >= 1 && monthVal <= 6;
                else if (period === "S2") periodMatch = monthVal >= 7 && monthVal <= 12;
                else periodMatch = monthVal === parseInt(period);
            }

            const catMatch = category === "ALL" || tx.category === category;
            const accMatch = accountId === "ALL" || tx.accountId === accountId;
            const statusMatch = status === "ALL" || tx.status === status;
            
            const entityName = (tx.entityName || "").toLowerCase();
            const address = (tx.address || "").toLowerCase();
            const searchMatch = !search || entityName.includes(search) || address.includes(search);

            return periodMatch && catMatch && accMatch && statusMatch && searchMatch;
        });

        updateKPIs(filtered, year, period);
        renderTransactionsTable(filtered);
        renderMobileTransactions(filtered);
    }

    function updateKPIs(filtered, year, period) {
        let totalIncArs = 0, totalIncUsd = 0, pendIncArs = 0, pendIncUsd = 0;
        let totalExpArs = 0, totalExpUsd = 0, pendExpArs = 0, pendExpUsd = 0;

        filtered.forEach(tx => {
            if (tx.type === "INCOME") {
                if (tx.currency === "ARS") { totalIncArs += tx.amount; if (tx.status !== "PAID") pendIncArs += tx.amount; }
                else { totalIncUsd += tx.amount; if (tx.status !== "PAID") pendIncUsd += tx.amount; }
            } else if (tx.type === "EXPENSE") {
                if (tx.currency === "ARS") { totalExpArs += tx.amount; if (tx.status !== "PAID") pendExpArs += tx.amount; }
                else { totalExpUsd += tx.amount; if (tx.status !== "PAID") pendExpUsd += tx.amount; }
            }
        });

        if (/^\d{2}$/.test(period)) {
            const periodKey = `${year}-${period}`;
            allAgreements.forEach(agr => {
                if (!agr.isActive) return;
                if (agr.frequency === "MONTHLY" && (!agr.invoices || !agr.invoices[periodKey] || !agr.invoices[periodKey].sent)) {
                    if (agr.currency === "ARS") { totalIncArs += agr.amount; pendIncArs += agr.amount; }
                    else { totalIncUsd += agr.amount; pendIncUsd += agr.amount; }
                }
            });
        }

        // Summary Blocks Formatting
        const setSum = (id, val, cur) => { const el = document.getElementById(id); if (el) el.textContent = val; };
        
        setSum("kpi-income-ars", `${formatCurrency(totalIncArs - pendIncArs, "ARS")} / ${formatCurrency(totalIncArs, "ARS")}`);
        setSum("kpi-income-usd", `${formatCurrency(totalIncUsd - pendIncUsd, "USD")} / ${formatCurrency(totalIncUsd, "USD")}`);
        setSum("kpi-expense-ars", `${formatCurrency(totalExpArs - pendExpArs, "ARS")} / ${formatCurrency(totalExpArs, "ARS")}`);
        setSum("kpi-expense-usd", `${formatCurrency(totalExpUsd - pendExpUsd, "USD")} / ${formatCurrency(totalExpUsd, "USD")}`);

        let liqArs = 0, liqUsd = 0;
        allAccounts.forEach(acc => {
            const bal = getAccountBalance(acc.id);
            if (acc.currency === "ARS") liqArs += bal; else liqUsd += bal;
        });

        let investedArs = 0, investedUsd = 0;
        allAssets.forEach(asset => {
            if (asset.currency === "ARS") investedArs += asset.valuation || 0;
            else investedUsd += asset.valuation || 0;
        });

        updateKPICard("kpi-invested-ars", investedArs);
        updateKPICard("kpi-invested-usd", investedUsd);
        updateKPICard("kpi-net-ars", liqArs);
        updateKPICard("kpi-net-usd", liqUsd);
        updateKPICard("kpi-net-worth-ars", liqArs + investedArs);
        updateKPICard("kpi-net-worth-usd", liqUsd + investedUsd);

        updateSurplusAssistant(totalIncArs - totalExpArs, totalIncUsd - totalExpUsd, liqArs, liqUsd);
    }

    function renderTransactionsTable(list) {
        const inBody = document.querySelector("#table-income tbody");
        const exBody = document.querySelector("#table-expense tbody");
        if (!inBody || !exBody) return;
        inBody.innerHTML = ""; exBody.innerHTML = "";

        list.forEach(tx => {
            const dateObj = parseFirestoreDate(tx.date);
            const dateStr = dateObj?.toLocaleDateString("es-AR", { timeZone: "UTC" }) || "-";
            const amountStr = formatCurrency(tx.amount, tx.currency);
            
            // Mora Alert Logic (>15 days pending)
            let moraHtml = "";
            if (tx.status !== "PAID" && dateObj) {
                const diff = (new Date() - dateObj) / (1000 * 60 * 60 * 24);
                if (diff > 15) {
                    const color = diff > 30 ? "text-danger" : "text-warning";
                    moraHtml = `<i class="mdi mdi-alert-circle ${color} ms-1" title="Atrasado ${Math.floor(diff)} días"></i>`;
                }
            }

            const statusClass = tx.status === "PAID" ? "badge bg-success" : (tx.status === "INVOICED" ? "badge bg-info" : "badge bg-warning text-dark");
            const statusLabel = tx.status === "PAID" ? "Pagado" : (tx.status === "INVOICED" ? "Facturado" : "Pendiente");
            const accName = allAccounts.find(a => a.id === tx.accountId)?.name || "-";
            
            const actions = `
                <div class="d-flex gap-2">
                    <button class="btn btn-sm btn-soft-${tx.status === 'PAID' ? 'warning' : 'success'}" onclick="toggleStatus('${tx.id}', '${tx.status === 'PAID' ? 'PENDING' : 'PAID'}')">
                        <i class="bx ${tx.status === 'PAID' ? 'bx-undo' : 'bx-check'}"></i>
                    </button>
                    <button class="btn btn-sm btn-soft-info" onclick="editTransaction('${tx.id}')"><i class="mdi mdi-pencil"></i></button>
                    <button class="btn btn-sm btn-soft-danger" onclick="deleteTransaction('${tx.id}')"><i class="mdi mdi-trash-can"></i></button>
                </div>
            `;

            const row = `
                <tr>
                    <td>${dateStr}${moraHtml}</td>
                    <td>
                        <h6 class="mb-0 font-size-14">${tx.entityName || "Sin Nombre"}</h6>
                        <small class="text-muted">${tx.cuit || "-"}</small>
                    </td>
                    <td><span class="badge badge-soft-primary">${tx.category || "General"}</span></td>
                    <td><span class="badge badge-soft-secondary">${accName}</span></td>
                    <td>${tx.address || "-"}</td>
                    <td>${tx.currency === "ARS" ? amountStr : "-"}</td>
                    <td>${tx.currency === "USD" ? amountStr : "-"}</td>
                    <td>${tx.isRecurring ? '<i class="bx bx-revision text-primary" title="Recurrente"></i>' : "-"}</td>
                    <td><span class="${statusClass}">${statusLabel}</span></td>
                    <td>${actions}</td>
                </tr>
            `;

            if (tx.type === "INCOME") inBody.innerHTML += row;
            else if (tx.type === "EXPENSE") exBody.innerHTML += row;
        });
    }

    function renderMobileTransactions(list) {
        const container = document.getElementById("mobile-transactions-list");
        if (!container) return;
        container.innerHTML = "";

        if (list.length === 0) {
            container.innerHTML = '<div class="text-center p-4 text-muted">Sin movimientos.</div>';
            return;
        }

        const sorted = [...list].sort((a,b) => parseFirestoreDate(b.date) - parseFirestoreDate(a.date)).slice(0, mobileListLimit);
        sorted.forEach(tx => {
            const isInc = tx.type === "INCOME";
            const colorClass = isInc ? "bg-success-subtle text-success" : "bg-danger-subtle text-danger";
            const amountColor = isInc ? "text-success" : "text-danger";
            const icon = isInc ? "bx-trending-up" : "bx-trending-down";

            container.innerHTML += `
                <div class="list-group-item d-flex align-items-center py-3" onclick="editTransaction('${tx.id}')">
                    <div class="avatar-sm me-3 flex-shrink-0">
                        <span class="avatar-title rounded-circle ${colorClass} font-size-18">
                            <i class="bx ${icon}"></i>
                        </span>
                    </div>
                    <div class="flex-grow-1 overflow-hidden">
                        <h5 class="font-size-14 mb-1 text-truncate">${tx.entityName || "Sin Nombre"}</h5>
                        <p class="text-muted font-size-12 mb-0">${tx.category || "General"} • ${parseFirestoreDate(tx.date)?.toLocaleDateString() || "-"}</p>
                    </div>
                    <div class="text-end flex-shrink-0">
                        <h5 class="font-size-14 mb-0 ${amountColor}">${formatCurrency(tx.amount, tx.currency)}</h5>
                        <small class="text-muted">${tx.status === "PAID" ? "✅" : "⏳"}</small>
                    </div>
                </div>
            `;
        });
    }

    // --- Transactions Actions ---
    window.toggleStatus = async function(id, newStatus) {
        try {
            await dbFirestore.collection("transactions").doc(id).update({ status: newStatus });
            Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: 'Estado actualizado', showConfirmButton: false, timer: 1500 });
        } catch (e) { console.error("Error updating status", e); }
    };

    window.editTransaction = function(id) {
        const tx = allTransactions.find(t => t.id === id);
        if (!tx) return;

        if (tx.type === "INCOME") {
            document.getElementById("form-income").reset();
            document.getElementById("in-id").value = tx.id;
            document.getElementById("in-entity-name").value = tx.entityName;
            document.getElementById("in-category").value = tx.category;
            document.getElementById("in-amount").value = tx.amount;
            document.getElementById("in-currency").value = tx.currency;
            document.getElementById("in-account").value = tx.accountId;
            document.getElementById("in-status").value = tx.status || "PENDING";
            document.getElementById("in-date").valueAsDate = parseFirestoreDate(tx.date);
            document.getElementById("in-recurring").checked = tx.isRecurring;
            document.getElementById("container-in-installments").style.display = tx.isRecurring ? "block" : "none";
            document.getElementById("in-installments").value = tx.installmentsTotal || "";
            modalIncome.show();
        } else if (tx.type === "EXPENSE") {
            document.getElementById("form-expense").reset();
            document.getElementById("ex-id").value = tx.id;
            document.getElementById("ex-entity-name").value = tx.entityName;
            document.getElementById("ex-category").value = tx.category;
            document.getElementById("ex-amount").value = tx.amount;
            document.getElementById("ex-currency").value = tx.currency;
            document.getElementById("ex-account").value = tx.accountId;
            document.getElementById("ex-status").value = tx.status || "PENDING";
            document.getElementById("ex-date").valueAsDate = parseFirestoreDate(tx.date);
            document.getElementById("ex-recurring").checked = tx.isRecurring;
            document.getElementById("container-ex-installments").style.display = tx.isRecurring ? "block" : "none";
            document.getElementById("ex-installments").value = tx.installmentsTotal || "";
            modalExpense.show();
        }
    };

    window.deleteTransaction = async function(id) {
        const result = await Swal.fire({
            title: '¿Eliminar transacción?',
            text: "No podrás revertir esto.",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#f46a6a',
            confirmButtonText: 'Sí, eliminar',
            cancelButtonText: 'Cancelar'
        });

        if (result.isConfirmed) {
            try {
                await dbFirestore.collection("transactions").doc(id).delete();
                Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: 'Eliminado correctamentee', showConfirmButton: false, timer: 1500 });
            } catch (e) { console.error("Error deleting tx", e); }
        }
    };

    // --- Save Logic Z ---
    async function saveTransaction(e, type) {
        e.preventDefault();
        const prefix = type === "INCOME" ? "in" : (type === "EXPENSE" ? "ex" : "sav");
        const form = e.target;
        const btn = form.querySelector('button[type="submit"]');
        const originalText = btn.innerHTML;

        btn.disabled = true;
        btn.innerHTML = '<i class="bx bx-loader bx-spin"></i> Guardando...';

        try {
            const id = document.getElementById(prefix + "-id").value;
            const entityName = document.getElementById(prefix + "-entity-name") ? document.getElementById(prefix + "-entity-name").value : "";
            
            if (entityName && type !== "SAVING") {
                const entityType = type === "INCOME" ? "CLIENT" : "PROVIDER";
                if (!entitiesMap[type].includes(entityName)) {
                    await dbFirestore.collection("cashflow_entities").add({ name: entityName, type: entityType, createdAt: new Date(), uid: getEffectiveUID() });
                    entitiesMap[type].push(entityName);
                    updateEntityLists();
                }
                if (type === "INCOME") {
                    const exists = allClients.find(c => c.name.toLowerCase() === entityName.toLowerCase());
                    if (!exists) {
                        await dbFirestore.collection("clients").add({ name: entityName, uid: getEffectiveUID(), createdAt: new Date() });
                    }
                }
            }

            let data = {};
            if (type === "SAVING") {
                data = {
                    type: "SAVING",
                    entityName: document.getElementById("sav-category").value + " (" + document.getElementById("sav-currency").value + ")",
                    category: document.getElementById("sav-category").value,
                    amount: parseFloat(document.getElementById("sav-amount").value) || 0,
                    targetAmount: parseFloat(document.getElementById("sav-target-amount").value) || null,
                    currency: document.getElementById("sav-currency").value,
                    accountId: document.getElementById("sav-account").value,
                    status: document.getElementById("sav-status").value,
                    date: firebase.firestore.Timestamp.fromDate(document.getElementById("sav-date").valueAsDate || new Date()),
                    address: document.getElementById("sav-address").value,
                    isRecurring: document.getElementById("sav-recurring").checked,
                    installmentsTotal: parseInt(document.getElementById("sav-installments").value) || null,
                    isInitialCapital: document.getElementById("sav-is-initial").checked,
                    updatedAt: new Date()
                };
            } else {
                data = {
                    type: type,
                    entityName: entityName,
                    cuit: document.getElementById(prefix + "-cuit")?.value || "",
                    address: document.getElementById(prefix + "-address")?.value || "",
                    category: document.getElementById(prefix + "-category").value,
                    amount: parseFloat(document.getElementById(prefix + "-amount").value) || 0,
                    currency: document.getElementById(prefix + "-currency").value,
                    accountId: document.getElementById(prefix + "-account").value,
                    status: document.getElementById(prefix + "-status").value,
                    date: firebase.firestore.Timestamp.fromDate(document.getElementById(prefix + "-date").valueAsDate || new Date()),
                    isRecurring: document.getElementById(prefix + "-recurring").checked,
                    installmentsTotal: parseInt(document.getElementById(prefix + "-installments")?.value) || null,
                    updatedAt: new Date()
                };
            }

            if (id) {
                await dbFirestore.collection("transactions").doc(id).update(data);
            } else {
                // Balance Warning for Savings
                if (type === "SAVING" && !data.isInitialCapital) {
                    const currentBalance = getAccountBalance(data.accountId);
                    if (data.amount > currentBalance) {
                        const confirm = await Swal.fire({
                            title: 'Saldo Insuficiente',
                            text: `El monto (${formatCurrency(data.amount, data.currency)}) supera el saldo disponible (${formatCurrency(currentBalance, data.currency)}). ¿Continuar igual?`,
                            icon: 'warning',
                            showCancelButton: true,
                            confirmButtonText: 'Sí, guardar',
                            cancelButtonText: 'Corregir'
                        });
                        if (!confirm.isConfirmed) throw new Error("Acción cancelada por el usuario.");
                    }
                }

                data.createdAt = new Date();
                data.createdBy = getEffectiveUID();
                await dbFirestore.collection("transactions").add(data);
            }

            if (type === "INCOME") modalIncome.hide();
            else if (type === "EXPENSE") modalExpense.hide();
            else modalSaving.hide();

            Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: 'Guardado correctamente', showConfirmButton: false, timer: 3000 });
        } catch (e) {
            console.error("Error saving tx", e);
            Swal.fire("Error", "No se pudo guardar: " + e.message, "error");
        } finally {
            btn.disabled = false;
            btn.innerHTML = originalText;
        }
    }

    document.getElementById("form-income")?.addEventListener("submit", e => saveTransaction(e, "INCOME"));
    document.getElementById("form-expense")?.addEventListener("submit", e => saveTransaction(e, "EXPENSE"));
    document.getElementById("form-saving")?.addEventListener("submit", e => saveTransaction(e, "SAVING"));

    // --- Modal Helpers ---
    window.openNewTransactionModal = function(type) {
        if (type === "INCOME") {
            document.getElementById("form-income").reset();
            document.getElementById("in-id").value = "";
            document.getElementById("in-date").valueAsDate = new Date();
            modalIncome.show();
        } else if (type === "EXPENSE") {
            document.getElementById("form-expense").reset();
            document.getElementById("ex-id").value = "";
            document.getElementById("ex-date").valueAsDate = new Date();
            modalExpense.show();
        } else if (type === "SAVING") {
            document.getElementById("form-saving").reset();
            document.getElementById("sav-id").value = "";
            document.getElementById("sav-date").valueAsDate = new Date();
            modalSaving.show();
        }
        if (window.innerWidth < 992) toggleFabMenu();
    };

    // --- Save Agreement ---
    async function saveAgreement(e) {
        e.preventDefault();
        const btn = document.getElementById("btn-save-agreement");
        const originalText = btn.innerHTML;
        btn.disabled = true;
        btn.innerHTML = '<i class="bx bx-loader bx-spin"></i> Guardando...';

        try {
            const id = document.getElementById("agreement-id").value;
            const clientId = document.getElementById("agr-client-id").value;
            const client = allClients.find(c => c.id === clientId);
            
            const data = {
                clientId: clientId,
                name: client ? client.name : "",
                category: document.getElementById("agr-category").value,
                biller: document.getElementById("agr-biller").value,
                description: document.getElementById("agr-desc").value,
                frequency: document.getElementById("agr-frequency").value,
                accountId: document.getElementById("agr-account").value,
                currency: document.getElementById("agr-currency").value,
                amount: parseFloat(document.getElementById("agr-amount").value) || 0,
                hasInvoice: document.getElementById("agr-hasInvoice").value === "true",
                updatedAt: new Date()
            };

            if (id) {
                await dbFirestore.collection("cashflow_agreements").doc(id).update(data);
            } else {
                data.isActive = true;
                data.createdAt = new Date();
                data.uid = getEffectiveUID();
                data.invoices = {};
                await dbFirestore.collection("cashflow_agreements").add(data);
            }

            modalAgreement.hide();
            Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: 'Acuerdo guardado', showConfirmButton: false, timer: 3000 });
        } catch (err) {
            console.error("Error saving agreement", err);
            Swal.fire("Error", "No se pudo guardar el acuerdo.", "error");
        } finally {
            btn.disabled = false;
            btn.innerHTML = originalText;
        }
    }

    document.getElementById("form-agreement")?.addEventListener("submit", saveAgreement);

    window.editAgreement = function(id) {
        const agr = allAgreements.find(a => a.id === id);
        if (!agr) return;

        document.getElementById("form-agreement").reset();
        document.getElementById("agreement-id").value = agr.id;
        document.getElementById("agr-client-id").value = agr.clientId || "";
        document.getElementById("agr-category").value = agr.category || "";
        document.getElementById("agr-biller").value = agr.biller || "Lucre";
        document.getElementById("agr-desc").value = agr.description || "";
        document.getElementById("agr-frequency").value = agr.frequency || "MONTHLY";
        document.getElementById("agr-account").value = agr.accountId || "";
        document.getElementById("agr-currency").value = agr.currency || "ARS";
        document.getElementById("agr-amount").value = agr.amount || 0;
        document.getElementById("agr-hasInvoice").value = agr.hasInvoice ? "true" : "false";
        document.getElementById("agr-last-update").textContent = agr.updatedAt ? parseFirestoreDate(agr.updatedAt).toLocaleString() : "-";
        
        modalAgreement.show();
    };

    // --- Agreements Management ---
    function initAgreementsListener() {
        if (isAgreementChecking) return;
        dbFirestore.collection("cashflow_agreements").where("isActive", "!=", false).onSnapshot(snapshot => {
            allAgreements = [];
            snapshot.forEach(doc => allAgreements.push({ id: doc.id, ...doc.data() }));
            renderAgreementsTable(); // Table
            renderMonthlyControl(); // Monthly grid summary
        });
    }

    function renderMonthlyControl() {
        const list = document.getElementById("monthly-control-list");
        if (!list) return;

        const year = document.getElementById("filter-year").value;
        const period = document.getElementById("filter-period").value;
        if (!/^\d{2}$/.test(period)) {
            list.innerHTML = '<tr><td colspan="6" class="text-center text-muted">Seleccione un mes para ver control.</td></tr>';
            return;
        }

        const periodKey = `${year}-${period}`;
        const activeAgreements = allAgreements.filter(a => a.isActive !== false && a.hasInvoice !== false);
        
        list.innerHTML = "";
        let totalContractedArs = 0, totalContractedUsd = 0;
        let totalInvoicedArs = 0, totalInvoicedUsd = 0;

        if (activeAgreements.length === 0) {
            list.innerHTML = '<tr><td colspan="6" class="text-center text-muted">No hay acuerdos facturables.</td></tr>';
        }

        activeAgreements.forEach(agr => {
            const client = allClients.find(c => c.id === agr.clientId);
            const name = client ? client.name : (agr.clientId ? "⚠️ " + agr.name : agr.name);
            const inv = agr.invoices && agr.invoices[periodKey];
            const isSent = inv && inv.sent;

            if (agr.currency === "ARS") totalContractedArs += agr.amount; else totalContractedUsd += agr.amount;
            if (isSent) { if (agr.currency === "ARS") totalInvoicedArs += agr.amount; else totalInvoicedUsd += agr.amount; }

            list.innerHTML += `
                <tr>
                    <td><h6 class="mb-0 font-size-13">${name}</h6></td>
                    <td><small class="text-muted">${agr.cuit || "-"}</small></td>
                    <td><span class="badge badge-soft-info">${agr.biller || "Lucre"}</span></td>
                    <td>${formatCurrency(agr.amount, agr.currency)}</td>
                    <td>
                        <div class="form-check form-switch mb-0">
                            <input class="form-check-input" type="checkbox" ${isSent ? 'checked' : ''} onchange="toggleInvoiceSent('${agr.id}', '${periodKey}', this)">
                            <label class="form-check-label small">${isSent ? 'FACTURADO' : 'PENDIENTE'}</label>
                        </div>
                    </td>
                </tr>
            `;
        });

        // Update Summary Badges
        document.getElementById("summary-agr-contracted").textContent = formatCurrency(totalContractedArs, "ARS") + (totalContractedUsd > 0 ? " + " + formatCurrency(totalContractedUsd, "USD") : "");
        document.getElementById("summary-agr-invoiced").textContent = formatCurrency(totalInvoicedArs, "ARS") + (totalInvoicedUsd > 0 ? " + " + formatCurrency(totalInvoicedUsd, "USD") : "");
    }

    function renderMobileAccounts() {
        const container = document.getElementById("mobile-accounts-horizontal");
        if (!container) return;
        container.innerHTML = "";

        allAccounts.filter(a => a.isActive !== false).forEach(acc => {
            const bal = getAccountBalance(acc.id);
            container.innerHTML += `
                <div class="card border-0 shadow-sm rounded-4 me-3" style="min-width: 140px; background: #fff;">
                    <div class="card-body p-3">
                        <small class="text-muted d-block text-truncate mb-1">${acc.name}</small>
                        <h5 class="mb-0 font-size-15 ${bal < 0 ? 'text-danger' : 'text-primary'}" style="white-space:nowrap">${formatCurrency(bal, acc.currency)}</h5>
                    </div>
                </div>
            `;
        });
    }

    function renderAgreementsTable() {
        const body = document.querySelector("#table-agreements tbody");
        if (!body) return;
        body.innerHTML = "";

        const period = document.getElementById("filter-period").value;
        const year = document.getElementById("filter-year").value;
        const showArchived = document.getElementById("switch-show-archived-agreements")?.checked || false;

        const list = showArchived ? allAgreements : allAgreements.filter(a => a.isActive !== false);

        if (list.length === 0) {
            body.innerHTML = '<tr><td colspan="7" class="text-center text-muted">No hay acuerdos.</td></tr>';
            return;
        }

        list.forEach(agr => {
            const client = allClients.find(c => c.id === agr.clientId);
            const clientName = client ? client.name : (agr.clientId ? "⚠️ " + agr.name : agr.name);
            const amountStr = formatCurrency(agr.amount, agr.currency);
            
            const periodKey = `${year}-${period}`;
            const invStatus = agr.invoices && agr.invoices[periodKey] && agr.invoices[periodKey].sent;
            const statusHtml = /^\d{2}$/.test(period) ? `
                <div class="form-check form-switch mb-0">
                    <input class="form-check-input" type="checkbox" ${invStatus ? "checked" : ""} onchange="toggleInvoiceSent('${agr.id}', '${periodKey}', this)">
                    <label class="form-check-label small">${invStatus ? "COBRADO" : "PENDIENTE"}</label>
                </div>
            ` : "-";

            body.innerHTML += `
                <tr class="${!agr.isActive ? 'opacity-50' : ''}">
                    <td>${clientName}</td>
                    <td><span class="badge badge-soft-primary">${agr.category || "Honorarios"}</span></td>
                    <td>${agr.frequency || "MONTHLY"}</td>
                    <td>${amountStr}</td>
                    <td>${statusHtml}</td>
                    <td>
                        <button class="btn btn-sm btn-soft-info" onclick="editAgreement('${agr.id}')"><i class="mdi mdi-pencil"></i></button>
                    </td>
                </tr>
            `;
        });
    }

    window.toggleInvoiceSent = async function(id, periodKey, el) {
        const isSent = el.checked;
        const agr = allAgreements.find(a => a.id === id);
        if (!agr) return;

        try {
            if (isSent) {
                // Logic for 3-state or simple marking
                // For simplicity here, just mark as sent and create income if needed
                const incomeData = {
                    type: "INCOME",
                    entityName: agr.name + " (" + periodKey + ")",
                    category: agr.category || "Honorarios",
                    amount: agr.amount,
                    currency: agr.currency,
                    accountId: agr.accountId || "",
                    status: "PAID",
                    date: firebase.firestore.Timestamp.fromDate(new Date()),
                    agreementId: id,
                    periodKey: periodKey,
                    createdAt: new Date(),
                    createdBy: getEffectiveUID()
                };
                const doc = await dbFirestore.collection("transactions").add(incomeData);
                
                const update = {};
                update[`invoices.${periodKey}`] = { sent: true, date: new Date().toISOString().split("T")[0], incomeId: doc.id };
                await dbFirestore.collection("cashflow_agreements").doc(id).update(update);
            } else {
                const inv = agr.invoices[periodKey];
                if (inv && inv.incomeId) await dbFirestore.collection("transactions").doc(inv.incomeId).delete();
                const update = {};
                update[`invoices.${periodKey}`] = firebase.firestore.FieldValue.delete();
                await dbFirestore.collection("cashflow_agreements").doc(id).update(update);
            }
        } catch (e) {
            console.error("Error toggling invoice", e);
            el.checked = !isSent;
        }
    };

    // --- Account Summary & Logic ---
    function renderAccountSummary() {
        const container = document.getElementById("account-summary-list");
        if (!container) return;
        container.innerHTML = "";

        allAccounts.filter(a => a.isActive !== false).forEach(acc => {
            const bal = getAccountBalance(acc.id);
            container.innerHTML += `
                <tr>
                    <td>${acc.name}</td>
                    <td>${acc.currency}</td>
                    <td class="${bal < 0 ? 'text-danger' : ''}">${formatCurrency(bal, acc.currency)}</td>
                </tr>
            `;
        });
    }

    function getAccountBalance(accId) {
        const acc = allAccounts.find(a => a.id === accId);
        if (!acc) return 0;
        let bal = parseFloat(acc.initialBalance) || 0;
        allTransactions.filter(tx => tx.accountId === accId && tx.status === "PAID").forEach(tx => {
            if (tx.type === "INCOME") bal += tx.amount;
            else if (tx.type === "EXPENSE") bal -= tx.amount;
        });
        return bal;
    }

    function updateKPICard(id, val) {
        const el = document.getElementById(id);
        if (el) {
            const currency = id.includes("-usd") ? "USD" : "ARS";
            el.textContent = formatCurrency(val, currency);
        }
    }

    // --- Surplus Assistant updateSurplusAssistant ---
    function updateSurplusAssistant(netArs, netUsd, liqArs, liqUsd) {
        const container = document.getElementById("surplus-assistant-container");
        if (!container) return;

        if (netArs <= 0 && netUsd <= 0) {
            container.style.display = "none";
            return;
        }

        container.style.display = "block";
        let html = `
            <div class="alert alert-info border-0 d-flex align-items-center mb-0">
                <div class="flex-grow-1">
                    <h5 class="font-size-14 text-info mb-1"><i class="mdi mdi-robot-astray me-2"></i>Asistente de Excedente</h5>
                    <p class="text-muted font-size-12 mb-0">Tienes un excedente neto proyectado. ¿Deseas capitalizarlo?</p>
                </div>
                <div class="flex-shrink-0">
                    <button class="btn btn-primary btn-sm" onclick="openSurplusModal(${netArs}, ${netUsd})">Capitalizar</button>
                </div>
            </div>
        `;
        container.innerHTML = html;
    }

    window.openSurplusModal = async function(ars, usd) {
        let html = '<div class="text-start">';
        if (ars > 0) html += `
            <div class="mb-3">
                <label class="form-label">ARS a Guardar (Max: ${formatCurrency(ars, "ARS")})</label>
                <input id="swal-ars" class="form-control" type="number" value="${ars}" max="${ars}">
            </div>`;
        if (usd > 0) html += `
            <div class="mb-3">
                <label class="form-label">USD a Guardar (Max: ${formatCurrency(usd, "USD")})</label>
                <input id="swal-usd" class="form-control" type="number" value="${usd}" max="${usd}">
            </div>`;
        html += '</div>';

        const { value: vals } = await Swal.fire({
            title: 'Capitalizar Excedente',
            html: html,
            showCancelButton: true,
            confirmButtonText: 'Guardar Ahorro',
            preConfirm: () => ({
                ars: parseFloat(document.getElementById("swal-ars")?.value) || 0,
                usd: parseFloat(document.getElementById("swal-usd")?.value) || 0
            })
        });

        if (vals) {
            const batch = dbFirestore.batch();
            const year = document.getElementById("filter-year").value;
            const period = document.getElementById("filter-period").value;
            const date = new Date(year, parseInt(period), 0); // Last day of month

            const save = (amt, curr) => {
                if (amt <= 0) return;
                const ref = dbFirestore.collection("transactions").doc();
                batch.set(ref, {
                    type: "SAVING",
                    entityName: "Capitalización Excedente " + period + "/" + year,
                    category: "Fondo de Reserva",
                    amount: amt,
                    currency: curr,
                    status: "ACTIVE",
                    date: firebase.firestore.Timestamp.fromDate(date),
                    createdAt: new Date(),
                    createdBy: getEffectiveUID()
                });
            };

            save(vals.ars, "ARS");
            save(vals.usd, "USD");
            await batch.commit();
            Swal.fire("Éxito", "Excedente capitalizado", "success");
        }
    };

    // --- Entity Modal Quick Add ---
    // (Removed original btn-quick-add-client logic to use form-client-quick below)

    // --- Mobile FAB Logic ---
    window.toggleFabMenu = function() {
        const fabOptions = document.getElementById("mob-fab-options");
        const fabMain = document.getElementById("mob-fab-main");
        if (fabOptions && fabMain) {
            fabOptions.classList.toggle("show");
            const icon = fabMain.querySelector("i");
            if (icon) {
                if (fabOptions.classList.contains("show")) {
                    icon.style.transform = "rotate(45deg)";
                } else {
                    icon.style.transform = "rotate(0deg)";
                }
            }
        }
    };

    // --- Client Quick Add Form ---
    document.getElementById("form-client-quick")?.addEventListener("submit", async function(e) {
        e.preventDefault();
        const btn = this.querySelector('button[type="submit"]');
        const name = document.getElementById("client-name-quick").value.trim();
        const phone = document.getElementById("client-phone-quick").value.trim();
        const type = document.getElementById("client-type-quick").value;

        if (!name) return;
        btn.disabled = true;

        try {
            await dbFirestore.collection("clients").add({
                name: name,
                phone: phone,
                type: type,
                uid: getEffectiveUID(),
                createdAt: new Date()
            });
            
            const modalEl = document.getElementById("newClientModal");
            const modalIdx = bootstrap.Modal.getInstance(modalEl);
            if (modalIdx) modalIdx.hide();
            
            Swal.fire("Éxito", `Cliente ${name} creado correctamente.`, "success");
            this.reset();
        } catch (err) {
            console.error("Error quick creating client", err);
            Swal.fire("Error", "No se pudo crear el cliente.", "error");
        } finally {
            btn.disabled = false;
        }
    });

    // --- Global Event Listeners ---
    ["filter-year", "filter-period", "filter-category", "filter-account", "filter-status"].forEach(id => {
        document.getElementById(id)?.addEventListener("change", applyFilters);
    });
    document.getElementById("filter-search")?.addEventListener("input", applyFilters);
    document.getElementById("filter-only-recurring")?.addEventListener("change", applyFilters);
    document.getElementById("switch-show-archived-agreements")?.addEventListener("change", renderAgreementsTable);

    // --- Agreement Price Calc ---
    document.getElementById("btn-calc-update")?.addEventListener("click", () => {
        const percent = parseFloat(document.getElementById("agr-calc-percent").value);
        if (isNaN(percent)) return;
        const current = parseFloat(document.getElementById("agr-amount").value) || 0;
        const newValue = current * (1 + (percent / 100));
        document.getElementById("agr-amount").value = newValue.toFixed(2);
    });

    function renderAccountsTable() {
        const body = document.querySelector("#table-accounts tbody");
        if (!body) return;
        body.innerHTML = "";
        allAccounts.forEach(acc => {
            const bal = getAccountBalance(acc.id);
            body.innerHTML += `
                <tr>
                    <td>${acc.name}</td>
                    <td>${acc.currency}</td>
                    <td>${formatCurrency(bal, acc.currency)}</td>
                    <td>
                        <button class="btn btn-sm btn-soft-info border-0" onclick="editAccount('${acc.id}')"><i class="mdi mdi-pencil font-size-13"></i></button>
                    </td>
                </tr>
            `;
        });
    }

    function renderAssetsGrid() {
        const container = document.getElementById("portfolio-grid");
        if (!container) return;
        container.innerHTML = "";
        if (allAssets.length === 0) {
            container.innerHTML = '<div class="col-12 text-center text-muted py-5"><p>No hay activos registrados.</p></div>';
            return;
        }
        allAssets.forEach(asset => {
            container.innerHTML += `
                <div class="col-xl-3 col-sm-6 mb-3">
                    <div class="card h-100 border-start border-4 border-primary">
                        <div class="card-body p-3">
                            <div class="d-flex justify-content-between">
                                <h6 class="text-muted font-size-11 text-uppercase mb-2">${asset.type || 'Inversión'}</h6>
                                <i class="mdi mdi-dots-vertical cursor-pointer" onclick="editAsset('${asset.id}')"></i>
                            </div>
                            <h5 class="font-size-14 text-truncate mb-1">${asset.name}</h5>
                            <h4 class="mb-0 text-primary">${formatCurrency(asset.valuation || 0, asset.currency)}</h4>
                            <div class="mt-2">
                                <small class="text-muted">Costo: ${formatCurrency(asset.cost || 0, asset.currency)}</small>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        });
    }

    function updateAssetTypeSelect(types) {
        const select = document.getElementById("asset-type");
        if (select) {
            select.innerHTML = '<option value="">Seleccione tipo...</option>';
            types.forEach(t => select.innerHTML += `<option value="${t.name}">${t.name}</option>`);
        }
    }

    function renderAssetTypesTable(types) {
        const body = document.querySelector("#table-asset-types tbody");
        if (body) {
            body.innerHTML = "";
            types.forEach(t => body.innerHTML += `<tr><td>${t.name}</td><td><button class="btn btn-sm btn-danger border-0" onclick="deleteAssetType('${t.id}')"><i class="mdi mdi-delete"></i></button></td></tr>`);
        }
    }



    // Windows global functions for missing render calls
    window.editAccount = (id) => console.log("Edit Account", id); // To be implemented
    window.editAsset = (id) => console.log("Edit Asset", id); // To be implemented
    window.deleteAssetType = (id) => console.log("Delete Asset Type", id);

});