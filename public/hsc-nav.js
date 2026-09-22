/*
 * HSC shared header/nav — single source of truth.
 * Every product page includes this ONE file instead of its own copy of the
 * header markup + CSS. Edit here once; every page that loads it updates.
 *
 * Usage on a page:
 *   <div id="hsc-shell-mount" data-subtitle="SAMPLE ATELIER · MAKE YOUR OWN VOCALS, DJ SOUNDS & FX"></div>
 *   <script src="https://atelier.hautesoundcouture.com/hsc-nav.js"></script>
 */
(function () {
  var LINKS = [
    { href: 'https://hautesoundcouture.com/', label: 'Home' },
    { href: 'https://hautesoundcouture.com/atelier/', label: 'Atelier' },
    { href: 'https://hautesoundcouture.com/edit/', label: 'The Edit' },
    { href: 'https://hautesoundcouture.com/tailor/', label: 'Tailor' },
    { href: 'https://hautesoundcouture.com/#free-samples', label: 'Free Samples' },
    { href: 'https://hautesoundcouture.com/maison/', label: 'The Maison' }
  ];

  var CSS = "html{scroll-behavior:smooth}.hsc-shell{min-height:92px;padding:0 clamp(22px,4.8vw,78px);display:grid;grid-template-columns:minmax(260px,1fr) auto minmax(260px,1fr);align-items:center;gap:30px;border-bottom:1px solid var(--line,#2a2620)}" +
    ".hsc-shell .brand{display:flex;align-items:center;gap:11px;min-width:0;text-decoration:none;color:inherit}" +
    ".hsc-shell .brand img{width:42px;height:42px;object-fit:contain;flex:none}" +
    ".hsc-shell .brand>span{font:500 10px 'DM Mono',monospace;letter-spacing:.14em;white-space:nowrap}" +
    ".hsc-shell .brand small{display:block;color:var(--muted,#9a9186);font-size:7px;letter-spacing:.1em;margin-top:5px;overflow:hidden;text-overflow:ellipsis}" +
    ".hsc-nav{display:flex;justify-content:flex-end;align-items:center;gap:clamp(14px,1.8vw,27px);font:500 13px 'DM Mono',monospace;letter-spacing:.1em;text-transform:uppercase;color:var(--muted,#9a9186);white-space:nowrap}" +
    ".hsc-nav a{transition:color .18s ease;color:inherit;text-decoration:none}" +
    ".hsc-nav a:hover,.hsc-nav a:focus-visible,.hsc-nav a[aria-current='page']{color:var(--gold,#c9a662)}" +
    "@media(max-width:1180px){.hsc-shell{display:flex;flex-direction:column;align-items:center;gap:13px;padding:17px 24px 15px;min-height:auto}.hsc-shell .brand{justify-content:center}.hsc-nav{justify-content:center;flex-wrap:wrap;row-gap:9px}.hsc-context{display:none}}" +
    "@media(max-width:700px){.hsc-shell{padding:16px 18px 15px;gap:12px}.hsc-shell .brand img{width:33px;height:33px}.hsc-shell .brand>span{font-size:8px;letter-spacing:.11em}.hsc-shell .brand small{font-size:6px;max-width:180px}.hsc-nav{gap:10px 14px;font-size:11px;letter-spacing:.08em;line-height:1.8}}";

  function render() {
    var mount = document.getElementById('hsc-shell-mount');
    if (!mount) return;

    if (!document.getElementById('hsc-nav-style')) {
      var style = document.createElement('style');
      style.id = 'hsc-nav-style';
      style.textContent = CSS;
      document.head.appendChild(style);
    }

    var subtitle = mount.getAttribute('data-subtitle') || '';
    var here = window.location.hostname + window.location.pathname;

    var linksHtml = LINKS.map(function (l) {
      var isCurrent = here.indexOf(l.href.replace(/^https?:\/\//, '').split('#')[0]) === 0 && l.href.indexOf('#') === -1;
      return '<a href="' + l.href + '"' + (isCurrent ? ' aria-current="page"' : '') + '>' + l.label + '</a>';
    }).join('');

    mount.outerHTML =
      '<header class="hsc-shell">' +
      '<a class="brand" href="https://hautesoundcouture.com/"><img src="/hsc-logo.svg" alt=""><span>HAUTE SOUND COUTURE<small>' + subtitle + '</small></span></a>' +
      '<nav class="hsc-nav" aria-label="HSC navigation">' + linksHtml + '</nav>' +
      '</header>';
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', render);
  } else {
    render();
  }
})();
