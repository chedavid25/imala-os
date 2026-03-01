// apps-analytics.js - Management Charts Logic

// Globals
let chartInstances = {}; // Store chart instances to destroy/update
let invoicesData = [];
let tasksData = [];
let clientsData = [];
let accountsData = []; // Cuentas
let assetsData = []; // Activos (Inversiones)

// Configuración
// EXCHANGE_RATE removed as per user request (no automatic conversion)

// Defaults to Current Month
const now = new Date();
let filterYear = now.getFullYear();
let filterPeriod = 'YEAR'; // YEAR, MONTH
let filterMonth = now.getMonth(); // 0-11
let filterQuarter = Math.floor(now.getMonth() / 3) + 1;
let filterSemester = now.getMonth() < 6 ? 1 : 2;
let filterCurrency = 'ARS'; // ARS, USD
let filterAccount = 'ALL'; 

// --- Initialization ---
document.addEventListener('DOMContentLoaded', function() {
    // Set Chart.js Defaults for better legibility
    if (typeof Chart !== 'undefined') {
        Chart.defaults.font.family = "'Inter', 'Roboto', 'Helvetica Neue', 'Helvetica', 'Arial', sans-serif";
        Chart.defaults.font.size = 12;
        Chart.defaults.color = '#495057';
        Chart.defaults.plugins.tooltip.padding = 10;
        Chart.defaults.plugins.tooltip.backgroundColor = 'rgba(0, 0, 0, 0.8)';
    }

    // Populate Years dynamically
    populateYearSelect();
    populateMobYearSelect();

    // Set UI Defaults for other filters
    if(document.getElementById('analytics-month')) document.getElementById('analytics-month').value = filterMonth;
    
    // Set Active Button
    updatePeriodButtons();
    updateSelectorsVisibility();

    window.Imala.auth.checkAuth(user => {
        loadData();
    });

    window.addEventListener('resize', () => {
        updateDashboard();
    });
});

function populateYearSelect() {
    const select = document.getElementById('analytics-year');
    if(!select) return;
    
    select.innerHTML = '';
    const startYear = 2024; 
    const endYear = new Date().getFullYear() + 1;

    for(let y = endYear; y >= startYear; y--) {
        const opt = document.createElement('option');
        opt.value = y;
        opt.textContent = y;
        if(y === filterYear) opt.selected = true;
        select.appendChild(opt);
    }
}

function populateMobYearSelect() {
    const select = document.getElementById('mob-analytics-year');
    if(!select) return;
    
    select.innerHTML = '';
    const startYear = 2024;
    const endYear = new Date().getFullYear() + 1;

    for(let y = endYear; y >= startYear; y--) {
        const opt = document.createElement('option');
        opt.value = y;
        opt.textContent = y;
        if(y === filterYear) opt.selected = true;
        select.appendChild(opt);
    }
}

window.syncFilters = function(type, val) {
    if(type === 'year') {
        filterYear = parseInt(val);
        const desktopYear = document.getElementById('analytics-year');
        const mobileYear = document.getElementById('mob-analytics-year');
        if(desktopYear) desktopYear.value = val;
        if(mobileYear) mobileYear.value = val;
    }
    updateDashboard();
};

window.toggleMobCurrency = function() {
    const newCurr = filterCurrency === 'ARS' ? 'USD' : 'ARS';
    appAnalytics.setCurrency(newCurr);
    const btn = document.getElementById('mob-currency-toggle');
    if(btn) btn.textContent = newCurr;
};

window.switchMobTab = function(tabName, btn) {
    // UI Update
    document.querySelectorAll('[data-mob-tab]').forEach(b => {
        b.classList.remove('btn-white', 'bg-white', 'text-primary', 'active');
        b.classList.add('btn-outline-light');
    });
    btn.classList.remove('btn-outline-light');
    btn.classList.add('btn-white', 'bg-white', 'text-primary', 'active');

    // Content Update
    document.querySelectorAll('.mob-tab-pane').forEach(p => p.classList.add('d-none'));
    const pane = document.getElementById(`mob-tab-${tabName.toLowerCase()}`);
    if(pane) pane.classList.remove('d-none');

    currentTab = tabName;
    updateDashboard();
};

// --- Data Loading ---
function loadData() {
    // 1. Transactions (Operations)
    db.collection('transactions').onSnapshot(snap => {
        invoicesData = [];
        snap.forEach(doc => {
            const d = doc.data();
            // Parse Date Helper
            let dateObj = null;
            if (d.date && d.date.seconds) dateObj = new Date(d.date.seconds * 1000);
            else if (d.date) dateObj = new Date(d.date);

            // Ensure we have a valid date object before pushing
            if (dateObj && !isNaN(dateObj.getTime())) {
                invoicesData.push({ id: doc.id, ...d, dateObj: dateObj });
            }
        });
        updateDashboard();
    });

    // 2. CRM Tasks
    db.collection('tasks').onSnapshot(snap => {
        tasksData = [];
        snap.forEach(doc => {
            const d = doc.data();
            
            // Robust Date Parsing for Tasks: dueDate (preferred for trend) > createdAt > date
            let dateObj = null;
            if (d.dueDate) dateObj = new Date(d.dueDate + 'T12:00:00'); // Ensure it's treated as local noon
            else if (d.date && d.date.seconds) dateObj = new Date(d.date.seconds * 1000);
            else if (d.createdAt && d.createdAt.seconds) dateObj = new Date(d.createdAt.seconds * 1000);
            else if (d.createdAt) dateObj = new Date(d.createdAt);
            else if (d.date) dateObj = new Date(d.date);
            
            tasksData.push({ id: doc.id, ...d, dateObj: dateObj });
        });
        updateDashboard();
    });

    // 3. Clients
    db.collection('clients').onSnapshot(snap => {
        clientsData = [];
        snap.forEach(doc => {
            clientsData.push({ id: doc.id, ...doc.data() });
        });
        updateDashboard();
    });

    // 4. Accounts (Liquidity)
    db.collection('cashflow_accounts').onSnapshot(snap => {
        accountsData = [];
        snap.forEach(doc => accountsData.push({ id: doc.id, ...doc.data() }));
        populateAccountSelect();
        updateDashboard();
    });

    // 5. Assets (Wealth)
    db.collection('cashflow_assets').onSnapshot(snap => {
        assetsData = [];
        snap.forEach(doc => {
            const d = doc.data();
            if(!d.isDeleted) {
                assetsData.push({ id: doc.id, ...d });
            }
        });
        updateDashboard();
    });
}

