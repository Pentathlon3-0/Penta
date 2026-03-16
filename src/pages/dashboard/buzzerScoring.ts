// ...existing code...
// Add Buzzer round player performance calculation
// This function expects buzar_performance JSON from final_round table
export function calculateBuzzerPlayerPerformance(buzarPerformance: any): Record<string, { correct: number, wrong: number, score: number }> {
  const result: Record<string, { correct: number, wrong: number, score: number }> = {};
  if (!buzarPerformance || typeof buzarPerformance !== "object") return result;
  Object.entries(buzarPerformance).forEach(([playerId, perf]: any) => {
    const correct = Array.isArray(perf.correct) ? perf.correct.length : 0;
    const wrong = Array.isArray(perf.wrong) ? perf.wrong.length : 0;
    result[playerId] = {
      correct,
      wrong,
      score: correct * 10 - wrong * 10,
    };
  });
  return result;
}
