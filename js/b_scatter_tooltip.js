// js/b_scatter_tooltip.js
(() => {
  const CHART_ID = "#chart";
  const DATA_PATH = "./data/ghibli.csv";

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
    return { title, year, director, rating, runtime, _raw: raw };
  };

  const fmt = (v, d=1) => (v == null ? "—" : Number(v).toFixed(d));
  const safe = (v) => (v == null ? "—" : String(v));

  function render(data) {
    const root = document.querySelector(CHART_ID);
    root.innerHTML = "";

    const width = root.clientWidth || 960;
    const height = 430;
    const margin = { top: 16, right: 30, bottom: 44, left: 54 };
    const w = width - margin.left - margin.right;
    const h = height - margin.top - margin.bottom;

    const svg = d3.select(root)
      .append("svg")
      .attr("viewBox", `0 0 ${width} ${height}`)
      .style("width", "100%")
      .style("height", "auto");

    const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

    const x = d3.scaleLinear()
      .domain(d3.extent(data, d => d.runtime))
      .nice()
      .range([0, w]);

    const y = d3.scaleLinear()
      .domain(d3.extent(data, d => d.rating))
      .nice()
      .range([h, 0]);

    const directors = Array.from(new Set(data.map(d => d.director).filter(Boolean)));
    const color = d3.scaleOrdinal()
      .domain(directors)
      .range(d3.schemeTableau10.concat(d3.schemeSet3));

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
      .attr("x", w/2).attr("y", h + 38)
      .attr("text-anchor", "middle")
      .attr("fill", "rgba(255,255,255,.70)")
      .style("font-size", "12px")
      .text("上映時間（分）");

    g.append("text")
      .attr("x", -h/2).attr("y", -40)
      .attr("transform", "rotate(-90)")
      .attr("text-anchor", "middle")
      .attr("fill", "rgba(255,255,255,.70)")
      .style("font-size", "12px")
      .text("評価（IMDb）");

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
        <div class="tRow"><span>Rating</span><span>${fmt(d.rating, 1)}</span></div>
        <div class="tRow"><span>Runtime</span><span>${d.runtime == null ? "—" : `${Math.round(d.runtime)} min`}</span></div>
      `);
      tip.style("opacity", 1);
      onMove(event);
    };

    const onLeave = () => tip.style("opacity", 0);

    // points
    g.selectAll("circle.dot")
      .data(data)
      .enter()
      .append("circle")
      .attr("class", "dot")
      .attr("cx", d => x(d.runtime))
      .attr("cy", d => y(d.rating))
      .attr("r", 6)
      .attr("fill", d => color(d.director))
      .attr("opacity", 0.9)
      .attr("stroke", "rgba(255,255,255,.18)")
      .attr("stroke-width", 1)
      .on("mouseenter", onEnter)
      .on("mousemove", onMove)
      .on("mouseleave", onLeave);

    // small legend
    const legend = g.append("g").attr("transform", `translate(${w-10}, 0)`);
    const items = directors.slice(0, 10);
    items.forEach((name, i) => {
      const row = legend.append("g").attr("transform", `translate(0, ${i*18})`);
      row.append("circle")
        .attr("cx", 0).attr("cy", 0).attr("r", 5)
        .attr("fill", color(name)).attr("opacity", .9);
      row.append("text")
        .attr("x", 10).attr("y", 4)
        .attr("text-anchor", "end")
        .attr("fill", "rgba(255,255,255,.72)")
        .style("font-size", "12px")
        .text(name);
    });

    // cleanup tooltip on unload
    window.addEventListener("beforeunload", () => tip.remove());
  }

  d3.csv(DATA_PATH, d3.autoType).then(rows => {
    const data = rows.map(normalizeRow)
      .filter(d => d.runtime != null && d.rating != null);

    if (!data.length) {
      document.querySelector(CHART_ID).innerHTML =
        `<div class="status error">データが0件です。CSVの列名（上映時間/評価）が合っているか確認して。</div>`;
      return;
    }
    render(data);

    let t = null;
    window.addEventListener("resize", () => {
      clearTimeout(t);
      t = setTimeout(() => render(data), 80);
    });
  }).catch(err => {
    document.querySelector(CHART_ID).innerHTML =
      `<div class="status error">CSV読み込みに失敗：${String(err)}</div>`;
  });
})();