function populateAccountSelect() {
    const select = document.getElementById('analytics-account');
    if (!select) return;

    // Keep "Todas las Cuentas"
    select.innerHTML = '<option value="ALL">Todas las Cuentas</option>';

    accountsData.filter(a => a.isActive !== false).forEach(acc => {
        const opt = document.createElement('option');
        opt.value = acc.id;
        opt.textContent = `${acc.name} (${acc.currency})`;
        if (acc.id === filterAccount) opt.selected = true;
        select.appendChild(opt);
    });
}

// --- Dashboard Logic ---

const appAnalytics = {
    setPeriod: (period) => {
        filterPeriod = period;
        updatePeriodButtons();
        updateSelectorsVisibility();
        updateDashboard();
    },

    setCurrency: (curr) => {
        filterCurrency = curr;
        // Update UI Labels
        document.querySelectorAll('.currency-label').forEach(el => el.innerText = curr);
        
        // Mobile Toggle Button Sync
        const mobCurrBtn = document.getElementById('mob-currency-toggle');
        if(mobCurrBtn) mobCurrBtn.textContent = curr;

        // Update selection state if needed
        const btnArs = document.getElementById('currency-ars');
        const btnUsd = document.getElementById('currency-usd');
        if (btnArs) btnArs.checked = (curr === 'ARS');
        if (btnUsd) btnUsd.checked = (curr === 'USD');
        
        updateDashboard();
    },

    showChartHelp: (chartKey) => {
        const helpData = {
            'RUN_RATE': {
                title: 'Ayuda: Run Rate (Ingresos vs Gastos)',
                content: `
                    <p>Este gráfico muestra el pulso operativo de tu negocio mes a mes:</p>
                    <ul class="text-muted">
                        <li><strong>Ingresos (Verde):</strong> Dinero que entra por ventas o servicios.</li>
                        <li><strong>Gastos (Rojo):</strong> Costos operativos y salidas de dinero.</li>
                    </ul>
                    <p class="mb-0"><strong>Interpretación:</strong> Lo ideal es ver las barras verdes consistentemente por encima de las rojas. Si la diferencia se achica, tu margen operativo está bajo presión.</p>
                `
            },
            'COST_STRUCTURE': {
                title: 'Ayuda: Estructura de Costos',
                content: `
                    <p>Visualiza en qué se está yendo tu dinero:</p>
                    <p class="text-muted">Divide tus gastos por categorías para identificar los centros de mayor costo.</p>
                    <p class="mb-0"><strong>Interpretación:</strong> Te permite detectar gastos "hormiga" o áreas donde podrías optimizar recursos si un sector se vuelve demasiado dominante.</p>
                `
            },
            'INCOME_TREND': {
                title: 'Ayuda: Tendencia de Ingresos',
                content: `
                    <p>Compara tus ingresos actuales con el mismo periodo del año anterior:</p>
                    <ul class="text-muted">
                        <li><strong>Año Actual:</strong> Tu desempeño presente.</li>
                        <li><strong>Año Anterior (Línea tenue):</strong> Tu referencia histórica.</li>
                    </ul>
                    <p class="mb-0"><strong>Interpretación:</strong> Te ayuda a entender la estacionalidad de tu negocio y a validar si estás creciendo interanualmente.</p>
                `
            },
            'ASSET_ALLOCATION': {
                title: 'Ayuda: Asignación de Activos',
                content: `
                    <p>Muestra cómo está distribuido tu patrimonio invertido:</p>
                    <p class="text-muted">Indica el porcentaje de capital en cada tipo de activo (ej: Cripto, Acciones, Inmuebles, Fondo de Emergencia).</p>
                    <p class="mb-0"><strong>Interpretación:</strong> Es clave para la gestión de riesgo. Una cartera diversificada te protege contra la volatilidad de un sector específico.</p>
                `
            },
            'CURRENCY_COMPOSITION': {
                title: 'Ayuda: Composición por Moneda',
                content: `
                    <p>Indica tu exposición cambiaria:</p>
                    <p class="text-muted">Muestra qué porcentaje de tu patrimonio total (Cajas + Inversiones) está en cada moneda (ARS, USD, etc.).</p>
                    <p class="mb-0"><strong>Interpretación:</strong> En contextos inflacionarios, te permite controlar si estás manteniendo una cobertura adecuada en moneda dura.</p>
                `
            },
            'WEALTH_EVOLUTION': {
                title: 'Ayuda: Evolución Patrimonial',
                content: `
                    <p>La métrica definitiva de salud financiera a largo plazo:</p>
                    <p class="text-muted">Suma el valor de todas tus cajas y activos mes a mes.</p>
                    <p class="mb-0"><strong>Interpretación:</strong> No importa cuánto ganes, sino cuánto conserves. Una pendiente ascendente indica que tu riqueza neta real está aumentando.</p>
                `
            }
        };

        const help = helpData[chartKey];
        if (help) {
            const titleEl = document.getElementById('help-title');
            const contentEl = document.getElementById('help-content');
            const modalEl = document.getElementById('modal-chart-help');

            if (titleEl) titleEl.innerText = help.title;
            if (contentEl) contentEl.innerHTML = help.content;
            
            if (modalEl) {
                const modal = new bootstrap.Modal(modalEl);
                modal.show();
            } else {
                console.warn("Help modal element not found");
                alert(help.title + "\n\n" + help.content.replace(/<[^>]*>?/gm, ''));
            }
        }
    },
    
    switchTab: (tabName) => {
        currentTab = tabName;
        setTimeout(() => {
            Object.values(chartInstances).forEach(chart => {
                if(chart && typeof chart.resize === 'function') chart.resize();
            });
            updateDashboard(); // Re-render for the specific tab
        }, 200);
    },

    showChartHelp: (chartKey) => {
        const helpData = {
            'WEALTH_EVOLUTION': {
                title: 'Ayuda: Evolución del Patrimonio',
                content: `
                    <p>Este gráfico muestra la trayectoria de tu capital durante todo el año:</p>
                    <ul class="text-muted">
                        <li><strong>Caja Disponible (Línea Azul):</strong> Es tu liquidez real. Dinero libre para gastar después de operar y ahorrar.</li>
                        <li><strong>Reservas Totales (Línea Verde):</strong> Es el acumulado de todos tus ahorros y fondos de reserva activos.</li>
                    </ul>
                    <p class="mb-0"><strong>Tip:</strong> Busca que la línea verde siempre suba, indicando que tu patrimonio crece mes a mes.</p>
                `
            },
            'SAVINGS_DISTRIBUTION': {
                title: 'Ayuda: Distribución por Metas',
                content: `
                    <p>Muestra cómo tienes repartido tu capital de reserva actual:</p>
                    <p class="text-muted">Toma el total de tus ahorros y los divide por las categorías que has definido (ej. Inversiones, Fondo de Emergencia, Viajes).</p>
                    <p class="mb-0"><strong>Tip:</strong> Te ayuda a detectar si estás demasiado concentrado en una sola meta.</p>
                `
            },
            'MONTHLY_SAVINGS': {
                title: 'Ayuda: Ahorro Mensual',
                content: `
                    <p>Mide tu ritmo de ahorro o "capitalización" mensual:</p>
                    <p class="text-muted">Cada barra representa el monto neto que lograste mover del saldo disponible hacia tus ahorros en ese mes específico.</p>
                    <p class="mb-0"><strong>Tip:</strong> Compara los picos y valles para entender qué meses son más propicios para tu ahorro.</p>
                `
            },
            'SURVIVAL_RATE': {
                title: 'Ayuda: Supervivencia Estimada',
                content: `
                    <p>Indica cuántos meses podrías mantener tu estilo de vida actual sin percibir ingresos:</p>
                    <ul class="text-muted">
                        <li><strong>Cálculo:</strong> Divide tus Reservas Totales por tu promedio de gastos de la <strong>moneda seleccionada</strong> de los últimos 6 meses.</li>
                        <li><strong>Significado:</strong> Si el valor es 6.0, significa que tienes ahorros para cubrir 6 meses de gastos en esa moneda.</li>
                        <li><strong>Nota:</strong> Si no tienes gastos registrados en esta moneda, el sistema asumirá una supervivencia prolongada (+99).</li>
                    </ul>
                    <p class="mb-0"><strong>Tip:</strong> Los expertos recomiendan tener entre 3 y 6 meses de "pista financiera" como fondo de emergencia.</p>
                `
            },
            'SAVINGS_PROGRESS': {
                title: 'Ayuda: Progreso de Metas',
                content: `
                    <p>Muestra qué tan cerca estás de alcanzar tus objetivos financieros definidos:</p>
                    <ul class="text-muted">
                        <li><strong>Rojo:</strong> Menos del 30% completado.</li>
                        <li><strong>Amarillo:</strong> Entre el 30% y 70%.</li>
                        <li><strong>Verde:</strong> Más del 70% del camino recorrido.</li>
                    </ul>
                    <p class="mb-0"><strong>Tip:</strong> Define un "Monto Objetivo" al crear un ahorro para que aparezca en este panel.</p>
                `
            },
            'CRM_STATUS': {
                title: 'Ayuda: Estado de Tareas',
                content: `
                    <p>Muestra la distribución de tus tareas actuales por su estado de gestión:</p>
                    <p class="text-muted">Te permite ver rápidamente cuántas tareas tienes pendientes, en curso o completadas.</p>
                    <p class="mb-0"><strong>Tip:</strong> Ideal para identificar cuellos de botella en la gestión diaria.</p>
                `
            },
            'CRM_CLIENTS': {
                title: 'Ayuda: Top Clientes Activos',
                content: `
                    <p>Identifica a los clientes que requieren mayor atención:</p>
                    <p class="text-muted">Muestra los 5 clientes que tienen más tareas abiertas (no completadas).</p>
                    <p class="mb-0"><strong>Tip:</strong> Te ayuda a priorizar tu tiempo hacia los casos con mayor actividad o complejidad.</p>
                `
            },
            'CRM_TREND': {
                title: 'Ayuda: Tendencia de Tareas',
                content: `
                    <p>Mide tu productividad operativa en los últimos 6 meses:</p>
                    <p class="text-muted">Muestra la cantidad de tareas que lograste cerrar (estado "Completada") cada mes.</p>
                    <p class="mb-0"><strong>Tip:</strong> Una línea ascendente o estable indica un buen ritmo de resolución de requerimientos.</p>
                `
            }
        };

        const help = helpData[chartKey];
        if (help) {
            document.getElementById('help-title').innerText = help.title;
            document.getElementById('help-content').innerHTML = help.content;
            const modal = new bootstrap.Modal(document.getElementById('modal-chart-help'));
            modal.show();
        }
    },

    applyFilters: () => {
        filterYear = parseInt(document.getElementById('analytics-year').value);
        if(document.getElementById('analytics-month')) filterMonth = parseInt(document.getElementById('analytics-month').value);
        if(document.getElementById('analytics-quarter')) filterQuarter = parseInt(document.getElementById('analytics-quarter').value);
        if(document.getElementById('analytics-semester')) filterSemester = parseInt(document.getElementById('analytics-semester').value);
        filterAccount = document.getElementById('analytics-account').value;
        updateDashboard();
    }
};

