// 支出管理アプリ - メインロジック

// カテゴリ一覧（固定値）
const CATEGORIES = ['食費', '交通費', '娯楽費', '日用品', '医療費', '公共料金', '家賃', 'その他'];

// ローカルストレージのキー
const STORAGE_KEY = 'expenses';

// Google Apps Script の Web App URL（後で設定）
const GAS_WEB_APP_URL = ''; // TODO: GASデプロイ後にURLを設定

// LINE Notify トークン（後で設定）
const LINE_NOTIFY_TOKEN = ''; // TODO: LINE Notifyトークンを設定

/**
 * アプリケーション初期化
 */
document.addEventListener('DOMContentLoaded', () => {
    initApp();
});

/**
 * 初期化処理
 */
function initApp() {
    // 今日の日付をデフォルト設定
    document.getElementById('date').valueAsDate = new Date();

    // イベントリスナー設定
    document.getElementById('expense-form').addEventListener('submit', handleAddExpense);
    document.getElementById('sync-btn').addEventListener('click', handleSync);
    document.getElementById('complete-btn').addEventListener('click', handleCompleteNotification);

    // 初回表示
    renderExpenseList();
    renderCategorySummary();
}

/**
 * localStorage からデータを取得
 * @returns {Array} 支出データの配列
 */
function getExpenses() {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
}

/**
 * localStorage にデータを保存
 * @param {Array} expenses - 支出データの配列
 */
function saveExpenses(expenses) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(expenses));
}

/**
 * 支出追加処理
 * @param {Event} e - フォーム送信イベント
 */
function handleAddExpense(e) {
    e.preventDefault();

    // フォームデータ取得
    const date = document.getElementById('date').value;
    const category = document.getElementById('category').value;
    const amount = parseInt(document.getElementById('amount').value);
    const memo = document.getElementById('memo').value;

    // バリデーション
    if (!date || !category || !amount || amount <= 0) {
        alert('必須項目を正しく入力してください。金額は1円以上である必要があります。');
        return;
    }

    // 新しい支出オブジェクト作成
    const expense = {
        id: Date.now(),
        date: date,
        category: category,
        amount: amount,
        memo: memo
    };

    // データ保存
    const expenses = getExpenses();
    expenses.push(expense);
    saveExpenses(expenses);

    // 画面更新
    renderExpenseList();
    renderCategorySummary();

    // フォームリセット
    document.getElementById('expense-form').reset();
    document.getElementById('date').valueAsDate = new Date();

    // 成功メッセージ
    showMessage('支出を追加しました', 'success');
}

/**
 * 支出削除処理
 * @param {number} id - 削除する支出のID
 */
function handleDeleteExpense(id) {
    if (!confirm('この支出を削除しますか？')) {
        return;
    }

    // データ削除
    let expenses = getExpenses();
    expenses = expenses.filter(expense => expense.id !== id);
    saveExpenses(expenses);

    // 画面更新
    renderExpenseList();
    renderCategorySummary();

    // 成功メッセージ
    showMessage('支出を削除しました', 'success');
}

/**
 * 支出一覧を描画
 */
function renderExpenseList() {
    const expenses = getExpenses();
    const listContainer = document.getElementById('expense-list');

    // データが空の場合
    if (expenses.length === 0) {
        listContainer.innerHTML = `
            <div class="empty-state">
                <p>まだ支出が登録されていません</p>
            </div>
        `;
        return;
    }

    // 日付降順でソート
    expenses.sort((a, b) => new Date(b.date) - new Date(a.date));

    // HTML生成
    listContainer.innerHTML = expenses.map(expense => `
        <div class="expense-item">
            <div class="expense-info">
                <div class="expense-header">
                    <span class="expense-date">${formatDate(expense.date)}</span>
                    <span class="expense-category">${expense.category}</span>
                    <span class="expense-amount">${expense.amount.toLocaleString()}円</span>
                </div>
                ${expense.memo ? `<div class="expense-memo">${expense.memo}</div>` : ''}
            </div>
            <button class="expense-delete" onclick="handleDeleteExpense(${expense.id})">削除</button>
        </div>
    `).join('');
}

/**
 * カテゴリ別集計を描画
 */
function renderCategorySummary() {
    const expenses = getExpenses();
    const summaryContainer = document.getElementById('category-summary');

    // カテゴリ別に集計
    const categoryTotals = {};
    CATEGORIES.forEach(category => {
        categoryTotals[category] = 0;
    });

    expenses.forEach(expense => {
        if (categoryTotals.hasOwnProperty(expense.category)) {
            categoryTotals[expense.category] += expense.amount;
        }
    });

    // HTML生成
    summaryContainer.innerHTML = CATEGORIES.map(category => `
        <div class="category-item">
            <div class="category-name">${category}</div>
            <div class="category-amount">${categoryTotals[category].toLocaleString()}円</div>
        </div>
    `).join('');

    // 合計金額を計算
    const total = Object.values(categoryTotals).reduce((sum, amount) => sum + amount, 0);
    document.getElementById('total-amount').textContent = total.toLocaleString();
}

/**
 * Google Spreadsheet 同期処理
 */
async function handleSync() {
    if (!GAS_WEB_APP_URL) {
        alert('Google Apps Script の URL が設定されていません。\nspec.md を確認してGASをデプロイしてください。');
        return;
    }

    const expenses = getExpenses();

    if (expenses.length === 0) {
        alert('同期するデータがありません。');
        return;
    }

    try {
        showMessage('同期中...', 'info');

        const response = await fetch(GAS_WEB_APP_URL, {
            method: 'POST',
            mode: 'no-cors',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ expenses: expenses })
        });

        // no-cors モードでは response.json() が使えないため、成功と見なす
        showMessage(`${expenses.length}件のデータを同期しました`, 'success');
    } catch (error) {
        console.error('同期エラー:', error);
        showMessage('同期に失敗しました: ' + error.message, 'error');
    }
}

/**
 * 課題完了通知送信
 */
async function handleCompleteNotification() {
    if (!LINE_NOTIFY_TOKEN) {
        alert('LINE Notify トークンが設定されていません。\nmain.js の LINE_NOTIFY_TOKEN を設定してください。');
        return;
    }

    const now = new Date();
    const message = `
【🎉課題4完了報告🎉】
研修生：konaka33

完了：${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}/${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}

アプリURL:
https://konaka33.github.io/expense-tracker-training

仕様書URL:
https://github.com/konaka33/expense-tracker-training/blob/main/仕様書.md

確認をお願いします！
    `.trim();

    try {
        showMessage('通知送信中...', 'info');

        const response = await fetch('https://notify-api.line.me/api/notify', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${LINE_NOTIFY_TOKEN}`,
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: `message=${encodeURIComponent(message)}`
        });

        if (response.ok) {
            showMessage('課題完了通知を送信しました！', 'success');
        } else {
            throw new Error('通知の送信に失敗しました');
        }
    } catch (error) {
        console.error('通知エラー:', error);
        showMessage('通知の送信に失敗しました: ' + error.message, 'error');
    }
}

/**
 * 日付フォーマット
 * @param {string} dateString - YYYY-MM-DD形式の日付文字列
 * @returns {string} YYYY/MM/DD形式の日付文字列
 */
function formatDate(dateString) {
    return dateString.replace(/-/g, '/');
}

/**
 * メッセージ表示
 * @param {string} message - 表示するメッセージ
 * @param {string} type - メッセージタイプ（success, error, info）
 */
function showMessage(message, type) {
    // 簡易的なメッセージ表示（alertで代用）
    // 本格的にはtoast通知などを実装すると良い
    alert(message);
}
