# Photo Comparison Experiment - Project Status

最終更新：2026-09-24

## 1. 現在の完成状態

画像比較実験アプリの基本機能まで完成。

現在、以下が一通り動作確認済み。

- Next.jsでWebアプリを起動
- Supabase Storageから画像を取得
- ターゲット画像をランダムに1枚選択
- 候補画像をランダムに10枚選択
- ターゲットと候補を画面に表示
- 「一致」「不一致」で回答
- ファイル名から対象IDを取得して正誤判定
- 回答時間を計測
- 回答結果をSupabase Databaseへ保存
- 10枚終了後に終了メッセージを表示

現在は「ターゲット1枚＋候補10枚」で1セットの実験になっている。

---

## 2. 開発環境

- Windows
- VS Code
- Node.js
- Next.js 16.3.6
- React 19.2.8
- TypeScript
- Tailwind CSS 4
- Supabase
- Git

プロジェクトフォルダ：

C:\Users\ryota\photo-test

---

## 3. Git

ローカルGitの初期設定済み。

現在の最初のコミット：

Commit:
17de14d

Message:
Initial working state

このコミットは、

「画像比較 → 回答 → 正誤判定 → 回答時間計測 → Supabase保存」

まで動作確認できた状態。

今後、変更して問題が起きた場合は、このコミットを基準に戻せる。

まだGitHubには公開していない。

---

## 4. Supabase Storage

Bucket：

photos

Folder：

20260922(250)

現在、このフォルダに21枚の画像がある。

画像ファイル名の例：

b_20260922_nm_A1_b.JPG
b_20260922_nm_A1_l.JPG
b_20260922_nm_A1_r.JPG
b_20260922_nm_A1_t.JPG

他に、

C2
C4
C5

などの対象IDがある。

StorageはPublic。

StorageのSELECTポリシーを設定済み。

---

## 5. ファイル名と対象ID

現在のファイル名形式：

b_20260922_nm_A1_b.JPG

「_」で分割した4番目の部分を対象IDとして使用。

例：

b_20260922_nm_A1_t.JPG

↓

["b", "20260922", "nm", "A1", "t.JPG"]

↓

parts[3]

↓

A1

現在の判定ルール：

同じ対象ID → 一致
違う対象ID → 不一致

現在の関数：

function getMatchId(filename: string) {
  const parts = filename.split("_");
  return parts[3];
}

ファイル名末尾の

b / l / r / t

は現在の正誤判定には使用していない。

---

## 6. 現在の画像選択方法

現在は完全ランダム。

ターゲット：

画像一覧からランダムに1枚。

候補：

ターゲット以外からランダムに10枚。

現在は以下の条件を設けていない。

- 一致を必ず1枚入れる
- 一致を複数入れる
- 一致を0枚にする

つまり、ターゲットと候補の選択は現在完全ランダム。

---

## 7. 回答時間

候補画像が表示されたタイミングで

performance.now()

を使用してタイマー開始。

回答時に、

response_time_ms

として保存。

---

## 8. Supabase Database

テーブル：

comparison_results

現在のテーブル構造：

create table public.comparison_results (
  id bigint generated always as identity primary key,
  target text not null,
  candidate text not null,
  answer text not null,
  is_correct boolean not null,
  response_time_ms integer not null,
  created_at timestamptz not null default now()
);

保存している情報：

- target
- candidate
- answer
- is_correct
- response_time_ms
- created_at

---

## 9. Databaseの権限

comparison_resultsはRLS有効。

匿名ユーザーからのINSERTを許可。

設定済み：

alter table public.comparison_results enable row level security;

create policy "Allow public insert comparison results"
on public.comparison_results
for insert
to anon
with check (true);

また、

grant insert on table public.comparison_results to anon;

を設定済み。

実際にアプリからSupabaseへの保存成功を確認済み。

---

## 10. Supabase接続

lib/supabase.tsでSupabaseへ接続。

.env.localにSupabaseの接続情報を設定。

.env.localはGitにコミットしない。

Supabase URLには /rest/v1 を付けない。

---

## 11. 主なファイル

app/page.tsx
→ 実験画面、画像取得、ランダム選択、回答処理、正誤判定、DB保存

lib/supabase.ts
→ Supabase接続

package.json
→ Next.js等のバージョン・コマンド

.env.local
→ Supabase接続情報（Git管理対象外）

---

# 今後やりたいこと

## 1. 10枚の候補終了後の処理

現在：

ターゲット1枚
↓
候補10枚
↓
終了

今後、

ターゲット1
↓
候補10枚
↓
ターゲット2
↓
候補10枚
↓
ターゲット3
↓
...

のようにする可能性がある。

---

## 2. 次のターゲットの決め方

まだ未決定。

候補：

- 完全ランダム
- 同じ対象の別写真を使う
- 対象ごとに順番に進める
- その他の組み合わせ

実験目的に合わせて今後決定する。

---

## 3. 複数画角の扱い

現在のファイルには、

b / l / r / t

という画角を示すと思われる末尾がある。

例：

A1_b
A1_l
A1_r
A1_t

今後、

「同じ対象の複数画角を1セットとして扱う」

可能性がある。

この場合は、

対象
↓
画角
↓
候補

という構造に変更する可能性がある。

---

## 4. 参加者ID

現在は誰が回答したかを識別するIDはない。

今後、複数人に実験してもらう場合は、

participant_id

などを追加する可能性がある。

ただし、まだ実装しない。

---

## 5. 今後の基本方針

現在動いている部分を基準状態として保存する。

変更するときは、一度に大きく変更せず、

「何を変更するか」

を決めてから少しずつ変更する。

問題が起きた場合はGitの

17de14d
Initial working state

を基準に戻す。

---

# 次回の再開ポイント

まず、

「現在はGitにInitial working stateとして保存済み」

というところから再開する。

次に検討するのは、

「候補10枚が終了した後、次のターゲットをどう決めるか」

。

その後、

「同じ対象の複数画角をどう組み合わせるか」

を検討する。

現時点では、この2点の仕様は未決定。