let currentTab = 'BILLING';

function updatePeriodButtons() {
    document.querySelectorAll('.btn-group button').forEach(b => b.classList.remove('active'));
    const btnId = 'btn-period-' + filterPeriod.toLowerCase();
    const btn = document.getElementById(btnId);
    if(btn) btn.classList.add('active');
}

function updateSelectorsVisibility() {
    // Hide all first
    const m = document.getElementById('analytics-month');
    const q = document.getElementById('analytics-quarter');
    const s = document.getElementById('analytics-semester');

    if (m) m.classList.add('d-none');
    if (q) q.classList.add('d-none');
    if (s) s.classList.add('d-none');

    // Show specific
    if (filterPeriod === 'MONTH' && m) m.classList.remove('d-none');
    if (filterPeriod === 'QUARTER' && q) q.classList.remove('d-none');
    if (filterPeriod === 'SEMESTER' && s) s.classList.remove('d-none');
}
function updateDashboard() {
    const isMobile = window.innerWidth < 992;
    
    // 1. Filter Transactions (Operations)
    let filteredTx = invoicesData;
    if (filterAccount !== 'ALL') {
        filteredTx = invoicesData.filter(tx => tx.accountId === filterAccount);
    }

    // Filter by Year
    const yearTx = filteredTx.filter(tx => tx.dateObj.getFullYear() === filterYear);

    // Filter by Period for KPIs
    const periodData = yearTx.filter(tx => {
        if (filterPeriod === 'MONTH') return tx.dateObj.getMonth() === filterMonth;
        if (filterPeriod === 'QUARTER') {
            const m = tx.dateObj.getMonth();
            if (filterQuarter === 1) return m >= 0 && m <= 2;
            if (filterQuarter === 2) return m >= 3 && m <= 5;
            if (filterQuarter === 3) return m >= 6 && m <= 8;
            if (filterQuarter === 4) return m >= 9 && m <= 11;
        }
        if (filterPeriod === 'SEMESTER') {
            const m = tx.dateObj.getMonth();
            if (filterSemester === 1) return m >= 0 && m <= 5;
            if (filterSemester === 2) return m >= 6 && m <= 11;
        }
        return true; // YEAR
    });

    // 2. Calculate KPIs
    calculateOperativeKPIs(periodData, isMobile);
    calculateWealthKPIs(isMobile);
    
    // 3. Render Charts based on Tab
    if (currentTab === 'BILLING') {
        renderOperativeDashboard(yearTx, periodData, isMobile); 
    } else if (currentTab === 'SAVINGS') {
        renderWealthDashboard(isMobile);
    } else if (currentTab === 'CRM') {
        updateCRMDashboard(isMobile);
    }
}

