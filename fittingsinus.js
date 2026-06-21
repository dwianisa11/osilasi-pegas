/**
 * Fitting sinus sederhana
 * x(t) = A sin(ωt + φ)
 * Input: [{ t (s), x }, ...]
 */
function fitSinus(data) {
  if (data.length < 5) {
    return { error: "Data tidak cukup" };
  }

  const t = data.map(d => d.t);
  const x = data.map(d => d.x);

  // estimasi amplitudo
  const A = (Math.max(...x) - Math.min(...x)) / 2;

  // zero crossing naik
  const zero = [];
  for (let i = 1; i < x.length; i++) {
    if (x[i - 1] <= 0 && x[i] > 0) {
      zero.push(t[i]);
    }
  }

  if (zero.length < 2) {
    return { error: "Zero crossing tidak cukup" };
  }

  // periode rata-rata
  let sum = 0;
  for (let i = 1; i < zero.length; i++) {
    sum += zero[i] - zero[i - 1];
  }

  const T = sum / (zero.length - 1);
  const omega = (2 * Math.PI) / T;

  return { A, T, omega };
}
