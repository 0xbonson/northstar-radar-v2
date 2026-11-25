(function () {
  'use strict';

  var DATA = window.RADAR;
  if (!DATA) return;
  var app = document.getElementById('app');
  var FL = window.RadarFilters;
  var B = window.RadarBoard;
  var D = window.RadarDetail;
  var P = window.RadarPeers;

  function render() {
    var focusId = document.activeElement && document.activeElement.id;
    var selStart = focusId === 'q' ? document.activeElement.selectionStart : null;

    app.textContent = '';
    var shell = window.RadarFmt.el('div', { class: 'shell' });
    shell.appendChild(B.renderTop(DATA));
    shell.appendChild(B.renderKpis(DATA));
    shell.appendChild(B.renderModelStrip(DATA));

    var filtered = FL.filterRows(DATA.rows);
    shell.appendChild(B.renderControls(DATA, filtered.length, render));

    if (FL.state.tab === 'peers') {
      shell.appendChild(P.render(DATA, FL.state, render));
    } else {
      shell.appendChild(B.renderRadarTable(FL.sortRows(filtered), DATA, render));
    }

    app.appendChild(shell);
    app.setAttribute('aria-busy', 'false');
    if (!D.dialog.isConnected) app.appendChild(D.dialog);

    if (focusId === 'q') {
      var qInput = document.getElementById('q');
      if (qInput) {
        qInput.focus();
        if (selStart !== null) qInput.setSelectionRange(selStart, selStart);
      }
    }

    if (FL.state.selected && !D.dialog.open) {
      D.open(FL.state.selected, DATA, FL.state, render);
    }
  }

  FL.readHash();
  render();

  window.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && D.dialog.open) D.dialog.close();
  });
})();