function calculateOperativeKPIs(periodData, isMobile) {
    let income = 0;
    let expenses = 0;
    let savings = 0;

    periodData.forEach(tx => {
        if (tx.currency !== filterCurrency) return; // Strict currency filtering

        let amount = parseFloat(tx.amount) || 0;
        if (tx.type === 'INCOME') income += amount;
        else if (tx.type === 'EXPENSE' && tx.category !== 'INVESTMENT') {
            // Filter out transfers and account names from expenses
            const categoryUpper = (tx.category || "").toUpperCase();
            const isTransfer = categoryUpper.includes("TRANSFERENCIA");
            const isAccountName = accountsData.some(acc => (acc.name || "").toUpperCase() === categoryUpper);
            
            if (!isTransfer && !isAccountName) {
                expenses += amount;
            }
        }
        else if (tx.type === 'SAVING') savings += amount;
    });

    const profit = income - expenses;
    const savingsRate = income > 0 ? (profit / income) * 100 : 0;

    // Update Desktop UI
    const kpiBilled = document.getElementById('kpi-billed');
    const kpiExpenses = document.getElementById('kpi-expenses');
    const kpiProfit = document.getElementById('kpi-profit');
    const kpiSavings = document.getElementById('kpi-savings-rate');

    if(kpiBilled) kpiBilled.innerText = formatCurrency(income);
    if(kpiExpenses) kpiExpenses.innerText = formatCurrency(expenses);
    if(kpiProfit) kpiProfit.innerText = formatCurrency(profit);
    if(kpiSavings) kpiSavings.innerText = savingsRate.toFixed(1);

    // Update Mobile UI
    const mobBilled = document.getElementById('mob-kpi-billed');
    const mobExpenses = document.getElementById('mob-kpi-expenses');
    if(mobBilled) mobBilled.innerText = formatCurrency(income);
    if(mobExpenses) mobExpenses.innerText = formatCurrency(expenses);
}

