const fileInput = document.getElementById("csvInput");

fileInput.addEventListener("change", handleFile);

// LOAD DATA SAAT HALAMAN DIREFRESH
window.addEventListener("load", loadSavedData);

let analysisChart;
let rawChart;

/* =====================================================
   FILE HANDLER
   ===================================================== */
function handleFile(e) {

  const file = e.target.files[0];

  if (!file) return;

  // SIMPAN NAMA FILE
  localStorage.setItem(
    "lastFileName",
    file.name
  );

  showSavedFileName();

  const ext =
    file.name.split(".").pop().toLowerCase();

  const reader = new FileReader();

  // ================= CSV =================
  if (ext === "csv") {

    reader.onload = () =>
      parseCSV(reader.result);

    reader.readAsText(file);
  }

  // ================= XLSX =================
  else if (ext === "xlsx") {

    reader.onload = () =>
      parseXLSX(reader.result);

    reader.readAsArrayBuffer(file);
  }

  // ================= FORMAT TIDAK DIDUKUNG =================
  else {

    alert("Format file tidak didukung");

  }
}

/* =====================================================
   TAMPILKAN NAMA FILE TERAKHIR
   ===================================================== */
function showSavedFileName() {

  const savedName =
    localStorage.getItem("lastFileName");

  const el =
    document.getElementById("savedFileName");

  if (!el) return;

  if (savedName) {

    el.innerText =
      `File terakhir: ${savedName}`;

  }
}

/* =====================================================
   SIMPAN DATA
   ===================================================== */
function saveData(data) {

  localStorage.setItem(
    "osilasiData",
    JSON.stringify(data)
  );
}

/* =====================================================
   LOAD DATA SAAT REFRESH
   ===================================================== */
function loadSavedData() {

  // TAMPILKAN NAMA FILE
  showSavedFileName();

  const saved =
    localStorage.getItem("osilasiData");

  if (!saved) return;

  const data = JSON.parse(saved);

  prosesData(data);
}

/* =====================================================
   PARSE CSV
   ===================================================== */
function parseCSV(text) {

  const lines =
    text.trim().split("\n");

  const data = [];

  for (let i = 1; i < lines.length; i++) {

    const row =
      lines[i].split(",");

    if (row.length < 2) continue;

    const t = Number(row[0]);

    const x = Number(row[1]);

    if (
      !isNaN(t) &&
      !isNaN(x)
    ) {

      data.push({ t, x });

    }
  }

  prosesData(data);
}

/* =====================================================
   PARSE XLSX
   ===================================================== */
function parseXLSX(buffer) {

  const wb =
    XLSX.read(buffer, {
      type: "array"
    });

  const sheet =
    wb.Sheets[wb.SheetNames[0]];

  const rows =
    XLSX.utils.sheet_to_json(
      sheet,
      { header: 1 }
    );

  const data = [];

  for (let i = 1; i < rows.length; i++) {

    const row = rows[i];

    if (
      !row ||
      row.length < 2
    ) continue;

    const t = Number(row[0]);

    const x = Number(row[1]);

    if (
      !isNaN(t) &&
      !isNaN(x)
    ) {

      data.push({ t, x });

    }
  }

  prosesData(data);
}

/* =====================================================
   PROSES DATA
   ===================================================== */
function prosesData(data) {

  if (
    !Array.isArray(data) ||
    data.length < 5
  ) {

    alert(
      "Data tidak valid atau terlalu sedikit"
    );

    return;
  }

  // ================= SIMPAN DATA =================
  saveData(data);

  // ================= GRAFIK DATA MENTAH =================
  drawRawChart(data);

  // ================= NORMALISASI =================
  const x0 =
    data.reduce(
      (s, d) => s + d.x,
      0
    ) / data.length;

  const normalized =
    data.map(d => ({

      t: d.t,

      x: d.x - x0
    }));

  // ================= FITTING SINUS =================
  const hasil =
    fitSinusLeastSquares(normalized);

  // ================= GRAFIK FITTING =================
  drawSinusChart(hasil.sinus);

  // ================= HASIL ANALISIS =================
  const avgEl =
    document.getElementById("periodAvg");

  if (avgEl) {

    avgEl.innerText =
      hasil.T.toFixed(3);

  }

  const ampEl =
    document.getElementById("ampVal");

  if (ampEl) {

    ampEl.innerText =
      Math.abs(hasil.A).toFixed(3);

  }

  // ================= CONSOLE =================
  console.log(
    "===== HASIL FITTING ====="
  );

  console.log(
    "x0 =",
    x0.toFixed(4),
    "cm"
  );

  console.log(
    "A =",
    hasil.A.toFixed(4),
    "cm"
  );

  console.log(
    "T_fit =",
    hasil.T.toFixed(4),
    "s"
  );

  console.log(
    "ω =",
    hasil.omega.toFixed(4),
    "rad/s"
  );

  console.log(
    "φ =",
    hasil.phi.toFixed(4),
    "rad"
  );

  console.log(
    "RMS error =",
    hasil.rms.toFixed(4),
    "cm"
  );
}

/* =====================================================
   FITTING SINUS
   ===================================================== */
