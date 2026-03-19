// Correction logic for dichotomous tree (depth-wise, feature-wise)
// Usage: score = computeDichotomousScore(correctAnswerJson, userAnswerJson)

function arraysEqualUnordered(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b)) return false;
  if (a.length !== b.length) return false;
  const sortedA = [...a].sort();
  const sortedB = [...b].sort();
  return sortedA.every((val, idx) => val === sortedB[idx]);
}

/**
 * @param {object} correct - correct answer JSON (depth-wise)
 * @param {object} user - user answer JSON (depth-wise)
 * @returns {number} score (integer)
 */
export function computeDichotomousScore(correct, user) {
  let totalFeatures = 0;
  let correctFeatures = 0;
  for (const depth of Object.keys(correct)) {
    const correctFeaturesObj = correct[depth] || {};
    const userFeaturesObj = (user && user[depth]) || {};
    for (const feature of Object.keys(correctFeaturesObj)) {
      totalFeatures++;
      const correctAnimals = correctFeaturesObj[feature] || [];
      const userAnimals = userFeaturesObj[feature] || [];
      if (arraysEqualUnordered(correctAnimals, userAnimals)) {
        correctFeatures++;
      }
    }
  }
  if (totalFeatures === 0) return 0;
  // 5 points per correct feature, then scale to 10
  const rawScore = (correctFeatures * 5) / 8 * 10;
  return Math.round(rawScore);
}