function calculateWealthKPIs() {
    let totalLiquidity = 0;
    let totalInvested = 0;

    // 1. Accounts Liquidity (Dynamic Calculation)
    accountsData.filter(acc => acc.currency === filterCurrency).forEach(acc => {
        totalLiquidity += getAccountBalance(acc.id);
    });

    // 2. Assets (Inversiones)
    assetsData.filter(asset => asset.currency === filterCurrency).forEach(asset => {
        // Use currentValuation if available, otherwise investedAmount
        let value = parseFloat(asset.currentValuation) || parseFloat(asset.investedAmount) || parseFloat(asset.amount) || 0;
        totalInvested += value;
    });

    const totalWealth = totalLiquidity + totalInvested;

    // 3. Runway (Average monthly expenses of LAST 3 MONTHS)
    const now = new Date();
    const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 3, 1);
    
    const recentExpenses = invoicesData.filter(tx => 
        tx.type === 'EXPENSE' && 
        tx.category !== 'INVESTMENT' &&
        tx.dateObj >= threeMonthsAgo
    );

    let totalRecentExpenses = 0;
    recentExpenses.forEach(tx => {
        if (tx.currency !== filterCurrency) return;
        let amount = parseFloat(tx.amount) || 0;
        totalRecentExpenses += amount;
    });

    const avgMonthlyExpense = totalRecentExpenses / 3;
    const runway = avgMonthlyExpense > 0 ? totalLiquidity / avgMonthlyExpense : (totalLiquidity > 0 ? 99 : 0);

    // Update UI
    if(document.getElementById('kpi-total-wealth')) document.getElementById('kpi-total-wealth').innerText = formatCurrency(totalWealth);
    if(document.getElementById('kpi-liquidity')) document.getElementById('kpi-liquidity').innerText = formatCurrency(totalLiquidity);
    if(document.getElementById('kpi-invested')) document.getElementById('kpi-invested').innerText = formatCurrency(totalInvested);
    if(document.getElementById('kpi-survival-months')) document.getElementById('kpi-survival-months').innerText = runway.toFixed(1);
}

// --- Chart Rendering ---

function renderOperativeDashboard(yearTx, periodData, isMobile) {
    const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    const incomeByMonth = new Array(12).fill(0);
    const expenseByMonth = new Array(12).fill(0);
    const prevYearIncome = new Array(12).fill(0);

    yearTx.forEach(tx => {
        if (tx.currency !== filterCurrency) return;
        const m = tx.dateObj.getMonth();
        let amount = parseFloat(tx.amount) || 0;

        if (tx.type === 'INCOME') incomeByMonth[m] += amount;
        else if (tx.type === 'EXPENSE' && tx.category !== 'INVESTMENT') expenseByMonth[m] += amount;
    });

    // Charts Config
    const runRateConfig = {
        labels: months,
        datasets: [
            {
                label: 'Ingresos ' + filterYear,
                data: incomeByMonth,
                backgroundColor: '#2ab57d',
                borderRadius: 5
            },
            {
                label: 'Gastos ' + filterYear,
                data: expenseByMonth,
                backgroundColor: '#fd625e',
                borderRadius: 5
            }
        ]
    };

    if (isMobile) {
        createChart('mob-chart-run-rate', 'bar', runRateConfig);
        renderExpenseDistribution(periodData, true);
    } else {
        createChart('chart-billing-trend', 'bar', runRateConfig);
        renderExpenseDistribution(periodData, false);
        renderIncomeTrend(yearTx);
    }
}

function renderIncomeTrend(yearTx) {
    const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    const incomeTrend = new Array(12).fill(0);
    const expenseTrend = new Array(12).fill(0);

    yearTx.forEach(tx => {
        if (tx.currency !== filterCurrency) return;
        const m = tx.dateObj.getMonth();
        let amount = parseFloat(tx.amount) || 0;

        if (tx.type === 'INCOME') incomeTrend[m] += amount;
        else if (tx.type === 'EXPENSE' && tx.category !== 'INVESTMENT') {
            // Re-apply common expense filters
            const cat = tx.category || '';
            const isTransfer = cat.toUpperCase().includes("TRANSFERENCIA");
            const isAccountName = accountsData.some(acc => (acc.name || "").toUpperCase() === cat.toUpperCase());
            if (!isTransfer && !isAccountName) {
                expenseTrend[m] += amount;
            }
        }
    });

    const trendConfig = {
        labels: months,
        datasets: [
            {
                label: 'Ingresos Trend',
                data: incomeTrend,
                borderColor: '#2ab57d',
                backgroundColor: 'rgba(42, 181, 125, 0.1)',
                fill: true,
                tension: 0.4
            },
            {
                label: 'Gastos Trend',
                data: expenseTrend,
                borderColor: '#fd625e',
                backgroundColor: 'rgba(253, 98, 94, 0.1)',
                fill: true,
                tension: 0.4
            }
        ]
    };

    createChart('chart-income-trend', 'line', trendConfig);
}

