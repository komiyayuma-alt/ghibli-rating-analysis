// js/c_dashboard.js
(() => {
  const DATA_PATH = "./data/ghibli.csv";
  const CHART_ID = "#chart";

  // ------- helpers -------
  const pick = (obj, keys) => {
    for (const k of keys) {
      if (obj && obj[k] !== undefined && obj[k] !== null && String(obj[k]).trim() !== "") return obj[k];
    }
    return null;
  };

  const toNumber = (v) => {
    if (v === null || v === undefined) return null;
    const s = String(v).replace(/[, ]/g, "").replace(/[^\d.\-]/g, "");
    if (s === "") return null;
    const n = Number(s);
    return Number.isFinite(n) ? n : null;
  };

  const normalizeRow = (raw) => {
    const title = pick(raw, ["title","Title","name","Name","film","Film","タイトル","作品名"]);
    const year = toNumber(pick(raw, ["year","Year","release_year","ReleaseYear","公開年","年","公開 年"]));
    const director = pick(raw, ["director","Director","dir","Dir","監督","監督名"]);
    const rating = toNumber(pick(raw, [
      "imdb_rating","IMDb","imdb","rating","Rating","score","Score",
      "評価","IMDb評価","IMDB評価","スコア"
    ]));
    const runtime = toNumber(pick(raw, [
      "runtime","Runtime","running_time","RunningTime","minutes","Minutes","duration","Duration",
      "上映時間","上映時間（分）","上映時間(分)","上映 分","時間（分）","時間(分)"
    ]));
    const gross = toNumber(pick(raw, [
      "gross","Gross","box_office","BoxOffice","revenue","Revenue",
      "興行収入","興行収入（$）","興行収入($)","収入","売上"
    ]));

    return { title, year, director, rating, runtime, gross, _raw: raw };
  };

  const fmtMoney = (v) => {
    if (v == null) return "—";
    // USD 表示（大きいと読みやすく）
    if (v >= 1e9) return `$${(v/1e9).toFixed(2)}B`;
    if (v >= 1e6) return `$${(v/1e6).toFixed(1)}M`;
    return `$${Math.round(v).toLocaleString()}`;
  };

  const fmtNum = (v, d=1) => (v == null ? "—" : Number(v).toFixed(d));
  const safe = (v) => (v == null ? "—" : String(v));

  // ------- UI -------
  const $xMetric = document.getElementById("xMetric");
  const $director = document.getElementById("directorFilter");
  const $minYear = document.getElementById("minYear");
  const $maxYear = document.getElementById("maxYear");
  const $minYearLabel = document.getElementById("minYearLabel");
  const $maxYearLabel = document.getElementById("maxYearLabel");
  const $status = document.getElementById("status");
  const $tbody = document.getElementById("tbody");

  function setStatus(msg, isError=false) {
    $status.textContent = msg;
    $status.classList.toggle("error", !!isError);
  }

  function fillDirectorOptions(dirs) {
    $director.innerHTML = "";
    const optAll = document.createElement("option");
    optAll.value = "ALL";
    optAll.textContent = "すべて";
    $director.appendChild(optAll);

    dirs.forEach(d => {
      const opt = document.createElement("option");
      opt.value = d;
      opt.textContent = d;
      $director.appendChild(opt);
    });
  }

  function renderTable(rows) {
    $tbody.innerHTML = "";
    const show = rows.slice(0, 30);
    show.forEach(d => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${safe(d.title)}</td>
        <td>${safe(d.year)}</td>
        <td>${safe(d.director)}</td>
        <td>${fmtNum(d.rating, 1)}</td>
        <td>${fmtMoney(d.gross)}</td>
      `;
      $tbody.appendChild(tr);
    });
  }

  // ------- chart state -------
  let all = [];
  let filtered = [];
  let selected = [];

  function metricValue(d, key) {
    if (key === "runtime") return d.runtime;
    if (key === "gross") return d.gross;
    if (key === "year") return d.year;
    if (key === "rating") return d.rating;
    return null;
  }

  function metricLabel(key) {
    if (key === "runtime") return "上映時間（分）";
    if (key === "gross") return "興行収入（USD）";
    if (key === "year") return "公開年";
    if (key === "rating") return "評価（IMDb）";
    return key;
  }

  function applyFilters() {
    const dir = $director.value;
    let minY = Number($minYear.value);
    let maxY = Number($maxYear.value);

    if (minY > maxY) [minY, maxY] = [maxY, minY];

    $minYearLabel.textContent = String(minY);
    $maxYearLabel.textContent = String(maxY);

    const xKey = $xMetric.value;

    filtered = all
      .filter(d => d.year != null && d.rating != null)
      .filter(d => (dir === "ALL" ? true : d.director === dir))
      .filter(d => d.year >= minY && d.year <= maxY)
      .filter(d => metricValue(d, xKey) != null);

    // メッセージ
    if (!filtered.length) {
      setStatus("フィルタ後データが0件。列名/値/レンジを確認して。", true);
    } else {
      setStatus(`表示中：${filtered.length}件（Y軸=評価固定 / X軸=${metricLabel(xKey)}）`);
    }

    // 選択はリセット
    selected = [];
    renderTable(filtered);
    renderChart();
  }

  function renderChart() {
    const root = document.querySelector(CHART_ID);
    root.innerHTML = "";

    const width = root.clientWidth || 960;
    const height = 450;
    const margin = { top: 18, right: 26, bottom: 50, left: 60 };
    const w = width - margin.left - margin.right;
    const h = height - margin.top - margin.bottom;

    const svg = d3.select(root)
      .append("svg")
      .attr("viewBox", `0 0 ${width} ${height}`)
      .style("width", "100%")
      .style("height", "auto");

    const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

    const xKey = $xMetric.value;

    const xVals = filtered.map(d => metricValue(d, xKey)).filter(v => v != null);
    const yVals = filtered.map(d => d.rating).filter(v => v != null);

    if (!xVals.length || !yVals.length) {
      g.append("text")
        .attr("x", 0).attr("y", 20)
        .attr("fill", "rgba(255,107,138,.95)")
        .style("font-size", "14px")
        .text("描画できるデータがありません（XまたはYが欠損）。");
      return;
    }

    const x = d3.scaleLinear()
      .domain(d3.extent(xVals))
      .nice()
      .range([0, w]);

    const y = d3.scaleLinear()
      .domain(d3.extent(yVals))
      .nice()
      .range([h, 0]);

    const xAxis = d3.axisBottom(x).ticks(7);
    const yAxis = d3.axisLeft(y).ticks(7);

    g.append("g")
      .attr("transform", `translate(0,${h})`)
      .call(xAxis)
      .call(g => g.selectAll("text").attr("fill", "rgba(255,255,255,.78)"))
      .call(g => g.selectAll("path,line").attr("stroke", "rgba(255,255,255,.25)"));

    g.append("g")
      .call(yAxis)
      .call(g => g.selectAll("text").attr("fill", "rgba(255,255,255,.78)"))
      .call(g => g.selectAll("path,line").attr("stroke", "rgba(255,255,255,.25)"));

    g.append("text")
      .attr("x", w/2).attr("y", h + 42)
      .attr("text-anchor", "middle")
      .attr("fill", "rgba(255,255,255,.70)")
      .style("font-size", "12px")
      .text(metricLabel(xKey));

    g.append("text")
      .attr("x", -h/2).attr("y", -44)
      .attr("transform", "rotate(-90)")
      .attr("text-anchor", "middle")
      .attr("fill", "rgba(255,255,255,.70)")
      .style("font-size", "12px")
      .text("評価（IMDb）");

    // color by director
    const dirs = Array.from(new Set(filtered.map(d => d.director).filter(Boolean)));
    const color = d3.scaleOrdinal()
      .domain(dirs)
      .range(d3.schemeTableau10.concat(d3.schemeSet3));

    // tooltip
    const tip = d3.select("body").append("div")
      .attr("class", "tooltip")
      .style("opacity", 0);

    const onMove = (event) => {
      const pad = 14;
      tip.style("left", (event.pageX + pad) + "px")
        .style("top", (event.pageY + pad) + "px");
    };

    const onEnter = (event, d) => {
      tip.html(`
        <div class="tTitle">${safe(d.title)}</div>
        <div class="tRow"><span>Year</span><span>${safe(d.year)}</span></div>
        <div class="tRow"><span>Director</span><span>${safe(d.director)}</span></div>
        <div class="tRow"><span>Rating</span><span>${fmtNum(d.rating, 1)}</span></div>
        <div class="tRow"><span>Runtime</span><span>${d.runtime == null ? "—" : `${Math.round(d.runtime)} min`}</span></div>
        <div class="tRow"><span>Gross</span><span>${fmtMoney(d.gross)}</span></div>
      `);
      tip.style("opacity", 1);
      onMove(event);
    };

    const onLeave = () => tip.style("opacity", 0);

    // points
    const dots = g.append("g")
      .selectAll("circle")
      .data(filtered)
      .enter()
      .append("circle")
      .attr("cx", d => x(metricValue(d, xKey)))
      .attr("cy", d => y(d.rating))
      .attr("r", 6)
      .attr("fill", d => color(d.director))
      .attr("opacity", 0.9)
      .attr("stroke", "rgba(255,255,255,.18)")
      .attr("stroke-width", 1)
      .on("mouseenter", onEnter)
      .on("mousemove", onMove)
      .on("mouseleave", onLeave);

    // brush
    const brush = d3.brush()
      .extent([[0,0],[w,h]])
      .on("brush end", ({selection}) => {
        if (!selection) {
          selected = [];
          renderTable(filtered);
          dots.attr("opacity", 0.9);
          setStatus(`表示中：${filtered.length}件（選択：0件）`);
          return;
        }
        const [[x0,y0],[x1,y1]] = selection;

        selected = filtered.filter(d => {
          const cx = x(metricValue(d, xKey));
          const cy = y(d.rating);
          return x0 <= cx && cx <= x1 && y0 <= cy && cy <= y1;
        });

        renderTable(selected.length ? selected : filtered);

        dots.attr("opacity", d => {
          const cx = x(metricValue(d, xKey));
          const cy = y(d.rating);
          const inside = x0 <= cx && cx <= x1 && y0 <= cy && cy <= y1;
          return inside ? 0.95 : 0.25;
        });

        setStatus(`表示中：${filtered.length}件（選択：${selected.length}件）`);
      });

    g.append("g").call(brush);

    // cleanup tooltip on unload
    window.addEventListener("beforeunload", () => tip.remove());
  }

  d3.csv(DATA_PATH, d3.autoType).then(rows => {
    all = rows.map(normalizeRow);

    // 年レンジ初期化
    const years = all.map(d => d.year).filter(v => v != null);
    const yMin = years.length ? d3.min(years) : 1980;
    const yMax = years.length ? d3.max(years) : 2025;

    $minYear.min = String(yMin);
    $minYear.max = String(yMax);
    $maxYear.min = String(yMin);
    $maxYear.max = String(yMax);

    $minYear.value = String(yMin);
    $maxYear.value = String(yMax);

    $minYearLabel.textContent = String(yMin);
    $maxYearLabel.textContent = String(yMax);

    // 監督リスト
    const dirs = Array.from(new Set(all.map(d => d.director).filter(Boolean))).sort((a,b)=>a.localeCompare(b));
    fillDirectorOptions(dirs);

    setStatus("読み込み完了。条件を変えて探索してね。");

    // events
    $xMetric.addEventListener("change", applyFilters);
    $director.addEventListener("change", applyFilters);
    $minYear.addEventListener("input", applyFilters);
    $maxYear.addEventListener("input", applyFilters);

    applyFilters();

    let t = null;
    window.addEventListener("resize", () => {
      clearTimeout(t);
      t = setTimeout(() => renderChart(), 80);
    });
  }).catch(err => {
    setStatus(`CSV読み込みに失敗：${String(err)}`, true);
    document.querySelector(CHART_ID).innerHTML = "";
  });
})();
