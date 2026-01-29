// apps-analytics.js - Management Charts Logic

// Globals
let chartInstances = {}; // Store chart instances to destroy/update
let invoicesData = [];
let tasksData = [];
let clientsData = [];

// Defaults to Current Month
// Defaults to Current Month
const now = new Date();
let filterYear = now.getFullYear();
let filterPeriod = 'MONTH'; // YEAR, SEMESTER, QUARTER, MONTH, ALL
let filterMonth = now.getMonth(); // 0-11
let filterQuarter = Math.floor(now.getMonth() / 3) + 1; // 1-4
let filterSemester = now.getMonth() < 6 ? 1 : 2; // 1-2
let filterCurrency = 'ARS'; // ARS, USD

// --- Initialization ---
document.addEventListener('DOMContentLoaded', function() {
    // Populate Years dynamically
    populateYearSelect();

    // Set UI Defaults for other filters
    document.getElementById('analytics-month').value = filterMonth;
    document.getElementById('analytics-quarter').value = filterQuarter;
    document.getElementById('analytics-semester').value = filterSemester;
    
    // Set Active Button
    updatePeriodButtons();
    updateSelectorsVisibility();

    window.Imala.auth.checkAuth(user => {
        console.log("Analytics Auth:", user);
        loadData();
    });
});

function populateYearSelect() {
    const select = document.getElementById('analytics-year');
    if(!select) return;
    
    select.innerHTML = '';
    const startYear = 2024; // Project start
    const endYear = filterYear + 1; // Current year + 1 for flexibility

    for(let y = endYear; y >= startYear; y--) {
        const opt = document.createElement('option');
        opt.value = y;
        opt.textContent = y;
        if(y === filterYear) opt.selected = true;
        select.appendChild(opt);
    }
}

