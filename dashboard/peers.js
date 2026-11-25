(function () {
  'use strict';

  var F = window.RadarFmt;
  var el = F.el;

  function renderPeersTable(data) {
    var tbody = el('tbody');
    data.peers.forEach(function (p) {
      var chClass = p.change_7d === null ? '' : p.change_7d >= 0 ? 'pos' : 'neg';
      var ratioStr = p.ratio.toFixed(2) + 'x';
      tbody.appendChild(el('tr', null,
        el('td', null,
          el('div', { class: 'name' },
            el('b', { text: p.name + (p.symbol ? ' (' + p.symbol + ')' : '') }),
            el('span', { class: 'sub', text: (p.category || 'Other') + ' · ' + (p.chains.slice(0, 2).join(', ') || 'Multi-chain') })
          )
        ),
        el('td', { class: 'num', text: F.fmtUsd(p.tvl_usd) }),
        el('td', { class: 'num', text: F.fmtUsd(p.mcap_usd) }),
        el('td', { class: 'num', text: F.fmtUsd(p.model_value_usd) }),
        el('td', { class: 'num', text: ratioStr }),
        el('td', { class: 'num ' + chClass, text: F.fmtPct(p.change_7d) }),
        el('td', { class: 'num', text: F.fmtAge(p.age_days) })
      ));
    });
    return el('div', { class: 'table-wrap' },
      el('table', null,
        el('thead', null, el('tr', null,
          el('th', { scope: 'col', text: 'Live Peer Protocol' }),
          el('th', { scope: 'col', text: 'TVL' }),
          el('th', { scope: 'col', text: 'Actual Mcap' }),
          el('th', { scope: 'col', text: 'Fitted Model' }),
          el('th', { scope: 'col', text: 'Actual / Fit' }),
          el('th', { scope: 'col', text: '7d' }),
          el('th', { scope: 'col', text: 'Age' })
        )),
        tbody
      )
    );
  }

  function renderExclusionsTable(data) {
    var tbody = el('tbody');
    data.exclusions.forEach(function (ex) {
      tbody.appendChild(el('tr', null,
        el('td', null,
          el('div', { class: 'name' },
            el('b', { text: ex.name }),
            el('span', { class: 'sub', text: (ex.category || 'Other') + ' · ' + (ex.chains.slice(0, 2).join(', ') || 'Multi-chain') })
          )
        ),
        el('td', { class: 'num', text: F.fmtUsd(ex.tvl_usd) }),
        el('td', { class: 'num', text: F.fmtAge(ex.age_days) }),
        el('td', null, el('span', { class: 'badge badge-excl', text: ex.reason_label }))
      ));
    });
    return el('div', { class: 'table-wrap' },
      el('table', null,
        el('thead', null, el('tr', null,
          el('th', { scope: 'col', text: 'Excluded Tokenless Protocol' }),
          el('th', { scope: 'col', text: 'TVL' }),
          el('th', { scope: 'col', text: 'Age' }),
          el('th', { scope: 'col', text: 'Exclusion Rule Triggered' })
        )),
        tbody
      )
    );
  }

  function renderPeersAndExclusions(data, state, rerender) {
    var subTabs = el('div', { class: 'subtabs' },
      el('button', {
        type: 'button',
        'aria-pressed': state.peerTab === 'peers' ? 'true' : 'false',
        text: 'Live-Token Peers (' + data.peer_mcap_size + ')',
        onclick: function () { state.peerTab = 'peers'; window.RadarFilters.writeHash(); rerender(); },
      }),
      el('button', {
        type: 'button',
        'aria-pressed': state.peerTab === 'exclusions' ? 'true' : 'false',
        text: 'Excluded by House Rule (' + data.excluded_size + ')',
        onclick: function () { state.peerTab = 'exclusions'; window.RadarFilters.writeHash(); rerender(); },
      })
    );
    var note = state.peerTab === 'peers'
      ? 'Priced live-token peers (' + data.peer_mcap_size + ' with reported mcap_usd > 0, out of ' + data.live_token_total + ' live-token records) used to fit and hold-out validate the valuation model.'
      : 'Tokenless protocols excluded under the house pre-token rule: CEX, Bridge, Canonical Bridge, Liquid Staking, Liquid Restaking, Restaked BTC, versioned pools, wrapped/staked products, exchange prefixes, and parent-protocol derivatives omitted from the watchlist.';

    return el('section', { class: 'panel' },
      el('div', { class: 'panel-head' },
        subTabs,
        el('p', { class: 'sub', text: note })
      ),
      state.peerTab === 'peers' ? renderPeersTable(data) : renderExclusionsTable(data)
    );
  }

  window.RadarPeers = {
    render: renderPeersAndExclusions,
  };
})();
