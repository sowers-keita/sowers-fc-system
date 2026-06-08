# Sowers FC System

## 機能
- ダッシュボード（請求書／生徒名簿／生徒数推移／売上管理／お知らせ／マニュアル）
- 先生ごとのログイン
- 教室ごとの請求書作成
- 前月データコピー
- 人物ごとの請求入力
- 経費入力
- 生徒名簿（入会金・月謝・在籍状態＝在籍/休会/退会）
- 名簿ページ1〜9
- クラス人数自動集計（在籍のみ）
- 生徒数推移・売上（月謝合計）の集計
- 教室マスタを `src/schools.json` に分離（教室の追加・閉鎖が容易）
- Supabase保存
- Vercel公開対応

## 教室の追加・閉鎖
`src/schools.json` を編集するだけで反映されます（コード本体の変更は不要）。
1教室 = `{ id, area, name, day, venue, defaultRate, classes:[{name,time}] }`。

## 設定手順
1. Supabaseで新規プロジェクトを作成
2. `supabase/schema.sql` を SQL Editor で実行
3. Authentication > Users で先生のメール・パスワードを作成
4. profilesテーブルに先生の user id と school_id を登録
5. Vercelに以下の環境変数を設定
   - VITE_SUPABASE_URL
   - VITE_SUPABASE_ANON_KEY
6. GitHubへアップロード
7. VercelでDeploy

## profiles登録例
```sql
insert into profiles (id, display_name, school_id, role)
values ('AUTH_USER_ID_HERE', '沢野 太郎', 'yonago-tumble', 'teacher');
```

## school_id例
- itoshima-acro
- murokawa-acro
- chatan-acro
- yonago-tumble
- matsue-gymnastics
- aki-acro
- fukuyama-acro
- showacho-fry
- komatsushima-fresh
- kamiita-fresh
- hombu-ronden
- hombu-kitajima
- hombu-anan
- hombu-yoshinogawa
