const state = {
    transactions: [],
    summary: { income: 0, expense: 0, balance: 0 },
};

const elements = {
    balance: document.querySelector("#balanceValue"),
    income: document.querySelector("#incomeValue"),
    expense: document.querySelector("#expenseValue"),
    monthlyBalance: document.querySelector("#monthlyBalance"),
    monthlyIncome: document.querySelector("#monthlyIncome"),
    monthlyExpense: document.querySelector("#monthlyExpense"),
    chartRing: document.querySelector("#chartRing"),
    transactionList: document.querySelector("#transactionList"),
    filter: document.querySelector("#categoryFilter"),
    summaryMonth: document.querySelector("#summaryMonth"),
    modal: document.querySelector("#transactionModal"),
    form: document.querySelector("#transactionForm"),
    toast: document.querySelector("#toast"),
};

const money = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
});

function formatMoney(value) {
    return money.format(Number(value) || 0);
}

function localDateValue(date = new Date()) {
    const offset = date.getTimezoneOffset();
    return new Date(date.getTime() - offset * 60_000).toISOString().slice(0, 10);
}

function displayDate(dateString) {
    return new Intl.DateTimeFormat("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
    }).format(new Date(`${dateString}T00:00:00`));
}

function showToast(message, isError = false) {
    elements.toast.textContent = message;
    elements.toast.classList.toggle("error", isError);
    elements.toast.classList.add("show");
    window.setTimeout(() => elements.toast.classList.remove("show"), 2600);
}

async function api(path, options) {
    const response = await fetch(path, options);
    if (!response.ok) {
        let message = "Something went wrong. Please try again.";
        try {
            const error = await response.json();
            message = typeof error.detail === "string" ? error.detail : message;
        } catch (_) {
            // Use the friendly fallback when a response has no JSON body.
        }
        throw new Error(message);
    }
    return response.json();
}

function renderBalance(data) {
    elements.balance.textContent = formatMoney(data.balance);
    elements.income.textContent = formatMoney(data.income);
    elements.expense.textContent = formatMoney(data.expense);
}

function renderSummary(data) {
    state.summary = data;
    const total = data.income + data.expense;
    const incomePercentage = total === 0 ? 50 : (data.income / total) * 100;
    elements.monthlyBalance.textContent = formatMoney(data.balance);
    elements.monthlyIncome.textContent = formatMoney(data.income);
    elements.monthlyExpense.textContent = formatMoney(data.expense);
    elements.chartRing.style.background =
        `conic-gradient(var(--green) 0 ${incomePercentage}%, var(--peach) ${incomePercentage}% 100%)`;
}

function transactionMarkup(transaction) {
    const isIncome = transaction.type === "income";
    const sign = isIncome ? "+" : "-";
    const typeClass = isIncome ? "income" : "expense";
    const arrow = isIncome
        ? '<path d="m6 14 6-6 6 6"></path><path d="M12 8v10"></path>'
        : '<path d="m6 10 6 6 6-6"></path><path d="M12 16V6"></path>';

    return `
        <article class="transaction-item">
            <span class="transaction-symbol symbol-${typeClass}">
                <svg viewBox="0 0 24 24" aria-hidden="true">${arrow}</svg>
            </span>
            <div class="transaction-main">
                <strong>${escapeHtml(transaction.category)}</strong>
                <span>${displayDate(transaction.date)} &middot; ${typeClass}</span>
            </div>
            <span class="transaction-amount amount-${typeClass}">${sign}${formatMoney(transaction.amount)}</span>
        </article>
    `;
}

function escapeHtml(value) {
    const node = document.createElement("span");
    node.textContent = value;
    return node.innerHTML;
}

function renderTransactions(transactions) {
    state.transactions = transactions;
    if (!transactions.length) {
        const isFiltered = elements.filter.value.trim();
        elements.transactionList.innerHTML = `
            <div class="empty-state">
                <span class="empty-icon">
                    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 4h14v16H5z"></path><path d="M8 8h8M8 12h6"></path></svg>
                </span>
                <h3>${isFiltered ? "No matching category" : "No transactions yet"}</h3>
                <p>${isFiltered ? "Try another category or clear the filter." : "Add your first income or expense to see it here."}</p>
            </div>
        `;
        return;
    }

    const newestFirst = [...transactions].sort((a, b) => b.date.localeCompare(a.date));
    elements.transactionList.innerHTML = newestFirst.map(transactionMarkup).join("");
}

async function loadBalance() {
    renderBalance(await api("/balance"));
}

async function loadTransactions() {
    const category = elements.filter.value.trim();
    const query = category ? `?category=${encodeURIComponent(category)}` : "";
    renderTransactions(await api(`/transactions${query}`));
}

async function loadSummary() {
    const [year, month] = elements.summaryMonth.value.split("-");
    if (!year || !month) return;
    renderSummary(await api(`/summary/${Number(year)}/${Number(month)}`));
}

async function refreshDashboard() {
    try {
        await Promise.all([loadBalance(), loadTransactions(), loadSummary()]);
    } catch (error) {
        showToast(error.message, true);
    }
}

document.querySelector("#todayChip").textContent = new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
}).format(new Date());

const today = localDateValue();
elements.form.elements.date.value = today;
elements.summaryMonth.value = today.slice(0, 7);

document.querySelector("#openTransactionModal").addEventListener("click", () => {
    elements.modal.showModal();
});

document.querySelector("#closeTransactionModal").addEventListener("click", () => {
    elements.modal.close();
});

elements.modal.addEventListener("click", (event) => {
    if (event.target === elements.modal) elements.modal.close();
});

elements.form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const formData = new FormData(elements.form);
    const transaction = {
        type: formData.get("type"),
        amount: Number(formData.get("amount")),
        category: formData.get("category").trim(),
        date: formData.get("date"),
    };

    try {
        const result = await api("/transactions", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(transaction),
        });
        elements.modal.close();
        elements.form.reset();
        elements.form.elements.type.value = "expense";
        elements.form.elements.date.value = today;
        showToast(result.message);
        await refreshDashboard();
    } catch (error) {
        showToast(error.message, true);
    }
});

let filterTimeout;
elements.filter.addEventListener("input", () => {
    window.clearTimeout(filterTimeout);
    filterTimeout = window.setTimeout(async () => {
        try {
            await loadTransactions();
        } catch (error) {
            showToast(error.message, true);
        }
    }, 220);
});

elements.summaryMonth.addEventListener("change", async () => {
    try {
        await loadSummary();
    } catch (error) {
        showToast(error.message, true);
    }
});

refreshDashboard();
