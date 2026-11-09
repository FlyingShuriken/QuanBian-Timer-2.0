import PropTypes from 'prop-types';
import { useEffect, useRef, useState } from 'react';
import ColorModal from '../modals/ColorModal';
import AddModal from './AddRecord/AddModal';
import { assertAsset, maxArchiveBytes, maxAssetBytes } from '../../timer/assets.mjs';
import { normalizeSessions } from '../../timer/config.mjs';
import { exportPackage, importPackage } from '../../timer/packages.mjs';

function encode(bytes) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(',')[1]);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(new Blob([bytes]));
  });
}

function download(name, bytes, type) {
  const url = URL.createObjectURL(new Blob([bytes], { type }));
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function Modal({ sessions, settings, onApply, onClose }) {
  const [data, setData] = useState(sessions);
  const [theme, setTheme] = useState(settings);
  const [assets, setAssets] = useState({});
  const [view, setView] = useState('settings');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [adding, setAdding] = useState(false);
  const [colorField, setColorField] = useState(null);
  const dialog = useRef(null);
  const dragged = useRef(null);
  const pending = useRef(false);

  useEffect(() => {
    dialog.current.showModal();
  }, []);

  async function run(action) {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setError('');
    try {
      await action();
    } catch (err) {
      setError(err.message || '操作失败');
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }

  function importFile(file) {
    if (!file) return;
    run(async () => {
      if (/\.zip$/i.test(file.name)) {
        if (file.size > maxArchiveBytes) throw new Error('ZIP 文件过大');
        const next = await importPackage(await file.arrayBuffer());
        setData(next.sessions);
        setTheme(next.settings);
        setAssets(next.assets);
      } else {
        if (file.size > 512 * 1024) throw new Error('JSON 文件过大');
        setData(normalizeSessions(JSON.parse(await file.text())));
      }
      setView('stages');
    });
  }

  function upload(field, file) {
    if (!file) return;
    run(async () => {
      if (file.size > maxAssetBytes) throw new Error('图片或字体超过 8 MB');
      const bytes = new Uint8Array(await file.arrayBuffer());
      assertAsset(field, bytes);
      setAssets(old => ({ ...old, [field]: bytes }));
    });
  }

  function move(from, to) {
    if (!Number.isInteger(from) || to < 0 || to >= data.length || from === to) return;
    setData(items => {
      const next = [...items];
      const [item] = next.splice(from, 1);
      next.splice(to, 0, item);
      return next;
    });
  }

  function apply() {
    run(async () => {
      const clean = normalizeSessions(data);
      const entries = await Promise.all(Object.entries(assets).map(async ([field, bytes]) => [field, await encode(bytes)]));
      await onApply({ sessions: clean, settings: theme, assets: Object.fromEntries(entries) });
      onClose();
    });
  }

  function saveZip() {
    run(async () => {
      const bytes = await exportPackage(data, theme, async field => {
        if (assets[field]) return assets[field];
        if (!theme[field]) return;
        const response = await fetch(theme[field]);
        if (!response.ok) throw new Error('无法读取配置素材');
        return new Uint8Array(await response.arrayBuffer());
      });
      download('debate_timer_config.zip', bytes, 'application/zip');
    });
  }

  return (
    <dialog ref={dialog} aria-labelledby="setup-title"
      onCancel={event => { event.preventDefault(); if (!busy) onClose(); }}
      className="w-11/12 max-w-2xl rounded-md p-4 backdrop:bg-black/50">
      <div className="flex items-center justify-between gap-2">
        <h2 id="setup-title" className="text-lg font-bold">比赛设置</h2>
        <button type="button" aria-label="关闭" disabled={busy} onClick={onClose}>✕</button>
      </div>
      <fieldset disabled={busy} className="mt-3 flex flex-col gap-3">
        <div className="flex flex-wrap gap-3 items-center">
          <button type="button" aria-pressed={view === 'settings'} onClick={() => setView('settings')} className="rounded bg-slate-100 px-3 py-1">设定</button>
          <button type="button" aria-pressed={view === 'stages'} onClick={() => setView('stages')} className="rounded bg-slate-100 px-3 py-1">赛制</button>
          <label className="text-sm">导入 JSON / ZIP
            <input className="ml-2 max-w-56" type="file" accept=".json,.zip" onChange={event => {
              importFile(event.target.files[0]);
              event.target.value = '';
            }} />
          </label>
        </div>
        <div className="max-h-[55vh] overflow-y-auto p-1">
          {view === 'settings' ? (
            <div className="grid gap-4 sm:grid-cols-2">
              {[
                ['coverBackground', '封面背景', '.png,.jpg,.jpeg,.gif,.webp'],
                ['defaultBackground', '默认背景', '.png,.jpg,.jpeg,.gif,.webp'],
                ['customFontPath', '自定义字体', '.woff,.woff2,.ttf,.otf'],
              ].map(([field, title, accept]) => (
                <label key={field} className="flex flex-col gap-2 rounded border p-3">
                  {title}
                  <input type="file" accept={accept} onChange={event => upload(field, event.target.files[0])} />
                  {assets[field] && <span className="text-sm">已选取新文件</span>}
                </label>
              ))}
              {[['positiveColor', '正方颜色'], ['negativeColor', '反方颜色']].map(([field, title]) => (
                <button type="button" key={field} className="flex items-center gap-2 rounded border p-3" onClick={() => setColorField(field)}>
                  <span className="size-5 rounded border" style={{ backgroundColor: theme[field] }} />
                  {title}
                </button>
              ))}
            </div>
          ) : (
            <>
              <ol className="space-y-2">
                {data.map((item, index) => (
                  <li key={index} draggable onDragStart={() => { dragged.current = index; }} onDragEnd={() => { dragged.current = null; }}
                    onDragOver={event => event.preventDefault()} onDrop={event => {
                      event.preventDefault();
                      move(dragged.current, index);
                      dragged.current = null;
                    }}
                    className="flex items-center justify-between gap-2 rounded bg-slate-100 p-3">
                    <span>{item.title} · {item.duration} 秒{item.isDualTimer ? ' · 双方' : ''}</span>
                    <span className="flex gap-2">
                      <button type="button" aria-label={`上移 ${item.title}`} disabled={index === 0} onClick={() => move(index, index - 1)}>↑</button>
                      <button type="button" aria-label={`下移 ${item.title}`} disabled={index === data.length - 1} onClick={() => move(index, index + 1)}>↓</button>
                      <button type="button" className="text-red-700" onClick={() => setData(items => items.filter((_, i) => i !== index))}>删除</button>
                    </span>
                  </li>
                ))}
              </ol>
              <button type="button" className="mt-3 rounded bg-slate-100 px-3 py-1" onClick={() => setAdding(true)}>新增环节</button>
            </>
          )}
        </div>
        {error && <p role="alert" className="text-red-700">{error}</p>}
        <div className="flex flex-wrap justify-end gap-2">
          <button type="button" className="rounded border px-3 py-2" onClick={() => run(() => {
            download('data.json', JSON.stringify(normalizeSessions(data), null, 2), 'application/json');
          })}>导出 JSON</button>
          <button type="button" className="rounded border px-3 py-2" onClick={saveZip}>导出 ZIP</button>
          <button type="button" className="rounded bg-blue-700 px-3 py-2 text-white" onClick={apply}>应用配置</button>
        </div>
      </fieldset>
      {adding && <AddModal setIsModalOpen={setAdding} setData={setData} />}
      {colorField && <ColorModal isOpen onClose={() => setColorField(null)} initialColor={theme[colorField]}
        title={colorField === 'positiveColor' ? '正方颜色' : '反方颜色'}
        onColorSelect={color => setTheme(old => ({ ...old, [colorField]: color }))} />}
    </dialog>
  );
}

Modal.propTypes = {
  sessions: PropTypes.array.isRequired,
  settings: PropTypes.object.isRequired,
  onApply: PropTypes.func.isRequired,
  onClose: PropTypes.func.isRequired,
};
