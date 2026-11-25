(function () {
  'use strict';

  var F = window.RadarFmt;
  var FL = window.RadarFilters;
  var el = F.el;

  function renderTop(data) {
    return el('header', { class: 'top' },
      el('div', { class: 'brand' },
        el('span', { class: 'mark', 'aria-hidden': 'true' }),
        el('div', null,
          el('span', { class: 'brand-title', text: 'Token Launch Radar' }),
          el('span', { class: 'brand-sub', text: 'Pre-token implied value & expected launch value · Offline snapshot' })
        )
      ),
      el('div', { class: 'top-meta' },
        el('span', { class: 'chip', text: 'As of ' + data.as_of }),
        el('span', { class: 'chip', text: data.total_protocols + ' protocols' }),
        el('span', { class: 'chip', text: data.peer_mcap_size + ' priced peers' })
      )
    );
  }

  function renderKpis(data) {
    var m = data.model;
    var activeSplit = m.splits.filter(function (s) { return s.id === m.split_used; })[0] || m.splits[0];
    return el('section', { class: 'kpis' },
      el('div', { class: 'kpi' },
        el('span', { class: 'kpi-label', text: 'Watchlist Covered' }),
        el('b', { class: 'kpi-val num', text: data.watchlist_size + ' / ' + data.watchlist_size }),
        el('span', { class: 'kpi-sub', text: '100% of >=$' + Math.round(data.floor_usd / 1e6) + 'M floor' })
      ),
      el('div', { class: 'kpi' },
        el('span', { class: 'kpi-label', text: 'Pre-Token Ranked' }),
        el('b', { class: 'kpi-val num', text: String(data.board_size) }),
        el('span', { class: 'kpi-sub', text: data.watchlist_size + ' watchlist + ' + data.early_size + ' early' })
      ),
      el('div', { class: 'kpi' },
        el('span', { class: 'kpi-label', text: 'Holdout Validation' }),
        el('b', { class: 'kpi-val num', text: 'rho ' + activeSplit.spearman_rho.toFixed(3) }),
        el('span', { class: 'kpi-sub', text: 'Med err ' + activeSplit.median_rel_error_pct.toFixed(1) + '% (' + activeSplit.test_n + ' held out)' })
      ),
      el('div', { class: 'kpi' },
        el('span', { class: 'kpi-label', text: 'Set Aside (Live / Excl)' }),
        el('b', { class: 'kpi-val num', text: data.live_token_total + ' / ' + data.excluded_size }),
        el('span', { class: 'kpi-sub', text: 'Empirical launch rate ' + (m.launch_base_rate * 100).toFixed(1) + '%' })
      )
    );
  }

  function renderModelStrip(data) {
    var m = data.model;
    return el('section', { class: 'model-strip' },
      el('div', { class: 'model-eq' },
        el('span', { class: 'kicker', text: 'FITTED PEER MODEL (' + m.train_count + ' TRAIN / ' + m.test_count + ' HELD OUT)' }),
        el('code', { class: 'formula', text: m.formula_line }),
        el('p', { class: 'sub', text: m.split_reason })
      ),
      el('div', { class: 'split-cards' }, m.splits.map(function (sp) {
        var used = sp.id === m.split_used;
        return el('div', { class: used ? 'split-card active' : 'split-card' },
          el('div', { class: 'split-head' },
            el('b', { text: sp.label }),
            el('span', { class: used ? 'badge badge-wl' : 'badge', text: used ? 'Selected' : 'Alt split' })
          ),
          el('div', { class: 'split-nums num', text: 'rho=' + sp.spearman_rho.toFixed(3) + ' · med err=' + sp.median_rel_error_pct.toFixed(1) + '% · n=' + sp.test_n })
        );
      }))
    );
  }

  function renderControls(data, filteredCount, rerender) {
    var st = FL.state;
    var cats = Array.from(new Set(data.rows.map(function (r) { return r.category || 'Other'; }))).sort();

    var search = el('input', {
      type: 'search',
      id: 'q',
      placeholder: 'Search name, category, chain',
      value: st.q,
      'aria-label': 'Search protocols',
    });
    search.addEventListener('input', function () { st.q = search.value; FL.writeHash(); rerender(); });

    var select = el('select', { id: 'category', 'aria-label': 'Filter by category' },
      el('option', { value: 'all', text: 'All categories' }),
      cats.map(function (c) { return el('option', { value: c, text: c, selected: c === st.category ? 'selected' : null }); })
    );
    select.addEventListener('change', function () { st.category = select.value; FL.writeHash(); rerender(); });

    var scopeBtn = function (val, label) {
      return el('button', {
        type: 'button',
        'aria-pressed': st.scope === val ? 'true' : 'false',
        text: label,
        onclick: function () { st.scope = val; FL.writeHash(); rerender(); },
      });
    };

    var tabBtn = function (val, label) {
      return el('button', {
        type: 'button',
        'aria-pressed': st.tab === val ? 'true' : 'false',
        text: label,
        onclick: function () { st.tab = val; FL.writeHash(); rerender(); },
      });
    };

    return el('div', { class: 'controls' },
      el('div', { class: 'field' }, el('label', { for: 'q', text: 'Search' }), search),
      el('div', { class: 'field' }, el('label', { for: 'category', text: 'Category' }), select),
      el('div', { class: 'field' },
        el('span', { class: 'sub', text: 'Tier' }),
        el('div', { class: 'tabs' },
          scopeBtn('all', 'All (' + data.board_size + ')'),
          scopeBtn('watchlist', 'Watchlist (' + data.watchlist_size + ')'),
          scopeBtn('early', 'Early (' + data.early_size + ')')
        )
      ),
      el('div', { class: 'field' },
        el('span', { class: 'sub', text: 'View' }),
        el('div', { class: 'tabs' },
          tabBtn('radar', 'Pre-Token Radar'),
          tabBtn('peers', 'Peers & Exclusions (' + data.peer_mcap_size + ' / ' + data.excluded_size + ')')
        )
      ),
      el('span', { class: 'count num', text: st.tab === 'radar' ? filteredCount + ' / ' + data.board_size + ' shown' : data.peer_mcap_size + ' peers · ' + data.excluded_size + ' excluded' })
    );
  }

  function sortTh(key, label, rerender) {
    var st = FL.state;
    return el('th', { scope: 'col' },
      el('button', {
        type: 'button',
        onclick: function () {
          if (st.sort === key) st.dir = -st.dir;
          else { st.sort = key; st.dir = -1; }
          FL.writeHash();
          rerender();
        },
      },
        label,
        st.sort === key ? el('span', { class: 'sort-arrow', text: st.dir < 0 ? ' ↓' : ' ↑' }) : null
      )
    );
  }

  function renderRadarTable(list, data, rerender) {
    var st = FL.state;
    if (list.length === 0) {
      return el('div', { class: 'panel empty' },
        el('h2', { text: 'No pre-token protocols match these filters' }),
        el('p', { class: 'sub', text: 'Reset search, category, or tier to view the full ranked radar.' }),
        el('button', {
          type: 'button',
          class: 'btn-reset',
          text: 'Reset filters',
          onclick: function () { st.q = ''; st.category = 'all'; st.scope = 'all'; FL.writeHash(); rerender(); },
        })
      );
    }

    var maxImplied = Math.max.apply(null, list.map(function (r) { return r.implied_value_usd; })) || 1;
    var tbody = el('tbody');
    list.forEach(function (r) {
      var chClass = r.change_7d === null ? '' : r.change_7d >= 0 ? 'pos' : 'neg';
      var barW = Math.max(4, Math.round((r.implied_value_usd / maxImplied) * 100));
      tbody.appendChild(el('tr', {
        'data-selected': st.selected === r.slug ? 'true' : 'false',
        tabindex: '0',
        onclick: function () { window.RadarDetail.open(r.slug, data, st, rerender); },
        onkeydown: function (e) {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            window.RadarDetail.open(r.slug, data, st, rerender);
          }
        },
      },
        el('td', { class: 'num rank-cell', text: '#' + r.rank }),
        el('td', null,
          el('div', { class: 'name' },
            el('div', { class: 'name-row' },
              el('b', { text: r.name }),
              el('span', { class: r.in_watchlist ? 'badge badge-wl' : 'badge badge-early', text: r.in_watchlist ? 'Watchlist' : 'Early' })
            ),
            el('span', { class: 'sub', text: (r.category || 'Other') + ' · ' + (r.chains.slice(0, 2).join(', ') || 'Multi-chain') })
          )
        ),
        el('td', { class: 'num', text: F.fmtUsd(r.tvl_usd) }),
        el('td', { class: 'num ' + chClass, text: F.fmtPct(r.change_7d) }),
        el('td', { class: 'num', text: F.fmtAge(r.age_days) }),
        el('td', null,
          el('div', { class: 'implied' },
            el('div', { class: 'bar', 'aria-hidden': 'true' }, el('i', { style: 'width:' + barW + '%' })),
            el('span', { class: 'num', text: F.fmtUsd(r.implied_value_usd) })
          )
        ),
        el('td', { class: 'num odds-cell', text: F.fmtOdds(r.launch_odds) }),
        el('td', { class: 'num ev-cell', text: F.fmtUsd(r.expected_value_usd) })
      ));
    });

    return el('div', { class: 'panel' },
      el('div', { class: 'table-wrap' },
        el('table', null,
          el('thead', null, el('tr', null,
            sortTh('implied', 'Rank', rerender),
            sortTh('name', 'Protocol', rerender),
            sortTh('tvl', 'TVL', rerender),
            sortTh('growth', '7d', rerender),
            sortTh('age', 'Age', rerender),
            sortTh('implied', 'Implied Value', rerender),
            sortTh('odds', 'Odds', rerender),
            sortTh('ev', 'Expected Value', rerender)
          )),
          tbody
        )
      )
    );
  }

  window.RadarBoard = {
    renderTop: renderTop,
    renderKpis: renderKpis,
    renderModelStrip: renderModelStrip,
    renderControls: renderControls,
    renderRadarTable: renderRadarTable,
  };
})();
