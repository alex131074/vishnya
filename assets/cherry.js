/* 3D: вишни на веточке внутри светящегося циферблата на 24 часа, метка – текущее время в Омске. Чистый WebGL, без библиотек. */
(function () {
  var cv = document.getElementById('ch');
  var gl = cv && (cv.getContext('webgl', { alpha: true, antialias: true, premultipliedAlpha: true }) || cv.getContext('experimental-webgl'));
  if (!gl) { document.documentElement.classList.add('no-gl'); window.CHR = { scroll: function () {}, live: function () {} }; return; }
  var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var PI = Math.PI;

  /* ---------- математика ---------- */
  function mul(a, b) { var o = new Float32Array(16); for (var c = 0; c < 4; c++) for (var r = 0; r < 4; r++) o[c * 4 + r] = a[r] * b[c * 4] + a[4 + r] * b[c * 4 + 1] + a[8 + r] * b[c * 4 + 2] + a[12 + r] * b[c * 4 + 3]; return o; }
  function ident() { return new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]); }
  function trans(x, y, z) { var m = ident(); m[12] = x; m[13] = y; m[14] = z; return m; }
  function scl(x, y, z) { var m = ident(); m[0] = x; m[5] = y; m[10] = z; return m; }
  function rotX(a) { var c = Math.cos(a), s = Math.sin(a), m = ident(); m[5] = c; m[6] = s; m[9] = -s; m[10] = c; return m; }
  function rotY(a) { var c = Math.cos(a), s = Math.sin(a), m = ident(); m[0] = c; m[2] = -s; m[8] = s; m[10] = c; return m; }
  function rotZ(a) { var c = Math.cos(a), s = Math.sin(a), m = ident(); m[0] = c; m[1] = s; m[4] = -s; m[5] = c; return m; }
  function persp(fov, asp, n, f) { var t = 1 / Math.tan(fov / 2), m = new Float32Array(16); m[0] = t / asp; m[5] = t; m[10] = (f + n) / (n - f); m[11] = -1; m[14] = 2 * f * n / (n - f); return m; }
  function norm(v) { var l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; }
  function cross(a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }
  function dot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
  function lookAt(e, t) { var z = norm([e[0] - t[0], e[1] - t[1], e[2] - t[2]]), x = norm(cross([0, 1, 0], z)), y = cross(z, x); return new Float32Array([x[0], y[0], z[0], 0, x[1], y[1], z[1], 0, x[2], y[2], z[2], 0, -dot(x, e), -dot(y, e), -dot(z, e), 1]); }
  function basis(d) { var y = norm(d), up = Math.abs(y[2]) < .9 ? [0, 0, 1] : [1, 0, 0], x = norm(cross(up, y)), z = cross(x, y); return new Float32Array([x[0], x[1], x[2], 0, y[0], y[1], y[2], 0, z[0], z[1], z[2], 0, 0, 0, 0, 1]); }
  function chain() { var m = arguments[0]; for (var i = 1; i < arguments.length; i++) m = mul(m, arguments[i]); return m; }

  /* ---------- геометрия ---------- */
  function Geo() { this.d = []; }
  Geo.prototype.surf = function (F, nu, nv, M) { // F(u,v) -> [x,y,z,m], нормали по разностям
    M = M || ident(); var P = [], i, j, e = 1e-3;
    for (j = 0; j <= nv; j++) for (i = 0; i <= nu; i++) {
      var u = i / nu, v = j / nv, p = F(u, v), pu = F(Math.min(1, u + e), v), pu2 = F(Math.max(0, u - e), v), pv = F(u, Math.min(1, v + e)), pv2 = F(u, Math.max(0, v - e));
      var n = cross([pu[0] - pu2[0], pu[1] - pu2[1], pu[2] - pu2[2]], [pv[0] - pv2[0], pv[1] - pv2[1], pv[2] - pv2[2]]);
      if (!(n[0] || n[1] || n[2])) n = [0, 1, 0];
      P.push([p, norm(n)]);
    }
    var w = nu + 1;
    for (j = 0; j < nv; j++) for (i = 0; i < nu; i++) {
      var a = P[j * w + i], b = P[j * w + i + 1], c = P[(j + 1) * w + i + 1], d = P[(j + 1) * w + i];
      this.tri(a, b, c, M); this.tri(a, c, d, M);
    }
  };
  Geo.prototype.tri = function () {
    var M = arguments[3], self = this;
    for (var k = 0; k < 3; k++) {
      var q = arguments[k], p = q[0], n = q[1];
      self.d.push(M[0] * p[0] + M[4] * p[1] + M[8] * p[2] + M[12], M[1] * p[0] + M[5] * p[1] + M[9] * p[2] + M[13], M[2] * p[0] + M[6] * p[1] + M[10] * p[2] + M[14],
        M[0] * n[0] + M[4] * n[1] + M[8] * n[2], M[1] * n[0] + M[5] * n[1] + M[9] * n[2], M[2] * n[0] + M[6] * n[1] + M[10] * n[2], p[3]);
    }
  };
  Geo.prototype.upload = function () {
    var b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(this.d), gl.STATIC_DRAW);
    var n = this.d.length / 7; this.d = null; return { b: b, n: n };
  };

  /* лепесток: растёт вдоль y, края загибаются к центру цветка, кончик отгибается наружу */
  function petal(g, o) {
    var F = function (u, v) {
      var s = u * 2 - 1, w = o.w * Math.pow(Math.sin(PI * (.08 + .86 * v)), o.sh || .6);
      var x = s * w, y = o.l * v, z = -o.cup * s * s * w + o.curl * v * v * v * o.l;
      y -= o.tipDip ? o.tipDip * s * s * v * v : 0;
      return [x, y, z, o.m === undefined ? v : o.m];
    };
    g.surf(F, o.nu || 7, o.nv || 8, chain(rotY(o.a), trans(0, o.y || 0, o.r), rotX(o.t)));
  }
  function disc(g, r, h, m, M) { // приплюснутая полусфера: серединка, чашелистик
    g.surf(function (u, v) { var a = u * 2 * PI, b = v * PI / 2; return [Math.cos(a) * Math.cos(b) * r, Math.sin(b) * h, Math.sin(a) * Math.cos(b) * r, m]; }, 18, 5, M);
  }

  /* лист */
  var leaf = new Geo();
  petal(leaf, { a: 0, t: 0, w: .34, l: 1.5, r: 0, cup: .3, curl: .2, sh: .9, nv: 10 });
  var leafB = leaf.upload();
  /* лепесток вишнёвого цвета */
  var pet = new Geo();
  petal(pet, { a: 0, t: 0, w: .2, l: .28, r: 0, cup: .35, curl: .1, sh: .5, nu: 5, nv: 5, m: .9 });
  var petB = pet.upload();

  /* ---------- шейдеры: глянец для вишен, свечение для циферблата ---------- */
  var VS = 'attribute vec3 aP;attribute vec3 aN;attribute float aM;uniform mat4 uVP;uniform mat4 uW;varying vec3 vW;varying vec3 vN;varying float vM;' +
    'void main(){vec4 w=uW*vec4(aP,1.);vW=w.xyz;vN=mat3(uW)*aN;vM=aM;gl_Position=uVP*w;}';
  var FS = 'precision mediump float;varying vec3 vW;varying vec3 vN;varying float vM;uniform vec3 uC1;uniform vec3 uC2;uniform vec3 uE;uniform float uFade;uniform float uGl;' +
    'void main(){if(vM>1.5){gl_FragColor=vec4(uC2*uFade,uFade);return;}' +
    'vec3 N=normalize(vN);vec3 V=normalize(uE-vW);if(dot(N,V)<0.)N=-N;' +
    'vec3 base=uC1*mix(.55,1.,smoothstep(0.,.95,vM));' +
    'vec3 L1=normalize(vec3(-.5,.8,.7));vec3 L2=normalize(vec3(.9,-.1,.3));' +
    'float d1=max(0.,dot(N,L1));float d2=max(0.,dot(N,L2))*.35;' +
    'float rim=pow(1.-max(dot(N,V),0.),2.2);' +
    'float sp=pow(max(dot(N,normalize(L1+V)),0.),70.)*uGl;float sp2=pow(max(dot(N,normalize(L2+V)),0.),40.)*uGl*.35;' +
    'vec3 c=base*(.16+d1*.9+d2)+vec3(1.,.95,.97)*(sp+sp2)+vec3(1.,.28,.52)*rim*.55;' +
    'gl_FragColor=vec4(min(c,vec3(1.))*uFade,uFade);}';
  function sh(t, s) { var o = gl.createShader(t); gl.shaderSource(o, s); gl.compileShader(o); if (!gl.getShaderParameter(o, gl.COMPILE_STATUS)) console.error(gl.getShaderInfoLog(o)); return o; }
  var pg = gl.createProgram(); gl.attachShader(pg, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(pg, sh(gl.FRAGMENT_SHADER, FS)); gl.linkProgram(pg);
  var A = { p: gl.getAttribLocation(pg, 'aP'), n: gl.getAttribLocation(pg, 'aN'), m: gl.getAttribLocation(pg, 'aM') };
  var U = {}; ['uVP', 'uW', 'uC1', 'uC2', 'uE', 'uFade', 'uGl'].forEach(function (n) { U[n] = gl.getUniformLocation(pg, n); });
  gl.useProgram(pg); gl.enable(gl.DEPTH_TEST); gl.clearColor(0, 0, 0, 0);
  [A.p, A.n, A.m].forEach(function (l) { gl.enableVertexAttribArray(l); });
  function draw(buf, W, c1, c2, gloss) {
    gl.bindBuffer(gl.ARRAY_BUFFER, buf.b);
    gl.vertexAttribPointer(A.p, 3, gl.FLOAT, false, 28, 0); gl.vertexAttribPointer(A.n, 3, gl.FLOAT, false, 28, 12); gl.vertexAttribPointer(A.m, 1, gl.FLOAT, false, 28, 24);
    gl.uniformMatrix4fv(U.uW, false, W); gl.uniform3fv(U.uC1, c1); gl.uniform3fv(U.uC2, c2 || c1); gl.uniform1f(U.uGl, gloss || 0);
    gl.drawArrays(gl.TRIANGLES, 0, buf.n);
  }

  /* ---------- вишни на веточке ---------- */
  var COL = { cherry: [.6, .02, .11], stem: [.4, .44, .16], leaf: [.16, .42, .2], petal: [1, .78, .86], ring: [.32, .05, .14], tick: [.5, .12, .27], hot: [1, .32, .58], glow: [1, .2, .45] };
  var R = .82, J = [.1, 2.35, 0];
  var CH = [{ c: [-.82, -.55, .1], s: 1 }, { c: [.88, -.95, -.15], s: .94 }];
  var cher = new Geo();
  cher.surf(function (u, v) {
    var a = u * 2 * PI, b = v * PI, rad = R * (1 + .05 * Math.sin(b));
    var y = R * .9 * Math.cos(b) - .2 * Math.exp(-b * b / .1) + .05 * Math.exp(-(b - PI) * (b - PI) / .1);
    return [Math.sin(b) * rad * Math.cos(a), y, Math.sin(b) * rad * Math.sin(a), .95];
  }, 40, 28);
  var cherB = cher.upload();
  var stems = new Geo();
  CH.forEach(function (k) {
    var p0 = [k.c[0], k.c[1] + R * .9 * k.s - .18, k.c[2]], p2 = J, p1 = [k.c[0] * .55 + J[0] * .2, (p0[1] + J[1]) * .55, k.c[2] * .5];
    function bz(t) { var a = (1 - t) * (1 - t), b = 2 * t * (1 - t), c = t * t; return [a * p0[0] + b * p1[0] + c * p2[0], a * p0[1] + b * p1[1] + c * p2[1], a * p0[2] + b * p1[2] + c * p2[2]]; }
    stems.surf(function (u, v) {
      var p = bz(v), q = bz(Math.min(1, v + .01)), d = norm([q[0] - p[0], q[1] - p[1], q[2] - p[2]]);
      var x = norm(cross(d, [0, 0, 1])), y = cross(d, x), a = u * 2 * PI, r = .05 - v * .012;
      return [p[0] + (x[0] * Math.cos(a) + y[0] * Math.sin(a)) * r, p[1] + (x[1] * Math.cos(a) + y[1] * Math.sin(a)) * r, p[2] + (x[2] * Math.cos(a) + y[2] * Math.sin(a)) * r, .3 + v * .6];
    }, 8, 16);
  });
  var stemB = stems.upload();

  /* ---------- циферблат на 24 часа ---------- */
  var DR = 3.25, DZ = -.9;
  var ringSeg = new Geo(), SEG = 96; // один отрезок кольца, рисуется по кругу
  ringSeg.surf(function (u, v) { var a = (u - .5) * 2 * PI / SEG * 1.04, b = v * 2 * PI, r = .045; return [Math.sin(a) * (DR + Math.cos(b) * r), Math.cos(a) * (DR + Math.cos(b) * r), Math.sin(b) * r, 2]; }, 3, 6);
  var ringB = ringSeg.upload();
  function boxG(w, h, d) {
    var g = new Geo(), f = function (M) { g.surf(function (u, v) { return [(u - .5) * w, (v - .5) * h, d / 2, 2]; }, 1, 1, M); };
    f(ident()); f(rotY(PI)); f(rotY(PI / 2)); f(rotY(-PI / 2));
    return g;
  }
  var tickB = boxG(.06, .3, .06).upload(), tickL = boxG(.08, .55, .08).upload();
  var dotG = new Geo(); dotG.surf(function (u, v) { var a = u * 2 * PI, b = v * PI; return [Math.sin(b) * Math.cos(a) * .14, Math.cos(b) * .14, Math.sin(b) * Math.sin(a) * .14, 2]; }, 14, 8);
  var dotB = dotG.upload();

  /* лепестки, падающие сверху */
  var PT = [];
  for (var i = 0; i < 16; i++) PT.push({ x: ((i * 37) % 16) / 16 * 8 - 4, y: (i * 0.61) % 1, z: ((i * 5) % 7) / 7 * 3 - 1.2, sp: .16 + ((i * 3) % 5) * .03, rot: i * 1.7, s: .8 + (i % 3) * .2 });

  /* ---------- кадр ---------- */
  var W = 0, H = 0, live = true, last = 0, time = 0, mx = 0, my = 0, tmx = 0, tmy = 0, fade = 0, scr = 0, scrT = 0, sweep = 0;
  function omskHour() { var d = new Date(Date.now() + 6 * 3600000); return d.getUTCHours() + d.getUTCMinutes() / 60; }
  function resize() {
    var r = cv.getBoundingClientRect(), dpr = Math.min(devicePixelRatio || 1, 2);
    W = Math.max(1, Math.round(r.width * dpr)); H = Math.max(1, Math.round(r.height * dpr));
    if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; }
    gl.viewport(0, 0, W, H);
  }
  addEventListener('resize', function () { resize(); if (reduce) kick(); });
  if (matchMedia('(hover:hover)').matches) addEventListener('pointermove', function (e) { tmx = e.clientX / innerWidth - .5; tmy = e.clientY / innerHeight - .5; }, { passive: true });

  function step(dt) {
    var k = 1 - Math.exp(-dt * 5);
    fade += (1 - fade) * (1 - Math.exp(-dt * 3));
    mx += (tmx - mx) * k; my += (tmy - my) * k; scr += (scrT - scr) * k;
    sweep = Math.min(1, sweep + dt / 1.8);
  }
  function render() {
    if (!W) resize();
    var asp = W / H, d = 16.5 * Math.max(1, .95 / asp);
    var az = mx * .5 + (reduce ? 0 : Math.sin(time * .25) * .12) + scr * .5, el = .1 - my * .12, tg = [0, -.1, 0];
    var eye = [Math.sin(az) * Math.cos(el) * d, tg[1] + Math.sin(el) * d, Math.cos(az) * Math.cos(el) * d];
    var VP = mul(persp(.5, asp, 1, 80), lookAt(eye, tg));
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.uniformMatrix4fv(U.uVP, false, VP); gl.uniform3f(U.uE, eye[0], eye[1], eye[2]); gl.uniform1f(U.uFade, fade);

    /* кольцо зажигается по кругу, метка – текущий час в Омске */
    var e = sweep * sweep * (3 - 2 * sweep), n = Math.round(SEG * e), hr = omskHour(), hi = Math.floor(hr);
    var base = trans(0, 0, DZ);
    for (var s = 0; s < n; s++) draw(ringB, chain(base, rotZ(-s / SEG * 2 * PI)), COL.ring, COL.glow);
    for (var t = 0; t < 24; t++) {
      var on = t / 24 <= e, a = -t / 24 * 2 * PI, big = t % 6 === 0;
      if (!on) continue;
      draw(big ? tickL : tickB, chain(base, rotZ(a), trans(0, DR + (big ? .5 : .38), 0)), COL.tick, t === hi ? COL.hot : (big ? [.75, .2, .4] : COL.tick));
    }
    if (sweep >= 1) {
      var ha = -hr / 24 * 2 * PI, pulse = reduce ? 1 : 1 + Math.sin(time * 3) * .15;
      draw(dotB, chain(base, rotZ(ha), trans(0, DR, 0), scl(pulse, pulse, pulse)), COL.hot, [1, .55, .75]);
    }

    /* вишни качаются на черенках */
    var sw = reduce ? .03 : Math.sin(time * .9) * .07 + scr * .25;
    var root = chain(trans(J[0], J[1], J[2]), rotZ(sw), rotX(reduce ? 0 : Math.sin(time * .7) * .04), trans(-J[0], -J[1], -J[2]));
    draw(stemB, root, COL.stem, null, .1);
    CH.forEach(function (k) { draw(cherB, chain(root, trans(k.c[0], k.c[1], k.c[2]), scl(k.s, k.s, k.s)), COL.cherry, null, 1.1); });
    draw(leafB, chain(root, trans(J[0], J[1], J[2]), rotZ(-1.0), rotX(-.35), scl(1.2, 1.2, 1.2)), COL.leaf, null, .4);
    draw(leafB, chain(root, trans(J[0], J[1], J[2]), rotZ(.75), rotX(.5), scl(.85, .85, .85)), [.22, .5, .26], null, .4);

    /* лепестки */
    PT.forEach(function (p, i) {
      var y = 4.2 - ((p.y + time * p.sp * .25) % 1) * 9, x = p.x + Math.sin(time * .6 + i) * .4;
      if (reduce) y = 4.2 - p.y * 9;
      draw(petB, chain(trans(x, y, p.z), rotY(p.rot + time * .5), rotX(.8 + Math.sin(time + i) * .5), scl(p.s, p.s, p.s)), COL.petal, null, .2);
    });
  }
  function frame(now) {
    var dt = Math.min(.05, (now - last) / 1000 || .016); last = now; time += dt;
    step(dt); render();
    if (live) requestAnimationFrame(frame);
  }
  var pending = false;
  function kick() {
    if (!reduce || pending) return; pending = true;
    requestAnimationFrame(function () { pending = false; for (var i = 0; i < 80; i++) step(.05); render(); });
  }
  window.CHR = {
    scroll: function (p) { scrT = Math.max(0, Math.min(1, p)); kick(); },
    live: function (v) { if (reduce || v === live) return; live = v; if (v) { last = performance.now(); requestAnimationFrame(frame); } }
  };
  resize();
  if (reduce) { kick(); live = false; } else requestAnimationFrame(frame);
})();