function renderExpenseDistribution(periodData, isMobile) {
    const expenseDataMap = {};
    let totalExpenses = 0;

    periodData.filter(tx => tx.type === 'EXPENSE' && tx.category !== 'INVESTMENT' && tx.currency === filterCurrency).forEach(tx => {
        const cat = tx.category || 'Otros';
        
        // Filter out transfers and account names
        const categoryUpper = cat.toUpperCase();
        const isTransfer = categoryUpper.includes("TRANSFERENCIA");
        const isAccountName = accountsData.some(acc => (acc.name || "").toUpperCase() === categoryUpper);
        
        if (isTransfer || isAccountName) return;

        let amount = parseFloat(tx.amount) || 0;
        expenseDataMap[cat] = (expenseDataMap[cat] || 0) + amount;
        totalExpenses += amount;
    });

    // Convert to array and sort descending
    const sortedExpenses = Object.entries(expenseDataMap)
        .sort((a, b) => b[1] - a[1]);

    const labels = sortedExpenses.map(x => x[0]);
    const values = sortedExpenses.map(x => x[1]);

    const config = {
        labels: labels,
        datasets: [{
            data: values,
            backgroundColor: ["#5156be", "#2ab57d", "#fd625e", "#ffbf53", "#4ba6ef", "#ff813e", "#e83e8c", "#bcbedc", "#9499d4"]
        }]
    };

    const canvasId = isMobile ? 'mob-chart-expenses' : 'chart-expenses-dist';
    createChart(canvasId, 'doughnut', config);

    // Render List
    const listContainer = document.getElementById('expense-list-container');
    if (listContainer && !isMobile) {
        listContainer.innerHTML = '';
        sortedExpenses.forEach(([cat, amt], index) => {
            const percentage = totalExpenses > 0 ? ((amt / totalExpenses) * 100).toFixed(1) : 0;
            const itemHtml = `
                <div class="mb-3">
                    <div class="d-flex align-items-center mb-1">
                        <div class="flex-grow-1">
                            <h5 class="font-size-14 mb-0">${cat}</h5>
                        </div>
                        <div class="flex-shrink-0 text-end">
                            <span class="text-muted font-size-13">${formatCurrency(amt)}</span>
                            <span class="badge bg-light text-muted ms-1">${percentage}%</span>
                        </div>
                    </div>
                    <div class="progress animated-progess custom-progress" style="height: 6px;">
                        <div class="progress-bar" role="progressbar" style="width: ${percentage}%; background-color: ${config.datasets[0].backgroundColor[index % config.datasets[0].backgroundColor.length]}" 
                            aria-valuenow="${percentage}" aria-valuemin="0" aria-valuemax="100"></div>
                    </div>
                </div>`;
            listContainer.innerHTML += itemHtml;
        });
        
        if (sortedExpenses.length === 0) {
            listContainer.innerHTML = '<p class="text-muted text-center py-3">No hay gastos registrados en este periodo.</p>';
        }
    }
}

function renderWealthDashboard(isMobile) {
    const assetCats = {};
    assetsData.filter(asset => asset.currency === filterCurrency).forEach(asset => {
        const cat = asset.category || 'Inversión';
        let value = parseFloat(asset.currentValuation) || parseFloat(asset.investedAmount) || parseFloat(asset.amount) || 0;
        assetCats[cat] = (assetCats[cat] || 0) + value;
    });

    const config = {
        labels: Object.keys(assetCats),
        datasets: [{
            data: Object.values(assetCats),
            backgroundColor: ["#5156be", "#2ab57d", "#ffbf53", "#fd625e", "#4ba6ef"]
        }]
    };

    if (isMobile) {
        createChart('mob-chart-assets', 'doughnut', config);
        renderNetWorthEvolution(true);
    } else {
        createChart('chart-asset-allocation', 'doughnut', config);
        renderCurrencyComposition();
        renderNetWorthEvolution(false);
    }

    // Progress Bars (Goals)
    const container = document.getElementById('goals-progress-container');
    if (container) {
        container.innerHTML = '';
        const goals = assetsData.filter(a => a.targetAmount > 0 && a.currency === filterCurrency);
        
        if (goals.length === 0) {
            container.innerHTML = '<p class="text-muted text-center pt-5">No hay activos con "Objetivo" definido.</p>';
        } else {
            goals.forEach(g => {
                const amount = parseFloat(g.investedAmount) || parseFloat(g.amount) || 0;
                const target = parseFloat(g.targetAmount) || 0;
                const perc = Math.min(100, (amount / target) * 100);
                const colorClass = perc < 30 ? 'bg-danger' : (perc < 70 ? 'bg-warning' : 'bg-success');
                
                const html = `
                    <div class="mb-4">
                        <div class="d-flex align-items-center mb-2">
                            <div class="flex-grow-1"><h5 class="font-size-14 mb-0">${g.name}</h5></div>
                            <div class="flex-shrink-0"><span class="badge badge-soft-primary">${perc.toFixed(0)}%</span></div>
                        </div>
                        <div class="progress animated-progess custom-progress">
                            <div class="progress-bar ${colorClass}" role="progressbar" style="width: ${perc}%"></div>
                        </div>
                        <div class="d-flex justify-content-between mt-1">
                            <small class="text-muted">${formatCurrency(amount)}</small>
                            <small class="text-muted">Meta: ${formatCurrency(target)}</small>
                        </div>
                    </div>
                `;
                container.insertAdjacentHTML('beforeend', html);
            });
        }
    }
}

