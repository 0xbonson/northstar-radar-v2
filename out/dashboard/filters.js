(function () {
  'use strict';

  var state = {
    q: '',
    category: 'all',
    scope: 'all',
    tab: 'radar',
    peerTab: 'peers',
    sort: 'implied',
    dir: -1,
    selected: null,
  };

  function readHash() {
    var hash = window.location.hash.replace(/^#/, '');
    if (!hash) return;
    var p = new URLSearchParams(hash);
    if (p.get('q')) state.q = p.get('q');
    if (p.get('category')) state.category = p.get('category');
    if (p.get('scope')) state.scope = p.get('scope');
    if (p.get('tab')) state.tab = p.get('tab');
    if (p.get('peerTab')) state.peerTab = p.get('peerTab');
    if (p.get('sort')) state.sort = p.get('sort');
    if (p.get('dir')) state.dir = p.get('dir') === '1' ? 1 : -1;
    if (p.get('p')) state.selected = p.get('p');
  }

  function writeHash() {
    var p = new URLSearchParams();
    if (state.q) p.set('q', state.q);
    if (state.category !== 'all') p.set('category', state.category);
    if (state.scope !== 'all') p.set('scope', state.scope);
    if (state.tab !== 'radar') p.set('tab', state.tab);
    if (state.peerTab !== 'peers') p.set('peerTab', state.peerTab);
    if (state.sort !== 'implied') p.set('sort', state.sort);
    if (state.dir !== -1) p.set('dir', String(state.dir));
    if (state.selected) p.set('p', state.selected);
    var next = p.toString();
    var base = window.location.pathname + window.location.search;
    window.history.replaceState(null, '', next ? '#' + next : base);
  }

  function filterRows(list) {
    var q = state.q.trim().toLowerCase();
    return list.filter(function (r) {
      if (state.scope === 'watchlist' && !r.in_watchlist) return false;
      if (state.scope === 'early' && r.in_watchlist) return false;
      if (state.category !== 'all' && (r.category || 'Other') !== state.category) return false;
      if (!q) return true;
      var hay = [r.name, r.slug, r.category || '', (r.chains || []).join(' ')].join(' ').toLowerCase();
      return hay.indexOf(q) >= 0;
    });
  }

  function sortRows(list) {
    var key = state.sort;
    var dir = state.dir;
    return list.slice().sort(function (a, b) {
      var av, bv;
      if (key === 'name') { av = a.name.toLowerCase(); bv = b.name.toLowerCase(); }
      else if (key === 'tvl') { av = a.tvl_usd; bv = b.tvl_usd; }
      else if (key === 'growth') {
        av = a.change_7d === null ? -Infinity : a.change_7d;
        bv = b.change_7d === null ? -Infinity : b.change_7d;
      } else if (key === 'age') {
        av = a.age_days === null ? Infinity : a.age_days;
        bv = b.age_days === null ? Infinity : b.age_days;
      } else if (key === 'odds') {
        av = a.launch_odds;
        bv = b.launch_odds;
      } else if (key === 'ev') {
        av = a.expected_value_usd;
        bv = b.expected_value_usd;
      } else {
        av = a.implied_value_usd;
        bv = b.implied_value_usd;
      }
      if (av < bv) return -dir;
      if (av > bv) return dir;
      return a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0;
    });
  }

  window.RadarFilters = {
    state: state,
    readHash: readHash,
    writeHash: writeHash,
    filterRows: filterRows,
    sortRows: sortRows,
  };
})();
