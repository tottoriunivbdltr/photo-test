"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type Photo = {
  name: string;
  url: string;
};

function getMatchId(filename: string) {
  const parts = filename.split("_");
  return parts[3];
}

export default function Home() {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [loading, setLoading] = useState(true);

  const [target, setTarget] = useState<Photo | null>(null);
const [candidates, setCandidates] = useState<Photo[]>([]);
const [currentIndex, setCurrentIndex] = useState(0);

const [startTime, setStartTime] = useState<number | null>(null);
useEffect(() => {
  if (target && candidates.length > 0) {
    setStartTime(performance.now());
  }
}, [currentIndex, target, candidates]);
  useEffect(() => {
    async function loadPhotos() {
      const { data, error } = await supabase.storage
        .from("photos")
        .list("20260922(250)", {
          limit: 1000,
          sortBy: {
            column: "name",
            order: "asc",
          },
        });

      console.log("Supabase data:", data);
      console.log("Supabase error:", error);

      if (error) {
        console.error(error);
        setLoading(false);
        return;
      }

      const photoList =
        data
          ?.filter((file) => file.name.toLowerCase().endsWith(".jpg"))
          .map((file) => ({
            name: file.name,
            url: supabase.storage
              .from("photos")
              .getPublicUrl(`20260922(250)/${file.name}`).data.publicUrl,
          })) ?? [];

      setPhotos(photoList);
      setLoading(false);

      // ターゲットをランダムに1枚選ぶ
if (photoList.length >= 11) {
  const shuffled = [...photoList].sort(() => Math.random() - 0.5);

  const randomTarget = shuffled[0];
  const randomCandidates = shuffled.slice(1, 11);

  setTarget(randomTarget);
  setCandidates(randomCandidates);
}
    }

    loadPhotos();
  }, []);

 async function handleAnswer(answer: "match" | "no-match") {
  const currentCandidate = candidates[currentIndex];

  if (!target || !currentCandidate || startTime === null) {
    return;
  }

  const targetId = getMatchId(target.name);
  const candidateId = getMatchId(currentCandidate.name);

  const correctAnswer =
    targetId === candidateId ? "match" : "no-match";

  const isCorrect = answer === correctAnswer;

  const responseTimeMs = Math.round(
    performance.now() - startTime
  );

  console.log("回答:", {
    target: target.name,
    candidate: currentCandidate.name,
    targetId,
    candidateId,
    answer,
    correctAnswer,
    isCorrect,
    responseTimeMs,
    responseTimeSeconds: responseTimeMs / 1000,
  });

  // Supabaseに回答結果を保存
  const { error } = await supabase
    .from("comparison_results")
    .insert({
      target: target.name,
      candidate: currentCandidate.name,
      answer: answer,
      is_correct: isCorrect,
      response_time_ms: responseTimeMs,
    });

  if (error) {
    console.error("Supabaseへの保存に失敗しました:", error);
    alert("回答の保存に失敗しました。");
    return;
  }

  console.log("Supabaseへの保存に成功しました。");

  if (currentIndex < candidates.length - 1) {
    setCurrentIndex(currentIndex + 1);
  } else {
    alert("すべての比較が終了しました。");
  }
}

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <p>写真を読み込んでいます...</p>
      </main>
    );
  }

  if (!target || candidates.length === 0) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <p>写真が足りません。</p>
      </main>
    );
  }

  const currentCandidate = candidates[currentIndex];

  return (
    <main className="min-h-screen bg-gray-100 p-6">
      <div className="mx-auto max-w-5xl">
        <h1 className="mb-8 text-center text-2xl font-bold">
          写真比較
        </h1>

        <div className="mb-8 text-center">
          <p className="text-lg font-semibold">
            {currentIndex + 1} / {candidates.length}
          </p>
          <p className="mt-1 text-sm text-gray-600">
            2枚の写真を見比べてください
          </p>
        </div>

        <div className="grid gap-8 md:grid-cols-2">
          {/* ターゲット写真 */}
          <section className="rounded-xl bg-white p-4 shadow">
            <h2 className="mb-3 text-center text-lg font-bold">
              ターゲット
            </h2>

            <div className="flex aspect-square items-center justify-center overflow-hidden rounded-lg bg-gray-100">
              <img
                src={target.url}
                alt="ターゲット写真"
                className="max-h-full max-w-full object-contain"
              />
            </div>
          </section>

          {/* 候補写真 */}
          <section className="rounded-xl bg-white p-4 shadow">
            <h2 className="mb-3 text-center text-lg font-bold">
              候補写真
            </h2>

            <div className="flex aspect-square items-center justify-center overflow-hidden rounded-lg bg-gray-100">
              <img
                src={currentCandidate.url}
                alt="候補写真"
                className="max-h-full max-w-full object-contain"
              />
            </div>
          </section>
        </div>

        {/* 回答ボタン */}
        <div className="mx-auto mt-8 flex max-w-xl gap-4">
          <button
            onClick={() => handleAnswer("match")}
            className="flex-1 rounded-xl bg-green-600 px-6 py-4 text-lg font-bold text-white hover:bg-green-700"
          >
            一致
          </button>

          <button
            onClick={() => handleAnswer("no-match")}
            className="flex-1 rounded-xl bg-red-600 px-6 py-4 text-lg font-bold text-white hover:bg-red-700"
          >
            不一致
          </button>
        </div>
      </div>
    </main>
  );
}