function renderCurrencyComposition() {
    let liqARS = 0;
    let liqUSD = 0;
    accountsData.forEach(acc => {
        let bal = getAccountBalance(acc.id);
        if(acc.currency === 'ARS') liqARS += bal;
        else if(acc.currency === 'USD') liqUSD += bal; 
    });
    
    // Currency Composition remains in absolute terms for each currency bar,
    // but the axes or scaling will depend on the filtered currency labels.

    createChart('chart-currency-composition', 'bar', {
        labels: ['Liquidez (Caja)'],
        datasets: [
            { label: 'ARS', data: [liqARS], backgroundColor: '#2ab57d' },
            { label: 'USD', data: [liqUSD], backgroundColor: '#5156be' }
        ]
    }, {
        indexAxis: 'y',
        plugins: { legend: { display: true } },
        scales: { x: { stacked: true }, y: { stacked: true } }
    });
}

function renderNetWorthEvolution(isMobile) {
    const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    const wealthTrend = new Array(12).fill(0);
    const currentM = new Date().getMonth();
    
    const kpiEl = document.getElementById('kpi-total-wealth');
    const currentTotal = kpiEl ? parseFloat(kpiEl.innerText.replace(/[^0-9.-]+/g,"")) || 0 : 0;
    
    for(let i=0; i<=currentM; i++) wealthTrend[i] = currentTotal;

    const canvasId = isMobile ? 'mob-chart-networth' : 'chart-wealth-evolution';
    createChart(canvasId, 'line', {
        labels: months,
        datasets: [{
            label: 'Patrimonio Neto',
            data: wealthTrend,
            borderColor: '#2ab57d',
            backgroundColor: 'rgba(42, 181, 125, 0.1)',
            fill: true,
            tension: 0.4
        }]
    });
}

// --- Helpers ---

function getAccountBalance(accountId) {
    const acc = accountsData.find(a => a.id === accountId);
    if (!acc) return 0;
    
    const initial = parseFloat(acc.initialBalance) || 0;
    const txs = invoicesData.filter(tx => tx.accountId === accountId && tx.status === 'PAID');
    
    const income = txs.filter(tx => tx.type === 'INCOME').reduce((sum, tx) => sum + (parseFloat(tx.amount) || 0), 0);
    const expenses = txs.filter(tx => tx.type === 'EXPENSE').reduce((sum, tx) => sum + (parseFloat(tx.amount) || 0), 0);
    const savings = invoicesData.filter(tx => tx.accountId === accountId && tx.type === 'SAVING' && tx.status === 'ACTIVE' && !tx.isInitial).reduce((sum, tx) => sum + (parseFloat(tx.amount) || 0), 0);
    const investments = txs.filter(tx => tx.type === 'INVESTMENT').reduce((sum, tx) => sum + (parseFloat(tx.amount) || 0), 0);
    const withdrawals = txs.filter(tx => tx.type === 'WITHDRAWAL').reduce((sum, tx) => sum + (parseFloat(tx.amount) || 0), 0);
    
    return initial + income - expenses - savings - investments + withdrawals;
}



// --- CRM Logic ---

function updateCRMDashboard(isMobile) {
    calculateCRMKPIs(tasksData, clientsData, isMobile); 
    renderCRMCharts(tasksData, clientsData, isMobile);
}

function calculateCRMKPIs(allTasks, allClients, isMobile) {
    const totalClients = allClients.length;
    const activeTasks = allTasks.filter(t => t.status !== 'Completada' && t.status !== 'COMPLETED' && t.status !== 'Cancelada').length;

    const nowLocal = new Date();
    const completedTasksThisMonth = allTasks.filter(t => {
        const isCompleted = (t.status === 'Completada' || t.status === 'COMPLETED');
        return isCompleted && 
               t.dateObj && 
               t.dateObj.getMonth() === nowLocal.getMonth() && 
               t.dateObj.getFullYear() === nowLocal.getFullYear();
    }).length;

    // Desktop
    const kpiClients = document.getElementById('kpi-crm-clients');
    const kpiActive = document.getElementById('kpi-crm-active-tasks');
    const kpiDone = document.getElementById('kpi-crm-completed-tasks');

    if(kpiClients) kpiClients.innerText = totalClients;
    if(kpiActive) kpiActive.innerText = activeTasks;
    if(kpiDone) kpiDone.innerText = completedTasksThisMonth;

    // Mobile (using same container IDs or specific ones if added)
    // Currently mobile just show billed/expenses in main kpi card.
}