function fitSinusLeastSquares(data) {

  const t =
    data.map(d => d.t);

  const x =
    data.map(d => d.x);

  // ================= ESTIMASI AWAL AMPLITUDO =================
  const A0 =
    (
      Math.max(...x) -
      Math.min(...x)
    ) / 2;

  // ================= CARI PEAK =================
  const peaks = [];

  for (
    let i = 1;
    i < x.length - 1;
    i++
  ) {

    if (
      x[i] > x[i - 1] &&
      x[i] > x[i + 1]
    ) {

      peaks.push(t[i]);

    }
  }

  // ================= ESTIMASI AWAL PERIODE =================
  let T0 =
    (
      t[t.length - 1] -
      t[0]
    ) / 3;

  if (peaks.length >= 2) {

    let s = 0;

    for (
      let i = 1;
      i < peaks.length;
      i++
    ) {

      s +=
        peaks[i] -
        peaks[i - 1];

    }

    T0 =
      s /
      (peaks.length - 1);
  }

  // ================= PARAMETER TERBAIK =================
  let best = {

    err: Infinity,

    A: A0,

    omega:
      2 * Math.PI / T0,

    phi: 0
  };

  // ================= GRID SEARCH =================
  for (
    let dA = 0.7;
    dA <= 1.3;
    dA += 0.05
  ) {

    for (
      let dW = 0.7;
      dW <= 1.3;
      dW += 0.05
    ) {

      for (
        let phi = -Math.PI;
        phi <= Math.PI;
        phi += Math.PI / 16
      ) {

        const A =
          A0 * dA;

        const omega =
          (
            2 * Math.PI / T0
          ) * dW;

        let err = 0;

        for (
          let i = 0;
          i < t.length;
          i++
        ) {

          const model =
            A *
            Math.sin(
              omega * t[i] +
              phi
            );

          err += Math.pow(
            x[i] - model,
            2
          );
        }

        if (err < best.err) {

          best = {

            err,

            A,

            omega,

            phi
          };
        }
      }
    }
  }

  // ================= DATA FITTING =================
  const sinus =
    t.map(time => ({

      x: time,

      y:
        best.A *
        Math.sin(
          best.omega * time +
          best.phi
        )
    }));

  const rms =
    Math.sqrt(
      best.err / t.length
    );

  const T =
    2 * Math.PI /
    best.omega;

  return {

    A: best.A,

    omega: best.omega,

    T,

    phi: best.phi,

    rms,

    sinus
  };
}

/* =====================================================
   GRAFIK DATA MENTAH
   ===================================================== */
function drawRawChart(rawData) {

  const ctx =
    document
      .getElementById("rawChart")
      .getContext("2d");

  if (rawChart) {

    rawChart.destroy();

  }

  rawChart =
    new Chart(ctx, {

      type: "line",

      data: {

        datasets: [{

          label:
            "Data Mentah x(t)",

          data:
            rawData.map(d => ({

              x: d.t,

              y: d.x
            })),

          borderColor:
            "rgb(38,105,220)",

          borderWidth: 1.5,

          tension: 0.25,

          fill: false,

          pointRadius: 0,

          showLine: true
        }]
      },

      options: {

        responsive: true,

        maintainAspectRatio: false,

        parsing: false,

        interaction: {

          mode: "nearest",

          intersect: false
        },

        scales: {

          x: {

            type: "linear",

            title: {

              display: true,

              text: "Waktu (s)"
            }
          },

          y: {

            title: {

              display: true,

              text: "Simpangan (cm)"
            }
          }
        },

        plugins: {

          tooltip: {

            callbacks: {

              title: i =>
                `x = ${i[0].parsed.x.toFixed(3)} s`,

              label: c =>
                `y = ${c.parsed.y.toFixed(3)} cm`
            }
          }
        }
      }
    });
}

/* =====================================================
   GRAFIK FITTING SINUS
   ===================================================== */
function drawSinusChart(sinusData) {

  const ctx =
    document
      .getElementById("analysisChart")
      .getContext("2d");

  if (analysisChart) {

    analysisChart.destroy();

  }

  analysisChart =
    new Chart(ctx, {

      type: "line",

      data: {

        datasets: [{

          label:
            "Hasil Fitting Sinus x(t)",

          data: sinusData,

          borderColor:
            "rgb(38,105,220)",

          borderWidth: 2,

          tension: 0.45,

          fill: false,

          pointRadius: 0
        }]
      },

      options: {

        responsive: true,

        maintainAspectRatio: false,

        parsing: false,

        interaction: {

          mode: "nearest",

          intersect: false
        },

        scales: {

          x: {

            type: "linear",

            title: {

              display: true,

              text: "Waktu (s)"
            }
          },

          y: {

            title: {

              display: true,

              text: "Simpangan (cm)"
            }
          }
        },

        plugins: {

          tooltip: {

            callbacks: {

              title: i =>
                `x = ${i[0].parsed.x.toFixed(3)} s`,

              label: c =>
                `y = ${c.parsed.y.toFixed(3)} cm`
            }
          }
        }
      }
    });
}