// --- Data Loading ---
function loadData() {
    // 1. Listen to Invoices (Collection: 'invoices')
    // Ensure we are reading the same collection as apps-cashflow.js
    // Confirmed via inspection: usually 'cashflow' or 'invoices'. Using 'invoices' based on previous context.
    // If apps-cashflow.js uses a different one, we will find out in verification.
    // 1. Listen to Transactions (Collection: 'transactions')
    // Corrected from 'invoices' to 'transactions' to match Cashflow module
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

    // 2. Listen to Tasks (CRM)
    db.collection('tasks').onSnapshot(snap => {
        tasksData = [];
        snap.forEach(doc => {
            const d = doc.data();
             // Parse Date Helper for Tasks
             let dateObj = null;
             if (d.createdAt && d.createdAt.seconds) dateObj = new Date(d.createdAt.seconds * 1000);
             else if (d.createdAt) dateObj = new Date(d.createdAt);
             // Also check for 'completedAt' if available, or use 'updatedAt' for completion trend
            
            tasksData.push({ id: doc.id, ...d, dateObj: dateObj });
        });
        updateDashboard();
    });

    // 3. Listen to Clients (CRM)
    db.collection('clients').onSnapshot(snap => {
        clientsData = [];
        snap.forEach(doc => {
            clientsData.push({ id: doc.id, ...doc.data() });
        });
        updateDashboard();
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
        updateDashboard();
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
        filterMonth = parseInt(document.getElementById('analytics-month').value);
        filterQuarter = parseInt(document.getElementById('analytics-quarter').value);
        filterSemester = parseInt(document.getElementById('analytics-semester').value);
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
    document.getElementById('analytics-month').classList.add('d-none');
    document.getElementById('analytics-quarter').classList.add('d-none');
    document.getElementById('analytics-semester').classList.add('d-none');

    // Show specific
    if (filterPeriod === 'MONTH') document.getElementById('analytics-month').classList.remove('d-none');
    if (filterPeriod === 'QUARTER') document.getElementById('analytics-quarter').classList.remove('d-none');
    if (filterPeriod === 'SEMESTER') document.getElementById('analytics-semester').classList.remove('d-none');
}
function updateDashboard() {
    // Filter by Currency (All relevant data for graphs)
    const currencyData = invoicesData.filter(inv => (inv.currency || 'ARS') === filterCurrency);

    // Filter by Period for KPIs and specific charts
    const periodData = currencyData.filter(inv => {
        if (!inv.dateObj) return false;
        const yearMatch = inv.dateObj.getFullYear() === filterYear;
        if (!yearMatch) return false;

        const m = inv.dateObj.getMonth();
        const q = Math.floor(m / 3) + 1;
        const s = m < 6 ? 1 : 2;

        if (filterPeriod === 'MONTH') return m === filterMonth;
        if (filterPeriod === 'QUARTER') return q === filterQuarter;
        if (filterPeriod === 'SEMESTER') return s === filterSemester;
        return true; // YEAR
    });

    calculateKPIs(periodData, currencyData);
    
    if (currentTab === 'BILLING') {
        renderBillingCharts(periodData); 
    } else if (currentTab === 'SAVINGS') {
        renderSavingsDashboard(periodData, currencyData);
    } else if (currentTab === 'CRM') {
        updateCRMDashboard();
    }
}

function calculateKPIs(periodData, allCurrencyData) {
    // 1. Period KPIs
    let periodIncome = 0;
    let periodExpenses = 0;
    let periodPending = 0;
    let periodSavings = 0;

    periodData.forEach(inv => {
        const val = parseFloat(inv.amount) || 0;
        if(inv.type === 'INCOME') {
            periodIncome += val;
            if(inv.status !== 'PAID') periodPending += val;
        } else if (inv.type === 'EXPENSE') {
            periodExpenses += val;
        } else if (inv.type === 'SAVING' && inv.status !== 'USED') {
            periodSavings += val;
        }
    });

    // 2. Accumulated KPIs (Historical up to selected year/period for Wealth calculation)
    // To match apps-cashflow.js logic:
    const nowFilter = new Date(filterYear, filterPeriod === 'MONTH' ? filterMonth + 1 : 12, 0, 23, 59, 59);
    const historicalData = allCurrencyData.filter(d => d.dateObj <= nowFilter);

    const calcAcc = (data, type, status = null, ignoreInitial = false) => {
        return data.reduce((sum, d) => {
            if (d.type !== type) return sum;
            if (status && d.status !== status) return sum;
            if (ignoreInitial && d.isInitial) return sum;
            return sum + (parseFloat(d.amount) || 0);
        }, 0);
    };

    const accIncome = calcAcc(historicalData, 'INCOME', 'PAID');
    const accExpenses = calcAcc(historicalData, 'EXPENSE', 'PAID');
    const accSavings = calcAcc(historicalData, 'SAVING', 'ACTIVE'); // All active savings
    const accSavingsNonInitial = calcAcc(historicalData, 'SAVING', 'ACTIVE', true);

    const cashAvailable = accIncome - accExpenses - accSavingsNonInitial;
    const totalWealth = cashAvailable + accSavings;

    // Update Billing Tab KPIs
    if(document.getElementById('kpi-billed')) document.getElementById('kpi-billed').innerText = formatCurrency(periodIncome);
    if(document.getElementById('kpi-expenses')) document.getElementById('kpi-expenses').innerText = formatCurrency(periodExpenses);
    if(document.getElementById('kpi-profit')) document.getElementById('kpi-profit').innerText = formatCurrency(periodIncome - periodExpenses);
    if(document.getElementById('kpi-total-wealth')) document.getElementById('kpi-total-wealth').innerText = formatCurrency(totalWealth);

    // Update Savings Tab KPIs
    if(document.getElementById('kpi-savings-total')) document.getElementById('kpi-savings-total').innerText = formatCurrency(accSavings);
    if(document.getElementById('kpi-savings-period')) document.getElementById('kpi-savings-period').innerText = formatCurrency(periodSavings);
    
    if(document.getElementById('kpi-savings-rate')) {
        const rate = periodIncome > 0 ? (periodSavings / periodIncome) * 100 : 0;
        document.getElementById('kpi-savings-rate').innerText = rate.toFixed(1);
    }

    // 3. Financial Survival (Runway)
    if(document.getElementById('kpi-survival-months')) {
        // Average expenses from last 6 months (approx 180 days)
        const sixMonthsAgo = new Date(nowFilter.getTime());
        sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
        
        const recentExpenses = allCurrencyData.filter(d => 
            d.type === 'EXPENSE' && 
            d.status === 'PAID' && 
            d.dateObj >= sixMonthsAgo && 
            d.dateObj <= nowFilter
        );
        
        const totalRecent = recentExpenses.reduce((sum, d) => sum + (parseFloat(d.amount) || 0), 0);
        // Calculate months accurately based on data range
        const avgMonthlyExpense = totalRecent / 6; 
        
        const survival = avgMonthlyExpense > 0 ? accSavings / avgMonthlyExpense : (accSavings > 0 ? 999 : 0);
        // Cap at 99 for UI if it's too high, but 1 decimal is fine
        document.getElementById('kpi-survival-months').innerText = survival >= 99 ? "+99" : survival.toFixed(1);
    }
}

// --- Chart Rendering ---

function renderBillingCharts(data) {
    // 1. Trend (Line/Bar) WITH CURRENCY FILTER
    // Note: 'data' is already filtered by Period and Currency.
    // However, for Trend, we often want to see the whole year context but in the selected currency.
    // So let's re-filter GLOBAL `invoicesData` by Year and Currency for the Trend Chart.
    
    const yearData = invoicesData.filter(inv => 
        inv.dateObj && 
        inv.dateObj.getFullYear() === filterYear &&
        (inv.currency || 'ARS') === filterCurrency
    );
    
    const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    const incomeByMonth = new Array(12).fill(0);
    const expenseByMonth = new Array(12).fill(0);

    yearData.forEach(inv => {
        const m = inv.dateObj.getMonth();
        const val = parseFloat(inv.amount) || 0;
        if(inv.type === 'INCOME') incomeByMonth[m] += val;
        else if(inv.type === 'EXPENSE') expenseByMonth[m] += val;
    });

    createChart('chart-billing-trend', 'bar', {
        labels: months,
        datasets: [
            {
                label: 'Ingresos',
                data: incomeByMonth,
                backgroundColor: '#2ab57d',
                borderRadius: 5
            },
            {
                label: 'Gastos',
                data: expenseByMonth,
                backgroundColor: '#fd625e',
                borderRadius: 5
            }
        ]
    });

    // 2. Income Distribution (Filtered Data Only)
    const incomeCats = {};
    data.filter(i => i.type === 'INCOME').forEach(inv => {
        const cat = inv.category || 'Varios';
        incomeCats[cat] = (incomeCats[cat] || 0) + parseFloat(inv.amount);
    });

    createChart('chart-income-dist', 'doughnut', {
        labels: Object.keys(incomeCats),
        datasets: [{
            data: Object.values(incomeCats),
            backgroundColor: ["#2ab57d", "#5156be", "#fd625e", "#ffbf53", "#4ba6ef"]
        }]
    });

    // 3. Expenses Distribution (Filtered Data Only)
    const expenseCats = {};
    data.filter(i => i.type === 'EXPENSE').forEach(inv => {
        const cat = inv.category || 'Otros';
        expenseCats[cat] = (expenseCats[cat] || 0) + parseFloat(inv.amount);
    });

    createChart('chart-expenses-dist', 'doughnut', {
        labels: Object.keys(expenseCats),
        datasets: [{
            data: Object.values(expenseCats),
            backgroundColor: ["#fd625e", "#ffbf53", "#4ba6ef", "#5156be", "#2ab57d"]
        }]
    });

    // 4. YTD Accumulation (Context: Year + Currency)
    let accIncome = 0;
    const ytdData = incomeByMonth.map(val => {
        accIncome += val;
        return accIncome;
    });

    createChart('chart-ytd', 'line', {
        labels: months,
        datasets: [{
            label: 'Ingresos Acumulados (YTD)',
            data: ytdData,
            borderColor: '#2ab57d',
            fill: true,
            backgroundColor: 'rgba(42, 181, 125, 0.1)',
            tension: 0.4
        }]
    });

    // 5. Collection Rate (Filtered Data)
    let paid = 0;
    let pending = 0;
    data.filter(i => i.type === 'INCOME').forEach(inv => {
         if(inv.status === 'PAID') paid += parseFloat(inv.amount);
         else pending += parseFloat(inv.amount);
    });

    createChart('chart-collection-rate', 'pie', {
        labels: ['Cobrado', 'Pendiente'],
        datasets: [{
            data: [paid, pending],
            backgroundColor: ["#2ab57d", "#ffbf53"]
        }]
    });
}

function renderSavingsDashboard(periodData, allCurrencyData) {
    const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    const yearData = allCurrencyData.filter(d => d.dateObj.getFullYear() === filterYear);

    // 1. Wealth Evolution (Accumulated by Month)
    const cashEvolution = new Array(12).fill(0);
    const savingsEvolution = new Array(12).fill(0);
    
    // Prerrequisito: Saldo de años anteriores
    let currentCash = allCurrencyData.filter(d => d.dateObj.getFullYear() < filterYear).reduce((sum, d) => {
        if(d.type === 'INCOME' && d.status === 'PAID') return sum + d.amount;
        if(d.type === 'EXPENSE' && d.status === 'PAID') return sum - d.amount;
        if(d.type === 'SAVING' && d.status === 'ACTIVE' && !d.isInitial) return sum - d.amount;
        return sum;
    }, 0);

    let currentSavings = allCurrencyData.filter(d => d.dateObj.getFullYear() < filterYear && d.type === 'SAVING' && d.status === 'ACTIVE').reduce((sum, d) => sum + d.amount, 0);

    for (let m = 0; m < 12; m++) {
        const monthTx = yearData.filter(d => d.dateObj.getMonth() === m);
        monthTx.forEach(d => {
            const val = parseFloat(d.amount) || 0;
            if(d.type === 'INCOME' && d.status === 'PAID') currentCash += val;
            else if(d.type === 'EXPENSE' && d.status === 'PAID') currentCash -= val;
            else if(d.type === 'SAVING' && d.status === 'ACTIVE') {
                currentSavings += val;
                if(!d.isInitial) currentCash -= val;
            }
        });
        cashEvolution[m] = currentCash;
        savingsEvolution[m] = currentSavings;
    }

    createChart('chart-wealth-evolution', 'line', {
        labels: months,
        datasets: [
            {
                label: 'Caja Disponible',
                data: cashEvolution,
                borderColor: '#5156be',
                backgroundColor: 'rgba(81, 86, 190, 0.1)',
                fill: true,
                tension: 0.3
            },
            {
                label: 'Reservas Totales',
                data: savingsEvolution,
                borderColor: '#2ab57d',
                backgroundColor: 'rgba(42, 181, 125, 0.1)',
                fill: true,
                tension: 0.3
            }
        ]
    });

    // 2. Savings Distribution (By Meta/Category)
    // Use historical active savings for this
    const activeSavings = allCurrencyData.filter(d => d.type === 'SAVING' && d.status === 'ACTIVE');
    const dist = {};
    activeSavings.forEach(s => {
        const cat = s.category || 'Otros';
        dist[cat] = (dist[cat] || 0) + s.amount;
    });

    createChart('chart-savings-distribution', 'doughnut', {
        labels: Object.keys(dist),
        datasets: [{
            data: Object.values(dist),
            backgroundColor: ["#2ab57d", "#4ba6ef", "#ffbf53", "#fd625e", "#5156be"]
        }]
    });

    // 3. Monthly Savings (Bars of what was saved EACH MONTH of the year)
    const monthlySaved = new Array(12).fill(0);
    yearData.filter(d => d.type === 'SAVING' && d.status === 'ACTIVE').forEach(d => {
        monthlySaved[d.dateObj.getMonth()] += d.amount;
    });

    createChart('chart-monthly-savings', 'bar', {
        labels: months,
        datasets: [{
            label: 'Ahorro Mensual',
            data: monthlySaved,
            backgroundColor: '#4ba6ef',
            borderRadius: 5
        }]
    });

    // 4. Savings Progress Bars
    const container = document.getElementById('goals-progress-container');
    if (container) {
        container.innerHTML = '';
        
        // Group by category to show progress per meta category
        // Note: For finer control, we'd need to group by individual meta names if they repeat.
        // But grouping by the latest active items with targetAmount > 0 is better.
        
        const goals = activeSavings.filter(s => s.targetAmount > 0);
        
        if (goals.length === 0) {
            container.innerHTML = '<p class="text-muted text-center py-3">No hay metas con "Monto Objetivo" definido para este periodo.</p>';
        } else {
            goals.forEach(g => {
                const perc = Math.min(100, (g.amount / g.targetAmount) * 100);
                const colorClass = perc < 30 ? 'bg-danger' : (perc < 70 ? 'bg-warning' : 'bg-success');
                
                const html = `
                    <div class="mb-4">
                        <div class="d-flex align-items-center mb-2">
                            <div class="flex-grow-1">
                                <h5 class="font-size-14 mb-0">${g.entityName || g.category}</h5>
                            </div>
                            <div class="flex-shrink-0">
                                <span class="badge badge-soft-primary">${perc.toFixed(0)}%</span>
                            </div>
                        </div>
                        <div class="progress animated-progess custom-progress">
                            <div class="progress-bar ${colorClass}" role="progressbar" style="width: ${perc}%" 
                                aria-valuenow="${perc}" aria-valuemin="0" aria-valuemax="100"></div>
                        </div>
                        <div class="d-flex justify-content-between mt-1">
                            <small class="text-muted">${formatCurrency(g.amount)} ahorrados</small>
                            <small class="text-muted">Meta: ${formatCurrency(g.targetAmount)}</small>
                        </div>
                    </div>
                `;
                container.insertAdjacentHTML('beforeend', html);
            });
        }
    }
}

// --- Helpers ---



// --- CRM Logic ---

function updateCRMDashboard() {
    // Filter Tasks based on Year/Period filters? 
    // Usually CRM is more "Current State", but "Tasks Completed" could be filtered.
    // Let's filter tasks by the global date filter for trend/completion analysis.
    // For "Active Tasks" and "Active Clients", we usually want the CURRENT status, regardless of date filter,
    // OR we can show "Active during that period". 
    // For simplicity: Status & Active Clients = Current Snapshot interaction. 
    // Completed Tasks = Filtered by selected period.

    const filteredTasks = tasksData.filter(t => {
        if (!t.dateObj) return false;
        // Basic Year Filter
        return t.dateObj.getFullYear() === filterYear;
    });

    calculateCRMKPIs(tasksData, clientsData); // Pass ALL data for current status
    renderCRMCharts(tasksData, clientsData);
}

function calculateCRMKPIs(allTasks, allClients) {
    // 1. Total Active Clients
    // Simple count of clients collection? Or clients with active tasks?
    // Let's use total clients count for now.
    const totalClients = allClients.length;

    // 2. Active Tasks
    const activeTasks = allTasks.filter(t => t.status !== 'Completada' && t.status !== 'Cancelada').length;

    // 3. Completed Tasks (This Month - regardless of global filter for this specific KPI card usually, 
    //    but let's respect global filter if 'MONTH' is selected? 
    //    Standard usage: This Month defaults.
    const nowLocal = new Date();
    const completedTasksThisMonth = allTasks.filter(t => {
        return t.status === 'Completada' && 
               t.dateObj && 
               t.dateObj.getMonth() === nowLocal.getMonth() && 
               t.dateObj.getFullYear() === nowLocal.getFullYear();
    }).length;

    document.getElementById('kpi-crm-clients').innerText = totalClients;
    document.getElementById('kpi-crm-active-tasks').innerText = activeTasks;
    document.getElementById('kpi-crm-completed-tasks').innerText = completedTasksThisMonth;
}

function renderCRMCharts(allTasks, allClients) {
    // 1. Task Status Distribution (Current Snapshot)
    const statusCounts = {};
    allTasks.forEach(t => {
        const s = t.status || 'Sin Estado';
        statusCounts[s] = (statusCounts[s] || 0) + 1;
    });

    createChart('chart-crm-status', 'doughnut', {
        labels: Object.keys(statusCounts),
        datasets: [{
            data: Object.values(statusCounts),
            backgroundColor: ["#5156be", "#2ab57d", "#fd625e", "#ffbf53", "#4ba6ef"]
        }]
    });

    // 2. Top Active Clients (Clients with most ACTIVE tasks)
    const clientTaskCounts = {};
    // Map clientId to Name first
    const clientMap = {};
    allClients.forEach(c => clientMap[c.id] = c.firstName + ' ' + c.lastName);

    allTasks.filter(t => t.status !== 'Completada').forEach(t => {
        if(t.clientId) {
            const name = clientMap[t.clientId] || 'Desconocido';
            clientTaskCounts[name] = (clientTaskCounts[name] || 0) + 1;
        }
    });

    // Sort and get Top 5
    const topClients = Object.entries(clientTaskCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5);

    createChart('chart-crm-clients', 'bar', {
        labels: topClients.map(x => x[0]),
        datasets: [{
            label: 'Tareas Activas',
            data: topClients.map(x => x[1]),
            backgroundColor: '#5156be',
            borderRadius: 5
        }]
    });

    // 3. Task Completion Trend (Last 6 Months from now)
    // Regardless of filter, usually "Last 6 Months" is a fixed standard view or YTD.
    // Let's do Last 6 Months.
    const months = [];
    const completedCounts = [];
    
    for(let i=5; i>=0; i--) {
        const d = new Date();
        d.setMonth(d.getMonth() - i);
        const mName = d.toLocaleString('es-ES', { month: 'short' });
        months.push(mName);
        
        // Count completed in this month/year
        const count = allTasks.filter(t => {
            return t.status === 'Completada' && 
                   t.dateObj && 
                   t.dateObj.getMonth() === d.getMonth() && 
                   t.dateObj.getFullYear() === d.getFullYear();
        }).length;
        completedCounts.push(count);
    }

    createChart('chart-crm-trend', 'line', {
        labels: months,
        datasets: [{
            label: 'Tareas Completadas',
            data: completedCounts,
            borderColor: '#2ab57d',
            fill: true,
            backgroundColor: 'rgba(42, 181, 125, 0.1)',
            tension: 0.4
        }]
    });
}

function createChart(canvasId, type, dataConfig) {
    const ctx = document.getElementById(canvasId);
    if(!ctx) return;

    if(chartInstances[canvasId]) {
        chartInstances[canvasId].destroy();
    }

    const chartOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: { position: 'bottom' },
            tooltip: {
                callbacks: {
                    label: function(context) {
                        let label = context.label || '';
                        if (label) label += ': ';
                        
                        const value = context.parsed;
                        const formattedValue = type === 'pie' || type === 'doughnut' 
                            ? formatCurrency(value) 
                            : value;

                        if (type === 'pie' || type === 'doughnut') {
                            const total = context.dataset.data.reduce((a, b) => a + b, 0);
                            const percentage = total > 0 ? ((value / total) * 100).toFixed(1) + '%' : '0%';
                            return `${label}${formattedValue} (${percentage})`;
                        }
                        return `${label}${formattedValue}`;
                    }
                }
            }
        },
        scales: type === 'bar' || type === 'line' ? {
            y: { beginAtZero: true }
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
