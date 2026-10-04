"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type Photo = {
  name: string;
  url: string;
  id: string;
  date: string;
  side: "b" | "t" | "r" | "l";
};

type Pair = {
  key: string;
  id: string;
  date: string;
  t: Photo | null;
  r: Photo | null;
};

type SingleQuestion = {
  target: Photo;
  candidates: Photo[];
};

type PairQuestion = {
  target: Pair;
  candidates: Pair[];
};

const BUCKET = "photos";

const FOLDERS = {
  b: "f_2026_tn_b",
  t: "f_2026_tn_t",
  r: "f_2026_tn_r",
  l: "f_2026_tn_l",
};

function shuffle<T>(array: T[]): T[] {
  const result = [...array];

  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));

    [result[i], result[j]] = [result[j], result[i]];
  }

  return result;
}

/**
 * ファイル名からIDを取得
 *
 * f_20260617_tn_A1_t.jpg
 * → A1
 */
function getMatchId(filename: string): string {
  const parts = filename.split("_");
  return parts[3];
}

/**
 * ファイル名から日付を取得
 *
 * f_20260617_tn_A1_t.jpg
 * → 20260617
 */
function getDate(filename: string): string {
  const parts = filename.split("_");
  return parts[1];
}

/**
 * ファイル名から面を取得
 *
 * f_20260617_tn_A1_t.jpg
 * → t
 */
function getSide(filename: string): "b" | "t" | "r" | "l" {
  const parts = filename.split("_");
  return parts[4].split(".")[0].toLowerCase() as "b" | "t" | "r" | "l";
}

async function loadFolder(
  folder: string,
  side: "b" | "t" | "r" | "l"
): Promise<Photo[]> {
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .list(folder, {
      limit: 1000,
      sortBy: {
        column: "name",
        order: "asc",
      },
    });

  if (error) {
    throw new Error(`${folder} の読み込みに失敗しました: ${error.message}`);
  }

  const photos: Photo[] = [];

  for (const file of data ?? []) {
    if (!file.name.toLowerCase().endsWith(".jpg")) {
      continue;
    }

    const path = `${folder}/${file.name}`;

    const { data: publicUrlData } = supabase.storage
      .from(BUCKET)
      .getPublicUrl(path);

    photos.push({
      name: file.name,
      url: publicUrlData.publicUrl,
      id: getMatchId(file.name),
      date: getDate(file.name),
      side,
    });
  }

  return photos;
}

/**
 * t/rを
 *
 * 「同じ日付 + 同じID」
 *
 * でペアにする。
 *
 * 片側しかない場合もPairとして残す。
 */
function makePairs(tPhotos: Photo[], rPhotos: Photo[]): Pair[] {
  const map = new Map<string, Pair>();

  for (const photo of tPhotos) {
    const key = `${photo.date}_${photo.id}`;

    if (!map.has(key)) {
      map.set(key, {
        key,
        id: photo.id,
        date: photo.date,
        t: null,
        r: null,
      });
    }

    map.get(key)!.t = photo;
  }

  for (const photo of rPhotos) {
    const key = `${photo.date}_${photo.id}`;

    if (!map.has(key)) {
      map.set(key, {
        key,
        id: photo.id,
        date: photo.date,
        t: null,
        r: null,
      });
    }

    map.get(key)!.r = photo;
  }

  return Array.from(map.values());
}

/**
 * Q1〜Q4用
 *
 * ターゲットと同じIDの候補を最低1枚含め、
 * 残りをランダムに選ぶ。
 */
function createSingleQuestion(
  photos: Photo[],
  target: Photo
): SingleQuestion | null {
  const otherPhotos = photos.filter(
    (photo) => photo.name !== target.name
  );

  const matching = otherPhotos.filter(
    (photo) => photo.id === target.id
  );

  if (matching.length === 0) {
    return null;
  }

  const nonMatching = otherPhotos.filter(
    (photo) => photo.id !== target.id
  );

  const requiredMatch = shuffle(matching)[0];

  const remaining = shuffle([
    ...nonMatching,
    ...matching.filter(
      (photo) => photo.name !== requiredMatch.name
    ),
  ]);

  const candidates = [
    requiredMatch,
    ...remaining.slice(0, 9),
  ];

  if (candidates.length < 10) {
    return null;
  }

  return {
    target,
    candidates: shuffle(candidates),
  };
}