function renderCRMCharts(allTasks, allClients, isMobile) {
    const statusCounts = {};
    allTasks.forEach(t => {
        const s = t.status || 'Sin Estado';
        statusCounts[s] = (statusCounts[s] || 0) + 1;
    });

    const statusConfig = {
        labels: Object.keys(statusCounts).map(s => {
            if(s === 'TODO' || s === 'PENDIENTE') return 'Pendiente';
            if(s === 'COMPLETED' || s === 'Completada') return 'Completado';
            if(s === 'LATE') return 'Atrasado';
            return s;
        }),
        datasets: [{
            data: Object.values(statusCounts),
            backgroundColor: ["#5156be", "#2ab57d", "#fd625e", "#ffbf53", "#4ba6ef"]
        }]
    };

    if (isMobile) {
        createChart('mob-chart-tasks', 'doughnut', statusConfig, { noCurrency: true });
        // renderCRMLeadSource or similar for mob-chart-crm?
    } else {
        createChart('chart-crm-status', 'doughnut', statusConfig, { noCurrency: true });
        renderTopClientsChart(allTasks, allClients);
        renderCompletionTrendChart(allTasks);
    }
}

function renderTopClientsChart(allTasks, allClients) {
    const clientTaskCounts = {};
    const clientMap = {};
    allClients.forEach(c => {
        const name = (c.firstName || c.lastName) 
            ? ((c.firstName || '') + ' ' + (c.lastName || '')).trim() 
            : (c.name || 'Cliente sin nombre');
        clientMap[c.id] = name;
    });

    allTasks.filter(t => t.status !== 'Completada' && t.status !== 'COMPLETED').forEach(t => {
        if(t.clientId) {
            const name = clientMap[t.clientId] || 'Desconocido';
            clientTaskCounts[name] = (clientTaskCounts[name] || 0) + 1;
        }
    });

    const topClients = Object.entries(clientTaskCounts).sort((a, b) => b[1] - a[1]).slice(0, 5);

    createChart('chart-crm-clients', 'bar', {
        labels: topClients.map(x => x[0]),
        datasets: [{ label: 'Tareas Activas', data: topClients.map(x => x[1]), backgroundColor: '#5156be', borderRadius: 5 }]
    }, { noCurrency: true });
}

function renderCompletionTrendChart(allTasks) {
    const months = [];
    const completedCounts = [];
    for(let i=5; i>=0; i--) {
        const d = new Date();
        d.setMonth(d.getMonth() - i);
        months.push(d.toLocaleString('es-ES', { month: 'short' }));
        const count = allTasks.filter(t => {
            const isCompleted = (t.status === 'Completada' || t.status === 'COMPLETED');
            return isCompleted && t.dateObj && t.dateObj.getMonth() === d.getMonth() && t.dateObj.getFullYear() === d.getFullYear();
        }).length;
        completedCounts.push(count);
    }
    createChart('chart-crm-trend', 'line', {
        labels: months,
        datasets: [{ label: 'Tareas Completadas', data: completedCounts, borderColor: '#2ab57d', fill: true, backgroundColor: 'rgba(42, 181, 125, 0.1)', tension: 0.4 }]
    }, { noCurrency: true });
}

function createChart(canvasId, type, dataConfig, extraOptions = {}) {
    const ctx = document.getElementById(canvasId);
    if(!ctx) return;

    if(chartInstances[canvasId]) {
        chartInstances[canvasId].destroy();
    }

    const isMobile = window.innerWidth < 992;

    const chartOptions = {
        responsive: true,
        maintainAspectRatio: true,
        layout: {
            padding: isMobile ? { top: 10, bottom: 10, left: 5, right: 5 } : 20
        },
        plugins: {
            legend: { 
                display: isMobile ? (type === 'pie' || type === 'doughnut' ? true : false) : true,
                position: 'bottom',
                labels: {
                    boxWidth: 12,
                    font: { size: isMobile ? 10 : 12 }
                }
            },
            tooltip: {
                callbacks: {
                    label: function(context) {
                        let label = context.dataset.label || '';
                        if (label) label += ': ';
                        
                        const value = (typeof context.parsed === 'object' && context.parsed !== null) 
                            ? context.parsed.y 
                            : context.parsed;
                            
                        const formattedValue = extraOptions.noCurrency ? value : formatCurrency(value);

                        if (type === 'pie' || type === 'doughnut') {
                            const total = context.dataset.data.reduce((a, b) => a + b, 0);
                            const percentage = total > 0 ? ((value / total) * 100).toFixed(1) + '%' : '0%';
                            return `${extraOptions.noCurrency ? context.label : label}${formattedValue} (${percentage})`;
                        }
                        return `${label}${formattedValue}`;
                    }
                }
            }
        },
        scales: type === 'bar' || type === 'line' ? {
            y: { 
                beginAtZero: true,
                grid: { color: 'rgba(0,0,0,0.05)' },
                ticks: {
                    font: { size: isMobile ? 9 : 11 },
                    callback: function(value) {
                        if (extraOptions.noCurrency) return value;
                        if (value >= 1000) return formatCurrency(value);
                        return value;
                    }
                }
            },
            x: {
                grid: { display: false },
                ticks: {
                    font: { size: isMobile ? 9 : 11 },
                    maxRotation: isMobile ? 45 : 0,
                    minRotation: isMobile ? 45 : 0
                }
            }
        } : {}
    };

    chartInstances[canvasId] = new Chart(ctx, {
        type: type,
        data: dataConfig,
        options: chartOptions
    });
}

function formatCurrency(val) {
    if(filterCurrency === 'USD') {
        return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val);
    }
    return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 0 }).format(val);
}
