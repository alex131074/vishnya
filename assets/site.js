/* Поведение страницы: время в Омске на полосе суток, 3D на прокрутке, появление блоков, отзывы, форма, панель на телефоне. */
(function () {
  var TEL = '<a href="tel:+79045851244">+7 (904) 585-12-44</a> или напишите в <a href="https://wa.me/79045851244" target="_blank" rel="noopener">WhatsApp</a>';
  var FORM_ENDPOINT = ''; /* {{адрес приёма заявок}} */
  var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  function $(id) { return document.getElementById(id); }
  var hero = $('hero'), bar = $('bar'), contacts = $('contacts');

  /* Магазин открыт круглосуточно: показываем, который час в Омске (UTC+6) */
  function clock() {
    var d = new Date(Date.now() + 6 * 3600000), h = d.getUTCHours(), m = d.getUTCMinutes();
    var t = (h < 10 ? '0' : '') + h + ':' + (m < 10 ? '0' : '') + m;
    $('now').textContent = 'В Омске ' + t + ' – мы открыты';
    $('pinT').textContent = 'сейчас ' + t + ' – открыто';
    $('pin').style.setProperty('--p', ((h + m / 60) / 24 * 100).toFixed(2) + '%');
  }
  clock(); setInterval(clock, 30000);

  function update() {
    var H = innerHeight, hr = hero.getBoundingClientRect(), cr = contacts.getBoundingClientRect();
    if (window.CHR) { CHR.live(hr.bottom > 0); CHR.scroll(-hr.top / Math.max(1, hr.height)); }
    bar.classList.toggle('on', hr.bottom < H * .3 && cr.top > H * .6);
  }
  var ticking = false;
  addEventListener('scroll', function () { if (!ticking) { ticking = true; requestAnimationFrame(function () { ticking = false; update(); }); } }, { passive: true });
  addEventListener('resize', update);
  update();

  var day = document.querySelector('.day');
  if (!reduce && 'IntersectionObserver' in window) {
    var rise = document.querySelectorAll('.sec h2,.sec .sub,.when li,.bento figure,.big-q,.side-q,.help-ph,.help blockquote,.steps li,.plist,.chips li,.rev-g:not(.rev-more) .rev,.facade,.form');
    rise.forEach(function (el) { el.classList.add('rise'); });
    var seen = new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('in'); seen.unobserve(e.target); } });
    }, { rootMargin: '0px 0px -8% 0px' });
    rise.forEach(function (el) { seen.observe(el); });
    seen.observe(day);
  } else day.classList.add('in');

  var more = $('revMore'), btn = $('revBtn');
  btn.addEventListener('click', function () {
    var o = more.classList.toggle('open');
    btn.setAttribute('aria-expanded', o);
    btn.textContent = o ? 'Свернуть отзывы' : 'Показать ещё отзывы';
  });

  var form = $('form'), msg = $('formMsg');
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var ph = form.elements.phone, ok = ph.value.replace(/\D/g, '').length >= 10;
    ph.classList.toggle('invalid', !ok);
    if (!ok) { msg.textContent = 'Укажите телефон, чтобы мы могли связаться.'; ph.focus(); return; }
    if (!FORM_ENDPOINT) { msg.innerHTML = 'Заявки с сайта пока не подключены, поэтому ваш номер не отправлен. Позвоните: ' + TEL; return; }
    fetch(FORM_ENDPOINT, { method: 'POST', body: new FormData(form) })
      .then(function (r) { if (!r.ok) throw 0; msg.textContent = 'Заявка принята, свяжемся с вами.'; form.reset(); })
      .catch(function () { msg.innerHTML = 'Заявка не отправилась. Позвоните: ' + TEL; });
  });
})();