/**
 * Q5用
 *
 * ターゲットと
 * 「同じIDだが別の日付」
 * のペアを最低1つ入れる。
 *
 * ターゲットと同じkey
 * （同じ日付 + 同じID）
 * は候補に入れない。
 */
function createPairQuestion(
  pairs: Pair[],
  candidateCount: number
): PairQuestion | null {
  const availablePairs = pairs.filter(
    (pair) => pair.t !== null || pair.r !== null
  );

  if (availablePairs.length < candidateCount + 1) {
    return null;
  }

  // 一致あり／一致なしを50%の確率で決定
  const wantMatch = Math.random() < 0.5;

  // ターゲット候補をシャッフル
  const shuffledTargets = shuffle(availablePairs);

  for (const target of shuffledTargets) {
    // ターゲット自身と同じペアは候補から除外
    const otherPairs = availablePairs.filter(
      (pair) => pair.key !== target.key
    );

    const matchingPairs = otherPairs.filter(
      (pair) => pair.id === target.id
    );

    const nonMatchingPairs = otherPairs.filter(
      (pair) => pair.id !== target.id
    );

    // -----------------------------
    // 一致なし問題
    // -----------------------------
    if (!wantMatch) {
      if (nonMatchingPairs.length < candidateCount) {
        continue;
      }

      return {
        target,
        candidates: shuffle(nonMatchingPairs).slice(
          0,
          candidateCount
        ),
      };
    }

    // -----------------------------
    // 一致あり問題
    // -----------------------------
    if (matchingPairs.length === 0) {
      continue;
    }

    // 一致する候補を1～最大数までランダムに決定
    // ただし候補総数は candidateCount を超えない
    const minMatchCount = Math.max(
      1,
      candidateCount - nonMatchingPairs.length
    );

    const maxMatchCount = Math.min(
      matchingPairs.length,
      candidateCount
    );

    if (minMatchCount > maxMatchCount) {
      continue;
    }

    const matchCount =
      Math.floor(
        Math.random() *
          (maxMatchCount - minMatchCount + 1)
      ) + minMatchCount;

    const selectedMatching = shuffle(
      matchingPairs
    ).slice(0, matchCount);

    const selectedNonMatching = shuffle(
      nonMatchingPairs
    ).slice(0, candidateCount - matchCount);

    return {
      target,
      candidates: shuffle([
        ...selectedMatching,
        ...selectedNonMatching,
      ]),
    };
  }

  return null;
}
function getPairImage(
  photo: Photo | null
): string | null {
  return photo?.url ?? null;
}

