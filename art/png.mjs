// Tiny dependency-free PNG writer and sprite-sheet packer for the hand-typed pixel art in art/.
import zlib from 'node:zlib';

export function png(w, h, rgba) {
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) Buffer.from(rgba.buffer, y * w * 4, w * 4).copy(raw, y * (w * 4 + 1) + 1);
  const chunk = (type, data) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type), data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(zlib.crc32(td));
    return Buffer.concat([len, td, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

/** Decodes an 8-bit PNG (RGBA, RGB, grey or paletted; no interlacing) to { w, h, px: RGBA bytes }. */
export function decode(buf) {
  let p = 8, w, h, type, plte, trns;
  const idat = [];
  while (p < buf.length) {
    const len = buf.readUInt32BE(p), t = buf.toString('ascii', p + 4, p + 8), d = buf.subarray(p + 8, p + 8 + len);
    if (t === 'IHDR') {
      [w, h, type] = [d.readUInt32BE(0), d.readUInt32BE(4), d[9]];
      if (d[8] !== 8 || d[12]) throw new Error(`unsupported PNG: bit depth ${d[8]}, interlace ${d[12]}`);
    }
    if (t === 'PLTE') plte = d;
    if (t === 'tRNS') trns = d;
    if (t === 'IDAT') idat.push(d);
    p += 12 + len;
  }
  const bpp = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[type], stride = w * bpp;
  const raw = zlib.inflateSync(Buffer.concat(idat)), px = new Uint8Array(w * h * 4);
  let prev = new Uint8Array(stride);
  for (let y = 0; y < h; y++) {
    const f = raw[y * (stride + 1)], cur = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    for (let i = 0; i < stride; i++) {
      const a = i >= bpp ? cur[i - bpp] : 0, b = prev[i], c = i >= bpp ? prev[i - bpp] : 0;
      const pa = Math.abs(b - c), pb = Math.abs(a - c), pc = Math.abs(a + b - 2 * c);
      cur[i] += [0, a, b, (a + b) >> 1, pa <= pb && pa <= pc ? a : pb <= pc ? b : c][f];
    }
    for (let x = 0; x < w; x++) {
      const o = (y * w + x) * 4, s = x * bpp;
      if (type === 6) px.set(cur.subarray(s, s + 4), o);
      else if (type === 2) px.set([...cur.subarray(s, s + 3), 255], o);
      else if (type === 3) px.set([...plte.subarray(cur[s] * 3, cur[s] * 3 + 3), trns && cur[s] < trns.length ? trns[cur[s]] : 255], o);
      else px.set([cur[s], cur[s], cur[s], type === 4 ? cur[s + 1] : 255], o);
    }
    prev = cur;
  }
  return { w, h, px };
}

/** Packs frames (arrays of equal-length strings, one char per pixel) into a grid; '.' is transparent. */
export function sheet(frames, palette, size, columns, scale = 1, bg = null) {
  const rows = Math.ceil(frames.length / columns);
  const W = columns * size * scale, H = rows * size * scale;
  const px = new Uint8Array(W * H * 4);
  if (bg !== null) for (let i = 0; i < W * H; i++) px.set([(bg >> 16) & 255, (bg >> 8) & 255, bg & 255, 255], i * 4);
  frames.forEach((f, i) => {
    if (f.length !== size) throw new Error(`frame ${i} has ${f.length} rows`);
    f.forEach((row, y) => {
      if (row.length !== size) throw new Error(`frame ${i} row ${y} is ${row.length} wide: "${row}"`);
      [...row].forEach((ch, x) => {
        if (ch === '.') return;
        const c = palette[ch];
        if (c === undefined) throw new Error(`frame ${i} row ${y}: unknown colour "${ch}"`);
        for (let sy = 0; sy < scale; sy++) for (let sx = 0; sx < scale; sx++) {
          const X = ((i % columns) * size + x) * scale + sx, Y = (Math.floor(i / columns) * size + y) * scale + sy;
          px.set([(c >> 16) & 255, (c >> 8) & 255, c & 255, 255], (Y * W + X) * 4);
        }
      });
    });
  });
  return png(W, H, px);
}
