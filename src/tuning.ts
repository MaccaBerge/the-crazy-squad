/** Dev panel with one slider per value that has a range (values without one, like colours, get none); edits `values` in place. Toggle with the T key. Returns `sync`, to redraw the sliders after changing `values` from outside. */
export function tuningPanel<T extends Record<string, number>>(
  values: T,
  ranges: { [K in keyof T]?: [min: number, max: number, step: number] },
) {
  const defaults = { ...values };
  const panel = document.createElement('div');
  panel.style.cssText =
    'position:fixed;top:8px;right:8px;box-sizing:border-box;max-height:calc(100vh - 16px);overflow-y:auto;overscroll-behavior:contain;padding:8px;background:#000c;color:#fff;font:12px monospace;border-radius:4px;display:none';

  const rows: (() => void)[] = [];
  for (const key of Object.keys(ranges) as (keyof T & string)[]) {
    const [min, max, step] = ranges[key]!;
    const label = document.createElement('label');
    label.style.cssText = 'display:grid;grid-template-columns:90px 140px 50px;gap:6px;align-items:center';
    const slider = Object.assign(document.createElement('input'), { type: 'range', min, max, step });
    const out = document.createElement('output');
    const sync = () => { slider.value = String(values[key]); out.textContent = String(values[key]); };
    slider.oninput = () => { (values as Record<string, number>)[key] = Number(slider.value); sync(); };
    slider.onchange = () => slider.blur(); // give arrow keys back to the game after dragging
    label.append(key, slider, out);
    panel.append(label);
    rows.push(sync);
    sync();
  }

  const reset = Object.assign(document.createElement('button'), { textContent: 'Reset' });
  reset.onclick = () => { Object.assign(values, defaults); rows.forEach((sync) => sync()); };
  panel.append(reset);
  document.body.append(panel);

  addEventListener('keydown', (e) => {
    if (e.code === 'KeyT') panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
  });
  return { panel, sync: () => rows.forEach((sync) => sync()) };
}
