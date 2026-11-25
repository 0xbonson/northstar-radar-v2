(function () {
  'use strict';

  var F = window.RadarFmt;
  var el = F.el;
  var dialog = el('dialog', { class: 'detail', id: 'detail', 'aria-labelledby': 'detail-title' });

  function renderStep(stepStr) {
    var costIdx = stepStr.indexOf(' Cost: ');
    var timeIdx = stepStr.indexOf(' Time: ');
    var action = costIdx >= 0 ? stepStr.slice(0, costIdx) : stepStr;
    var cost = costIdx >= 0 && timeIdx > costIdx ? stepStr.slice(costIdx + 7, timeIdx).replace(/\.$/, '') : '';
    var time = timeIdx >= 0 ? stepStr.slice(timeIdx + 7).replace(/\.$/, '') : '';
    return el('li', null,
      el('div', { class: 'step-action', text: action }),
      el('div', { class: 'step-meta' },
        cost ? el('span', { class: 'pill', text: 'Cost: ' + cost }) : null,
        time ? el('span', { class: 'pill pill-time', text: 'Time: ' + time }) : null
      )
    );
  }

  function openDetail(slug, data, state, onClose) {
    var row = data.rows.filter(function (r) { return r.slug === slug; })[0];
    if (!row) return;
    state.selected = slug;
    window.RadarFilters.writeHash();
    dialog.textContent = '';

    var chains = row.chains && row.chains.length ? row.chains.join(', ') : 'Unnamed chain';
    var checkVal = F.recomputeImplied(row, data.model);
    var matchMsg = checkVal === row.implied_value_usd
      ? 'Verified offline: live JS recomputation equals board.json (' + F.fmtUsd(checkVal) + ').'
      : 'Recomputed ' + F.fmtUsd(checkVal) + ' vs board ' + F.fmtUsd(row.implied_value_usd) + '.';

    dialog.appendChild(el('div', { class: 'detail-head' },
      el('div', null,
        el('div', { class: 'detail-kicker' },
          el('span', { class: 'mono', text: 'RANK #' + row.rank + ' / ' + data.board_size }),
          el('span', { class: row.in_watchlist ? 'badge badge-wl' : 'badge badge-early', text: row.in_watchlist ? 'Watchlist >=$50M' : 'Early <$50M' })
        ),
        el('h2', { id: 'detail-title', text: row.name }),
        el('p', { class: 'sub', text: (row.category || 'Other') + ' · ' + chains })
      ),
      el('button', {
        class: 'close',
        type: 'button',
        'aria-label': 'Close details',
        text: 'Close',
        onclick: function () { dialog.close(); },
      })
    ));

    dialog.appendChild(el('section', { class: 'detail-section' },
      el('h3', { text: 'Peer-Fitted Valuation & Expected Value' }),
      el('div', { class: 'equation' },
        el('div', null, el('span', { text: 'Snapshot TVL' }), el('b', { class: 'num', text: F.fmtUsd(row.tvl_usd) })),
        el('div', null, el('span', { text: '7-day TVL momentum' }), el('b', { class: 'num', text: F.fmtPct(row.change_7d) })),
        el('div', null, el('span', { text: 'Age with no token' }), el('b', { class: 'num', text: F.fmtAge(row.age_days) })),
        el('div', null, el('span', { text: 'Category log-offset' }), el('b', { class: 'num', text: (row.category_offset >= 0 ? '+' : '') + row.category_offset.toFixed(3) })),
        el('div', { class: 'eq-sep' }, el('span', { text: 'Implied launch cap' }), el('b', { class: 'num accent', text: F.fmtUsd(row.implied_value_usd) })),
        el('div', null, el('span', { text: 'Empirical launch odds' }), el('b', { class: 'num', text: F.fmtOdds(row.launch_odds) })),
        el('div', { class: 'eq-sep' }, el('span', { text: 'Expected value (Implied x Odds)' }), el('b', { class: 'num', text: F.fmtUsd(row.expected_value_usd) }))
      ),
      el('p', { class: 'sub verify-note', text: matchMsg })
    ));

    dialog.appendChild(el('section', { class: 'detail-section' },
      el('h3', { text: 'Concrete Farm Plan (' + row.farm_steps.length + ' steps)' }),
      el('ol', { class: 'steps' }, row.farm_steps.map(renderStep))
    ));

    dialog.onclose = function () {
      state.selected = null;
      window.RadarFilters.writeHash();
      if (onClose) onClose();
    };

    if (typeof dialog.showModal === 'function') {
      if (!dialog.open) dialog.showModal();
    } else {
      dialog.setAttribute('open', '');
    }
  }

  window.RadarDetail = {
    dialog: dialog,
    open: openDetail,
  };
})();
