(function () {
  'use strict';

  var usdFmt = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

  function fmtUsd(n) {
    if (n === null || n === undefined || !isFinite(n)) return 'n/a';
    if (Math.abs(n) >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B';
    if (Math.abs(n) >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M';
    if (Math.abs(n) >= 1e3) return '$' + Math.round(n / 1e3) + 'K';
    return usdFmt.format(n);
  }

  function fmtPct(n) {
    if (n === null || n === undefined || !isFinite(n)) return 'n/a';
    return (n > 0 ? '+' : '') + n.toFixed(1) + '%';
  }

  function fmtOdds(p) {
    if (p === null || p === undefined || !isFinite(p)) return 'n/a';
    return (p * 100).toFixed(0) + '%';
  }

  function fmtAge(days) {
    if (days === null || days === undefined) return 'unknown';
    if (days >= 365) return (days / 365).toFixed(1) + 'y';
    return Math.max(0, Math.round(days)) + 'd';
  }

  function recomputeImplied(row, model) {
    var tvlTerm = model.beta_log_tvl * Math.log(Math.max(1, row.tvl_usd) / model.anchor_tvl_usd);
    var rawG = row.change_7d === null || row.change_7d === undefined ? 0 : row.change_7d;
    var mom = Math.max(-50, Math.min(100, rawG)) / 100;
    var momTerm = model.beta_momentum * mom;
    var ageD = row.age_days === null || row.age_days === undefined ? model.median_age_days : row.age_days;
    var ageTerm = model.beta_log_age * Math.log1p(Math.max(0, ageD) / 365);
    var catOff = row.category_offset || 0;
    return Math.max(1, Math.round(Math.exp(model.intercept + tvlTerm + momTerm + ageTerm + catOff)));
  }

  function el(tag, attrs) {
    var node = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        if (k === 'class') node.className = attrs[k];
        else if (k === 'text') node.textContent = attrs[k];
        else if (k.slice(0, 2) === 'on') node.addEventListener(k.slice(2), attrs[k]);
        else if (attrs[k] !== null && attrs[k] !== undefined) node.setAttribute(k, String(attrs[k]));
      });
    }
    for (var i = 2; i < arguments.length; i++) {
      var child = arguments[i];
      if (child === null || child === undefined) continue;
      if (Array.isArray(child)) {
        child.forEach(function (c) { if (c) node.appendChild(c); });
      } else if (typeof child === 'string') {
        node.appendChild(document.createTextNode(child));
      } else {
        node.appendChild(child);
      }
    }
    return node;
  }

  window.RadarFmt = {
    fmtUsd: fmtUsd,
    fmtPct: fmtPct,
    fmtOdds: fmtOdds,
    fmtAge: fmtAge,
    recomputeImplied: recomputeImplied,
    el: el,
  };
})();
