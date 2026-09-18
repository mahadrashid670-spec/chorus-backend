const express = require('express');
const db = require('../db');

const router = express.Router();

function escapeJsString(str) {
  return String(str).replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$\{/g, '\\${');
}

// GET /embed/:slug.js
// This is the file businesses paste into their site as:
//   <script src="https://your-api.example.com/embed/their-slug.js"></script>
//   <div id="chorus-wall"></div>
// It fetches the approved testimonials and renders them into #chorus-wall.
router.get('/:slug.js', (req, res) => {
  const slug = req.params.slug;
  const business = db.prepare('SELECT id, biz_name FROM businesses WHERE slug = ?').get(slug);

  res.setHeader('Content-Type', 'application/javascript');

  if (!business) {
    return res.send(`console.warn('Chorus: no business found for slug "${escapeJsString(slug)}"');`);
  }

  const rows = db.prepare(
    'SELECT name, role, quote, rating FROM testimonials WHERE business_id = ? AND approved = 1 ORDER BY created_at DESC'
  ).all(business.id);

  // Ship the approved testimonials inline so the widget renders instantly,
  // with no second network request needed from the visitor's browser.
  const dataJson = JSON.stringify(rows);

  const script = `
(function() {
  var data = ${dataJson};
  var mount = document.getElementById('chorus-wall');
  if (!mount) {
    console.warn('Chorus: add <div id="chorus-wall"></div> where you want the wall to appear');
    return;
  }

  var style = document.createElement('style');
  style.textContent = [
    '.chorus-wall{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:16px;font-family:-apple-system,Segoe UI,sans-serif;}',
    '.chorus-card{border:1px solid #e2ddd3;border-radius:10px;padding:18px;background:#fff;}',
    '.chorus-stars{color:#DE9A3C;font-size:14px;margin-bottom:8px;letter-spacing:2px;}',
    '.chorus-quote{font-size:14.5px;color:#211E24;margin:0 0 10px;line-height:1.5;}',
    '.chorus-who{font-size:13px;color:#77726C;font-weight:600;}'
  ].join('');
  document.head.appendChild(style);

  if (data.length === 0) {
    mount.innerHTML = '';
    return;
  }

  var html = '<div class="chorus-wall">' + data.map(function(t) {
    var stars = '';
    for (var i = 1; i <= 5; i++) stars += (i <= t.rating ? '\\u2605' : '\\u2606');
    var who = t.name + (t.role ? ' &middot; ' + t.role : '');
    return '<div class="chorus-card">' +
      '<div class="chorus-stars">' + stars + '</div>' +
      '<p class="chorus-quote">&ldquo;' + t.quote.replace(/</g, '&lt;') + '&rdquo;</p>' +
      '<div class="chorus-who">' + who.replace(/</g, '&lt;') + '</div>' +
    '</div>';
  }).join('') + '</div>';

  mount.innerHTML = html;
})();
`;

  res.send(script);
});

module.exports = router;