export default function Home() {
  const [bPhotos, setBPhotos] = useState<Photo[]>([]);
  const [tPhotos, setTPhotos] = useState<Photo[]>([]);
  const [rPhotos, setRPhotos] = useState<Photo[]>([]);
  const [lPhotos, setLPhotos] = useState<Photo[]>([]);

  const [pairs, setPairs] = useState<Pair[]>([]);

  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  const [questionNumber, setQuestionNumber] = useState(1);
  const [started, setStarted] = useState(false);
  const [singleQuestion, setSingleQuestion] =
    useState<SingleQuestion | null>(null);

  const [pairQuestion, setPairQuestion] =
    useState<PairQuestion | null>(null);

  const [currentIndex, setCurrentIndex] = useState(0);

  const [finished, setFinished] = useState(false);

  const [saving, setSaving] = useState(false);
  const [correctCount, setCorrectCount] = useState(0);

  /**
   * 写真データを読み込む
   */
  useEffect(() => {
    async function loadPhotos() {
      try {
        setLoading(true);
        setErrorMessage("");

        const [
          loadedB,
          loadedT,
          loadedR,
          loadedL,
        ] = await Promise.all([
          loadFolder(FOLDERS.b, "b"),
          loadFolder(FOLDERS.t, "t"),
          loadFolder(FOLDERS.r, "r"),
          loadFolder(FOLDERS.l, "l"),
        ]);

        const loadedPairs = makePairs(
          loadedT,
          loadedR
        );

        setBPhotos(loadedB);
        setTPhotos(loadedT);
        setRPhotos(loadedR);
        setLPhotos(loadedL);
        setPairs(loadedPairs);

        console.log("b photos:", loadedB);
        console.log("t photos:", loadedT);
        console.log("r photos:", loadedR);
        console.log("l photos:", loadedL);
        console.log("pairs:", loadedPairs);

        if (loadedB.length < 11) {
          throw new Error(
            "f_2026_tn_b に11枚以上の写真が必要です。"
          );
        }

        if (loadedT.length < 11) {
          throw new Error(
            "f_2026_tn_t に11枚以上の写真が必要です。"
          );
        }

        if (loadedR.length < 11) {
          throw new Error(
            "f_2026_tn_r に11枚以上の写真が必要です。"
          );
        }

        if (loadedL.length < 11) {
          throw new Error(
            "f_2026_tn_l に11枚以上の写真が必要です。"
          );
        }

        if (loadedPairs.length < 61) {
         throw new Error(
          "Q10を実施するには、t/rを組み合わせたペアが61組以上必要です。"
         );
        }
       
      } catch (error) {
        console.error(error);

        if (error instanceof Error) {
          setErrorMessage(error.message);
        } else {
          setErrorMessage(
            "写真データの読み込みに失敗しました。"
          );
        }
      } finally {
        setLoading(false);
      }
    }
    

    loadPhotos();
  }, []);

  /**
   * 問題を作成
   */
  function createQuestion(
    q: number,
    b: Photo[] = bPhotos,
    t: Photo[] = tPhotos,
    r: Photo[] = rPhotos,
    l: Photo[] = lPhotos,
    pairData: Pair[] = pairs
  ) {
    setQuestionNumber(q);
    setCurrentIndex(0);
    setSingleQuestion(null);
    setPairQuestion(null);

    if (q === 1) {
      createSingleForQuestion(b);
      return;
    }

    if (q === 2) {
      createSingleForQuestion(t);
      return;
    }

    if (q === 3) {
      createSingleForQuestion(r);
      return;
    }

    if (q === 4) {
      createSingleForQuestion(l);
      return;
    }

   if (q >= 5 && q <= 10) {
      const candidateCount = (q - 4) * 10;

      const question = createPairQuestion(
        pairData,
        candidateCount
      );

      if (!question) {
        setErrorMessage(
          `Q${q}を作成できませんでした。${candidateCount}組の候補を作成できる十分なペアデータが必要です。`
        );
        return;
      }

      setPairQuestion(question);
      return;
    }
  }

  function createSingleForQuestion(
    photos: Photo[]
  ) {
    const shuffledPhotos = shuffle(photos);

    for (const target of shuffledPhotos) {
      const question = createSingleQuestion(
        photos,
        target
      );

      if (question) {
        setSingleQuestion(question);
        return;
      }
    }

    setErrorMessage(
      `Q${questionNumber}を作成できませんでした。同じIDの別写真が必要です。`
    );
  }

  /**
   * Q1〜Q4の回答保存
   */
  async function saveSingleAnswer(
    candidate: Photo,
    answer: "一致" | "不一致"
  ) {
    if (!singleQuestion || saving) {
      return;
    }

    setSaving(true);

    const correctAnswer =
      candidate.id === singleQuestion.target.id
        ? "一致"
        : "不一致";

    const isCorrect =
      answer === correctAnswer;
    if (isCorrect) {
      setCorrectCount((prev) => prev + 1);
    }

    const tableName =
      `comparison_results_q${questionNumber}`;

    const { error } = await supabase
      .from(tableName)
      .insert({
        target: singleQuestion.target.name,
        candidate: candidate.name,
        answer,
        is_correct: isCorrect,
      });

    if (error) {
      console.error(error);

      alert(
        `回答の保存に失敗しました。\n${error.message}`
      );

      setSaving(false);
      return;
    }

    console.log("回答保存成功:", {
      questionNumber,
      target: singleQuestion.target.name,
      candidate: candidate.name,
      targetId: singleQuestion.target.id,
      candidateId: candidate.id,
      answer,
      correctAnswer,
      isCorrect,
    });

    goToNext();
  }

  /**
   * Q5〜Q10の回答保存
   */
  async function savePairAnswer(
    candidate: Pair,
    answer: "一致" | "不一致"
  ) {
    if (!pairQuestion || saving) {
      return;
    }

    setSaving(true);

    const correctAnswer =
      candidate.id === pairQuestion.target.id
        ? "一致"
        : "不一致";

    const isCorrect =
      answer === correctAnswer;
    if (isCorrect) {
      setCorrectCount((prev) => prev + 1);
    }

    let tableName = "";

    if (questionNumber === 5) {
      tableName = "comparison_results_q5";
    } else if (questionNumber === 6) {
      tableName = "comparison_results_q6";
    } else {
      tableName = "comparison_results_q7_10";
    }

    const data: Record<string, unknown> = {
      target_1: getPairImage(
        pairQuestion.target.t
      )
        ? pairQuestion.target.t!.name
        : null,

      target_2: getPairImage(
        pairQuestion.target.r
      )
        ? pairQuestion.target.r!.name
        : null,

      candidate_1: getPairImage(candidate.t)
        ? candidate.t!.name
        : null,

      candidate_2: getPairImage(candidate.r)
        ? candidate.r!.name
        : null,

      answer,
      is_correct: isCorrect,
    };

    if (questionNumber >= 7) {
      data.question_number = questionNumber;
    }

    const { error } = await supabase
      .from(tableName)
      .insert(data);

    if (error) {
      console.error(error);

      alert(
        `回答の保存に失敗しました。\n${error.message}`
      );

      setSaving(false);
      return;
    }

    console.log("回答保存成功:", {
      questionNumber,
      target: pairQuestion.target,
      candidate,
      answer,
      correctAnswer,
      isCorrect,
    });

    goToNext();
  }

  /**
   * 次の候補・次の問題へ
   */
  function goToNext() {
  const totalQuestions =
    questionNumber <= 4
      ? 10
      : (questionNumber - 4) * 10;

  if (currentIndex < totalQuestions - 1) {
    setCurrentIndex((prev) => prev + 1);
    setSaving(false);
    return;
  }

  setStarted(false);
  setFinished(true);
  setSaving(false);
}

  /**
   * ローディング
   */
  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <p className="text-xl">
          写真を読み込んでいます...
        </p>
      </main>
    );
  }

  /**
   * エラー
   */
  if (errorMessage) {
    return (
      <main className="min-h-screen flex items-center justify-center p-6">
        <div className="max-w-xl text-center">
          <h1 className="text-2xl font-bold mb-4">
            エラー
          </h1>

          <p className="whitespace-pre-wrap">
            {errorMessage}
          </p>
        </div>
      </main>
    );
  }

