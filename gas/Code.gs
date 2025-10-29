/**
 * Google Apps Script - 支出管理アプリ連携用コード
 *
 * 【セットアップ手順】
 * 1. Google Driveで新しいスプレッドシートを作成
 * 2. 「拡張機能」→「Apps Script」を開く
 * 3. このコードを貼り付け
 * 4. 「デプロイ」→「新しいデプロイ」を選択
 * 5. 種類: ウェブアプリ
 * 6. 次のユーザーとして実行: 自分
 * 7. アクセスできるユーザー: 全員
 * 8. デプロイして、URLをコピー
 * 9. main.js の GAS_WEB_APP_URL にURLを設定
 */

/**
 * スプレッドシートのID（このスクリプトが紐付いているスプレッドシート）
 */
function getSpreadsheet() {
  return SpreadsheetApp.getActiveSpreadsheet();
}

/**
 * シート取得（存在しない場合は作成）
 */
function getOrCreateSheet(sheetName) {
  const ss = getSpreadsheet();
  let sheet = ss.getSheetByName(sheetName);

  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
    // ヘッダー行を追加
    sheet.appendRow(['ID', '日付', 'カテゴリ', '金額', 'メモ', '登録日時']);
    // ヘッダーを太字に
    sheet.getRange(1, 1, 1, 6).setFontWeight('bold');
    // 列幅を自動調整
    sheet.autoResizeColumns(1, 6);
  }

  return sheet;
}

/**
 * POST リクエスト処理
 * @param {Object} e - リクエストオブジェクト
 */
function doPost(e) {
  try {
    // リクエストボディを解析
    const requestData = JSON.parse(e.postData.contents);
    const expenses = requestData.expenses;

    if (!expenses || !Array.isArray(expenses)) {
      return createResponse(false, 'データ形式が不正です');
    }

    // シート取得
    const sheet = getOrCreateSheet('支出データ');

    // 既存のIDを取得（重複チェック用）
    const lastRow = sheet.getLastRow();
    const existingIds = lastRow > 1
      ? sheet.getRange(2, 1, lastRow - 1, 1).getValues().flat()
      : [];

    // データを追加
    let addedCount = 0;
    const now = new Date();

    expenses.forEach(expense => {
      // 重複チェック
      if (existingIds.includes(expense.id)) {
        return; // 既に存在する場合はスキップ
      }

      // 行を追加
      sheet.appendRow([
        expense.id,
        expense.date,
        expense.category,
        expense.amount,
        expense.memo || '',
        Utilities.formatDate(now, 'JST', 'yyyy/MM/dd HH:mm:ss')
      ]);

      addedCount++;
    });

    // 列幅を自動調整
    sheet.autoResizeColumns(1, 6);

    return createResponse(true, `${addedCount}件のデータを同期しました`);

  } catch (error) {
    Logger.log('エラー: ' + error.toString());
    return createResponse(false, 'サーバーエラー: ' + error.toString());
  }
}

/**
 * GET リクエスト処理（テスト用）
 */
function doGet(e) {
  return ContentService.createTextOutput(
    JSON.stringify({
      status: 'success',
      message: 'Google Apps Script は正常に動作しています'
    })
  ).setMimeType(ContentService.MimeType.JSON);
}

/**
 * レスポンス生成
 * @param {boolean} success - 成功フラグ
 * @param {string} message - メッセージ
 */
function createResponse(success, message) {
  const response = {
    status: success ? 'success' : 'error',
    message: message
  };

  return ContentService.createTextOutput(JSON.stringify(response))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * 全データ取得（テスト・デバッグ用）
 */
function getAllExpenses() {
  const sheet = getOrCreateSheet('支出データ');
  const lastRow = sheet.getLastRow();

  if (lastRow <= 1) {
    return [];
  }

  const data = sheet.getRange(2, 1, lastRow - 1, 6).getValues();

  return data.map(row => ({
    id: row[0],
    date: row[1],
    category: row[2],
    amount: row[3],
    memo: row[4],
    registeredAt: row[5]
  }));
}

/**
 * データクリア（テスト用）
 * 注意: ヘッダー以外の全データを削除します
 */
function clearAllData() {
  const sheet = getOrCreateSheet('支出データ');
  const lastRow = sheet.getLastRow();

  if (lastRow > 1) {
    sheet.deleteRows(2, lastRow - 1);
  }

  Logger.log('全データをクリアしました');
}
