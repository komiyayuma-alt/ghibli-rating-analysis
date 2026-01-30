// js/a_line.js
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
    const title = pick(raw, ["title","Title","name","Name","タイトル","作品名"]);
    const year = toNumber(pick(raw, ["year","Year","release_year","公開年","年"]));
    const rating = toNumber(pick(raw, ["rating","Rating","imdb_rating","IMDb","評価","IMDb評価","IMDB評価","スコア"]));
    const director = pick(raw, ["director","Director","監督","監督名"]);
    return { title, year, rating, director, _raw: raw };
  };

  const safeText = (v) => (v == null ? "—" : String(v));

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
      .domain(d3.extent(data, d => d.year))
      .nice()
      .range([0, w]);

    const y = d3.scaleLinear()
      .domain(d3.extent(data, d => d.rating))
      .nice()
      .range([h, 0]);

    const xAxis = d3.axisBottom(x).ticks(Math.min(8, data.length)).tickFormat(d3.format("d"));
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

    // axis labels
    g.append("text")
      .attr("x", w/2).attr("y", h + 38)
      .attr("text-anchor", "middle")
      .attr("fill", "rgba(255,255,255,.70)")
      .style("font-size", "12px")
      .text("公開年");

    g.append("text")
      .attr("x", -h/2).attr("y", -40)
      .attr("transform", "rotate(-90)")
      .attr("text-anchor", "middle")
      .attr("fill", "rgba(255,255,255,.70)")
      .style("font-size", "12px")
      .text("評価（IMDb）");

    const line = d3.line()
      .x(d => x(d.year))
      .y(d => y(d.rating))
      .curve(d3.curveMonotoneX);

    // glow
    g.append("path")
      .datum(data)
      .attr("fill", "none")
      .attr("stroke", "rgba(45,212,255,.22)")
      .attr("stroke-width", 8)
      .attr("d", line);

    g.append("path")
      .datum(data)
      .attr("fill", "none")
      .attr("stroke", "#2dd4ff")
      .attr("stroke-width", 3)
      .attr("d", line);

    g.selectAll("circle.pt")
      .data(data)
      .enter()
      .append("circle")
      .attr("class", "pt")
      .attr("cx", d => x(d.year))
      .attr("cy", d => y(d.rating))
      .attr("r", 4.5)
      .attr("fill", "#2dd4ff")
      .attr("opacity", .95);

    // label a few (top 6 by rating)
    const labelData = [...data]
      .filter(d => d.title && d.rating != null)
      .sort((a,b) => b.rating - a.rating)
      .slice(0, 6);

    g.selectAll("text.label")
      .data(labelData)
      .enter()
      .append("text")
      .attr("class", "label")
      .attr("x", d => x(d.year) + 8)
      .attr("y", d => y(d.rating) - 8)
      .attr("fill", "rgba(255,255,255,.88)")
      .style("font-size", "12px")
      .text(d => safeText(d.title));
  }

  d3.csv(DATA_PATH, d3.autoType).then(rows => {
    const data = rows.map(normalizeRow)
      .filter(d => d.year != null && d.rating != null)
      .sort((a,b) => a.year - b.year);

    if (!data.length) {
      document.querySelector(CHART_ID).innerHTML =
        `<div class="status error">データが0件です。CSVの列名（公開年/評価）が合っているか確認して。</div>`;
      return;
    }
    render(data);

    // re-render on resize
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