/**
 * 照合成功率
 */
if (finished) {
  const totalQuestions =
    questionNumber <= 4
      ? 10
      : (questionNumber - 4) * 10;

  const successRate =
    (correctCount / totalQuestions) * 100;

  return (
    <main className="min-h-screen bg-gray-100 flex items-center justify-center p-6">
      <div className="text-center">
        <h1 className="text-3xl font-bold mb-6">
          照合成功率
        </h1>

        <p className="text-6xl font-bold mb-8">
          {successRate}%
        </p>

        <button
          onClick={() => {
            setFinished(false);
          }}
          className="bg-white rounded-xl shadow px-8 py-4 text-xl font-bold hover:bg-gray-100"
        >
          トップへ戻る
        </button>
      </div>
    </main>
  );
}

/**
 * 問題選択
 */
if (!started) {
  return (
    <main className="min-h-screen bg-gray-100 flex items-center justify-center p-6">
      <div className="w-full max-w-2xl">
        <h1 className="text-3xl font-bold text-center mb-8">
          問題を選択してください
        </h1>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {Array.from({ length: 10 }, (_, index) => {
            const q = index + 1;

            return (
              <button
                key={q}
                onClick={() => {
                  setStarted(true);
                  setFinished(false);
                  setCorrectCount(0);
                  createQuestion(q);
                }}
                className="bg-white rounded-xl shadow p-6 text-2xl font-bold hover:bg-gray-100"
              >
                Q{q}
              </button>
            );
          })}
        </div>
      </div>
    </main>
  );
}
  /**
   * Q1〜Q4
   */
  if (
    questionNumber <= 4 &&
    singleQuestion
  ) {
    const candidate =
      singleQuestion.candidates[currentIndex];

    return (
      <main className="min-h-screen bg-gray-100 p-4 md:p-8">
        <div className="max-w-5xl mx-auto">

          <div className="mb-6 text-center">
            <h1 className="text-2xl font-bold">
              Q{questionNumber}
            </h1>

            <p className="mt-2">
              {currentIndex + 1} / 10
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

            {/* ターゲット */}
            <section className="bg-white rounded-xl p-4 shadow">
              <h2 className="text-xl font-bold text-center mb-4">
                ターゲット
              </h2>

              <img
                src={singleQuestion.target.url}
                alt="ターゲット"
                className="w-full max-h-[60vh] object-contain"
              />
            </section>

            {/* 候補 */}
            <section className="bg-white rounded-xl p-4 shadow">
              <h2 className="text-xl font-bold text-center mb-4">
                候補
              </h2>

              <img
                src={candidate.url}
                alt="候補"
                className="w-full max-h-[60vh] object-contain"
              />
            </section>

          </div>

          <div className="mt-8 flex justify-center gap-4">
            <button
              onClick={() =>
                saveSingleAnswer(
                  candidate,
                  "一致"
                )
              }
              disabled={saving}
              className="px-10 py-4 bg-green-600 text-white rounded-xl text-xl font-bold disabled:opacity-50"
            >
              一致
            </button>

            <button
              onClick={() =>
                saveSingleAnswer(
                  candidate,
                  "不一致"
                )
              }
              disabled={saving}
              className="px-10 py-4 bg-red-600 text-white rounded-xl text-xl font-bold disabled:opacity-50"
            >
              不一致
            </button>
          </div>

        </div>
      </main>
    );
  }

  /**
   * Q5〜Q10
   */
  if (
    questionNumber >= 5 &&
    pairQuestion
  ) {
    const candidate =
      pairQuestion.candidates[currentIndex];

    return (
      <main className="min-h-screen bg-gray-100 p-4 md:p-8">
        <div className="max-w-7xl mx-auto">

          <div className="mb-6 text-center">
            <h1 className="text-2xl font-bold">
              Q{questionNumber}
            </h1>

            <p className="mt-2">
              Q番号={questionNumber}
              {currentIndex + 1} / {(questionNumber - 4) * 10}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

            {/* ターゲット */}
            <section className="bg-white rounded-xl p-4 shadow">
              <h2 className="text-xl font-bold text-center mb-4">
                ターゲット
              </h2>

              <div className="grid grid-cols-2 gap-4">

                <div className="border rounded-lg p-2">
                  {pairQuestion.target.t ? (
                    <img
                      src={pairQuestion.target.t.url}
                      alt="ターゲット t"
                      className="w-full h-64 object-contain"
                    />
                  ) : (
                    <div className="w-full h-64 flex items-center justify-center bg-gray-200 text-gray-600 font-bold">
                      データなし
                    </div>
                  )}
                </div>

                <div className="border rounded-lg p-2">
                  {pairQuestion.target.r ? (
                    <img
                      src={pairQuestion.target.r.url}
                      alt="ターゲット r"
                      className="w-full h-64 object-contain"
                    />
                  ) : (
                    <div className="w-full h-64 flex items-center justify-center bg-gray-200 text-gray-600 font-bold">
                      データなし
                    </div>
                  )}
                </div>

              </div>

            </section>

            {/* 候補 */}
            <section className="bg-white rounded-xl p-4 shadow">
              <h2 className="text-xl font-bold text-center mb-4">
                候補
              </h2>

              <div className="grid grid-cols-2 gap-4">

                <div className="border rounded-lg p-2">
                  {candidate.t ? (
                    <img
                      src={candidate.t.url}
                      alt="候補 t"
                      className="w-full h-64 object-contain"
                    />
                  ) : (
                    <div className="w-full h-64 flex items-center justify-center bg-gray-200 text-gray-600 font-bold">
                      データなし
                    </div>
                  )}
                </div>

                <div className="border rounded-lg p-2">
                  {candidate.r ? (
                    <img
                      src={candidate.r.url}
                      alt="候補 r"
                      className="w-full h-64 object-contain"
                    />
                  ) : (
                    <div className="w-full h-64 flex items-center justify-center bg-gray-200 text-gray-600 font-bold">
                      データなし
                    </div>
                  )}
                </div>

              </div>

            </section>

          </div>

          <div className="mt-8 flex justify-center gap-4">
            <button
              onClick={() =>
                savePairAnswer(
                  candidate,
                  "一致"
                )
              }
              disabled={saving}
              className="px-10 py-4 bg-green-600 text-white rounded-xl text-xl font-bold disabled:opacity-50"
            >
              一致
            </button>

            <button
              onClick={() =>
                savePairAnswer(
                  candidate,
                  "不一致"
                )
              }
              disabled={saving}
              className="px-10 py-4 bg-red-600 text-white rounded-xl text-xl font-bold disabled:opacity-50"
            >
              不一致
            </button>
          </div>

        </div>
      </main>
    );
  }

  return null;
}