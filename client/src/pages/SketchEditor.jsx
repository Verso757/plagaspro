import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Stage, Layer, Rect, Line, Circle, Text, Group, Transformer, Image as KonvaImage, Arc } from 'react-konva';
import api from '../api';
import { ArrowLeft, Save, Trash2, Maximize2, Minimize2, Ruler, Grid3X3, Lock, Undo, Redo, Hash, X, ChevronUp, ChevronDown, Layers, Target, Crosshair } from 'lucide-react';

const MODE_SELECT = 'select';
const MODE_WALL = 'wall';
const MODE_ROOM = 'room';
const MODE_TRAP = 'trap';
const MODE_DOOR = 'door';
const MODE_WINDOW = 'window';
const MODE_COTA = 'cota';

const GRID_SIZE = 40;
const PX_PER_METER = 40;
const MAX_CANVAS = 8000;

// Use refs for undo/redo to avoid stale closure issues
let _history = [];
let _idx = -1;

export default function SketchEditor() {
  const { siteId, sketchId } = useParams();
  const navigate = useNavigate();
  const stageRef = useRef(null);
  const transformerRef = useRef(null);
  const containerRef = useRef(null);
  const [sketch, setSketch] = useState(null);
  const [trapTypes, setTrapTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState(MODE_SELECT);
  const [selectedId, setSelectedId] = useState(null);
  const [editingTrap, setEditingTrap] = useState(null);
  const [trapForm, setTrapForm] = useState({ trap_type_id: '', code: '', status: 'activa', notes: '' });
  const [labelText, setLabelText] = useState('');
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawStart, setDrawStart] = useState(null);
  const [drawCurrent, setDrawCurrent] = useState(null);
  const drawStartRef = useRef(null);
  const drawCurrentRef = useRef(null);
  const [stagePos, setStagePos] = useState({ x: 0, y: 0 });
  const [stageScale, setStageScale] = useState(1);
  const [bgImage, setBgImage] = useState(null);
  const [showGrid, setShowGrid] = useState(true);
  const [showDimensions, setShowDimensions] = useState(true);
  const [angleLock, setAngleLock] = useState(true);
  const [useMeters, setUseMeters] = useState(true);
  const [canvasSize, setCanvasSize] = useState({ w: 2400, h: 1600 });
  const [showRectPreset, setShowRectPreset] = useState(false);
  const [rectPreset, setRectPreset] = useState({ widthM: 4, heightM: 3, label: '' });
  const [panelOpen, setPanelOpen] = useState('elements');
  const [showEditor, setShowEditor] = useState(null);
  const [bgOpacity, setBgOpacity] = useState(0.4);
  const [, forceRender] = useState(0);

  const isNew = sketchId === 'new';

  const pushState = (state) => {
    const clone = JSON.parse(JSON.stringify(state));
    _history = [..._history.slice(0, _idx + 1), clone];
    _idx++;
    forceRender(x => x + 1);
  };
  const canUndo = _idx > 0;
  const canRedo = _idx < _history.length - 1;

  useEffect(() => {
    const updateSize = () => { if (containerRef.current) setCanvasSize({ w: containerRef.current.clientWidth || 1200, h: containerRef.current.clientHeight || 800 }); };
    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, []);

  useEffect(() => {
    api.get('/catalogs/trap-types').then(res => setTrapTypes(res.data)).catch(() => {});
    if (!isNew) {
      api.get(`/sketches/${sketchId}`).then(res => {
        setSketch(res.data);
        pushState(res.data);
        if (res.data.background_image) {
          const img = new window.Image(); img.crossOrigin = 'anonymous';
          img.src = 'http://localhost:3001' + res.data.background_image;
          img.onload = () => setBgImage(img);
        }
        const sh = res.data?.canvas_data?.shapes || [];
        let mx = 2000, my = 1600;
        sh.forEach(s => { mx = Math.max(mx, s.x1 + 200, s.x2 + 200); my = Math.max(my, s.y1 + 200, s.y2 + 200); });
        setCanvasSize({ w: Math.min(MAX_CANVAS, mx), h: Math.min(MAX_CANVAS, my) });
        setLoading(false);
      }).catch(() => setLoading(false));
    } else {
      const initial = { canvas_data: { shapes: [] } };
      setSketch(initial);
      pushState(initial);
      setLoading(false);
    }
  }, [sketchId, isNew]);

  useEffect(() => {
    if (selectedId && transformerRef.current && stageRef.current) {
      const node = stageRef.current.findOne('#' + selectedId);
      if (node) { transformerRef.current.nodes([node]); transformerRef.current.getLayer().batchDraw(); }
    }
  }, [selectedId]);

  const safeSketch = sketch || { canvas_data: { shapes: [] }, trap_points: [] };
  const shapes = safeSketch.canvas_data?.shapes || [];
  const traps = safeSketch.trap_points || [];
  const selectedShape = shapes.find((_, i) => `shape-${i}` === selectedId);
  const selectedShapeIndex = shapes.findIndex((_, i) => `shape-${i}` === selectedId);

  const snapToGrid = (val) => Math.round(val / GRID_SIZE) * GRID_SIZE;
  const snapAngle = (x1, y1, x2, y2) => {
    if (!angleLock) return { x: x2, y: y2 };
    const angle = Math.atan2(Math.abs(y2 - y1), Math.abs(x2 - x1)) * (180 / Math.PI);
    if (angle < 15) return { x: x2, y: y1 };
    if (angle > 75) return { x: x1, y: y2 };
    return { x: x2, y: y2 };
  };
  const getPointerPos = () => {
    const s = stageRef.current; if (!s) return { x: 0, y: 0 };
    const p = s.getPointerPosition(); if (!p) return { x: 0, y: 0 };
    const t = s.getAbsoluteTransform().copy(); t.invert();
    const pos = t.point(p);
    return { x: snapToGrid(pos.x), y: snapToGrid(pos.y) };
  };
  const pxToM = (px) => Math.round((px / PX_PER_METER) * 100) / 100;
  const fmt = (pxVal) => useMeters ? `${pxToM(pxVal)}m` : `${Math.round(pxVal)}px`;
  const mToPx = (m) => Math.round(m * PX_PER_METER / GRID_SIZE) * GRID_SIZE;

  const commitShapes = (newShapes) => {
    const updated = { ...safeSketch, canvas_data: { shapes: newShapes } };
    setSketch(updated); pushState(updated);
    let mx = canvasSize.w, my = canvasSize.h;
    newShapes.forEach(s => { mx = Math.max(mx, s.x1 + 400, s.x2 + 400); my = Math.max(my, s.y1 + 400, s.y2 + 400); });
    if (mx > canvasSize.w || my > canvasSize.h) setCanvasSize({ w: Math.min(MAX_CANVAS, mx), h: Math.min(MAX_CANVAS, my) });
  };
  const handleShapeDragEnd = (i, e) => { const s = shapes[i]; const nx = snapToGrid(e.target.x()), ny = snapToGrid(e.target.y()); const w = s.x2 - s.x1, h = s.y2 - s.y1; commitShapes(shapes.map((sh, j) => j === i ? { ...sh, x1: nx, y1: ny, x2: nx + w, y2: ny + h } : sh)); };
  const handleTransformEnd = (i, e) => { const n = e.target; const sx = n.scaleX(), sy = n.scaleY(); n.scaleX(1); n.scaleY(1); const s = shapes[i]; const nx = snapToGrid(n.x()), ny = snapToGrid(n.y()); const nw = snapToGrid(Math.abs((s.x2 - s.x1) * sx)), nh = snapToGrid(Math.abs((s.y2 - s.y1) * sy)); commitShapes(shapes.map((sh, j) => j === i ? { ...sh, x1: nx, y1: ny, x2: nx + Math.max(GRID_SIZE, nw), y2: ny + Math.max(GRID_SIZE, nh) } : sh)); };
  const handleDeleteShape = (i) => { commitShapes(shapes.filter((_, j) => j !== i)); setSelectedId(null); setShowEditor(null); };
  const updateShapeProp = (i, k, v) => commitShapes(shapes.map((s, j) => j === i ? { ...s, [k]: v } : s));

  const finishDrawing = useCallback(() => {
    const st = drawStartRef.current, cur = drawCurrentRef.current;
    if (!st || !cur) { setIsDrawing(false); return; }
    let ep = cur;
    if ((mode === MODE_WALL || mode === MODE_DOOR || mode === MODE_WINDOW) && angleLock) { const sn = snapAngle(st.x, st.y, cur.x, cur.y); ep = { x: snapToGrid(sn.x), y: snapToGrid(sn.y) }; }
    if (Math.abs(ep.x - st.x) < GRID_SIZE / 2 && Math.abs(ep.y - st.y) < GRID_SIZE / 2) { setIsDrawing(false); drawStartRef.current = null; drawCurrentRef.current = null; setDrawStart(null); setDrawCurrent(null); return; }
    let shape = { type: mode, x1: st.x, y1: st.y, x2: ep.x, y2: ep.y };
    if (mode === MODE_ROOM) shape.label = labelText || '';
    if (mode === MODE_DOOR) shape.swing = 'right';
    commitShapes([...shapes, shape]);
    setIsDrawing(false); drawStartRef.current = null; drawCurrentRef.current = null; setDrawStart(null); setDrawCurrent(null);
    if (mode === MODE_ROOM && labelText) setLabelText('');
  }, [mode, angleLock, labelText, shapes.length]);

  const finishDrawingRef = useRef(null);
  useEffect(() => { finishDrawingRef.current = finishDrawing; }, [finishDrawing]);

  const handleMouseDown = () => { if (mode === MODE_SELECT || mode === MODE_TRAP) return; const pos = getPointerPos(); if (!isDrawing) { setIsDrawing(true); drawStartRef.current = pos; drawCurrentRef.current = pos; setDrawStart(pos); setDrawCurrent(pos); } };
  const handleMouseMove = () => { if (!isDrawing || !drawStartRef.current) return; let pos = getPointerPos(); if ((mode === MODE_WALL || mode === MODE_DOOR || mode === MODE_WINDOW) && angleLock) { const sn = snapAngle(drawStartRef.current.x, drawStartRef.current.y, pos.x, pos.y); pos = { x: snapToGrid(sn.x), y: snapToGrid(sn.y) }; } drawCurrentRef.current = pos; setDrawCurrent(pos); };
  const handleMouseUp = () => { if (isDrawing) finishDrawingRef.current(); };
  const lastTapRef = useRef(0);
  const handleClick = (e) => {
    if (mode === MODE_TRAP) { if (e.target !== e.target.getStage()) return; const now = Date.now(); if (now - lastTapRef.current < 300) return; lastTapRef.current = now; const pos = getPointerPos(); if (sketch?.id) addTrap(pos); else saveSketchFirst().then(() => addTrap(pos)); return; }
    if (mode === MODE_SELECT) { if (e.target === e.target.getStage()) { setSelectedId(null); setShowEditor(null); } }
  };
  const handleTap = (e) => { if (mode === MODE_SELECT || mode === MODE_TRAP) return; if (e.target !== e.target.getStage()) return; const pos = getPointerPos(); if (!isDrawing) { setIsDrawing(true); drawStartRef.current = pos; drawCurrentRef.current = pos; setDrawStart(pos); setDrawCurrent(pos); } else { drawCurrentRef.current = pos; setDrawCurrent(pos); setTimeout(() => finishDrawingRef.current?.(), 10); } };
  const handleWheel = (e) => { e.evt.preventDefault(); const s = stageRef.current; const old = stageScale; const p = s.getPointerPosition(); const ns = e.evt.deltaY < 0 ? old * 1.08 : old / 1.08; const cl = Math.max(0.1, Math.min(6, ns)); const mp = { x: (p.x - stagePos.x) / old, y: (p.y - stagePos.y) / old }; setStageScale(cl); setStagePos({ x: p.x - mp.x * cl, y: p.y - mp.y * cl }); };

  const zoomIn = () => setStageScale(s => Math.min(6, s * 1.3));
  const zoomOut = () => setStageScale(s => Math.max(0.1, s / 1.3));
  const zoomFit = () => { setStageScale(1); setStagePos({ x: 0, y: 0 }); };

  const handleUndo = () => { if (_idx > 0) { _idx--; setSketch(_history[_idx]); setSelectedId(null); setShowEditor(null); setEditingTrap(null); forceRender(x => x + 1); } };
  const handleRedo = () => { if (_idx < _history.length - 1) { _idx++; setSketch(_history[_idx]); setSelectedId(null); setShowEditor(null); setEditingTrap(null); forceRender(x => x + 1); } };

  const handleShapeSelect = (type, id) => { setSelectedId(id); if (type === 'trap') { const tid = parseInt(id.replace('trap-', '')); const trap = traps.find(t => t.id === tid); if (trap) { setEditingTrap(trap); setTrapForm({ trap_type_id: trap.trap_type_id || '', code: trap.code, status: trap.status, notes: trap.notes || '' }); setShowEditor('trap'); } } else { const idx = shapes.findIndex((_, i) => `shape-${i}` === id); if (idx >= 0) { setShowEditor('shape'); setEditingTrap(null); } } };

  const addTrap = async (pos) => { const code = `T-${Date.now().toString().slice(-4)}`; try { await api.post('/traps', { sketch_id: sketch.id, trap_type_id: trapForm.trap_type_id || trapTypes[0]?.id || null, code, x: pos.x, y: pos.y, status: 'activa' }); const updated = await api.get(`/sketches/${sketch.id}`); setSketch(updated.data); pushState(updated.data); } catch (err) { alert(err.response?.data?.error || 'Error'); } };
  const saveSketchFirst = async () => { const name = prompt('Nombre del croquis:', 'Croquis principal'); if (!name) return; const res = await api.post('/sketches', { site_id: siteId, name, canvas_data: safeSketch.canvas_data }); setSketch(res.data); pushState(res.data); return res.data; };
  const handleSave = async () => { if (!sketch?.id) { await saveSketchFirst(); return; } try { await api.put(`/sketches/${sketch.id}`, { canvas_data: safeSketch.canvas_data }); alert('Croquis guardado'); } catch (err) { alert('Error al guardar'); } };
  const handleTrapDragEnd = (trapId, e) => { const x = snapToGrid(e.target.x()), y = snapToGrid(e.target.y()); api.put(`/traps/${trapId}`, { x, y }).then(() => { const updated = (safeSketch.trap_points || []).map(t => t.id === trapId ? { ...t, x, y } : t); setSketch(prev => ({ ...prev, trap_points: updated })); }).catch(() => {}); };
  const handleUpdateTrap = async () => { if (!editingTrap) return; try { await api.put(`/traps/${editingTrap.id}`, trapForm); const res = await api.get(`/sketches/${sketch.id}`); setSketch(res.data); pushState(res.data); setEditingTrap(null); setShowEditor(null); setSelectedId(null); } catch (err) { alert(err.response?.data?.error || 'Error'); } };
  const handleDeleteTrap = async () => { if (!editingTrap) return; if (!confirm('Desactivar esta trampa?')) return; await api.delete(`/traps/${editingTrap.id}`); const res = await api.get(`/sketches/${sketch.id}`); setSketch(res.data); pushState(res.data); setEditingTrap(null); setShowEditor(null); setSelectedId(null); };
  const ensureSketchSaved = async () => { if (sketch?.id) return true; return await saveSketchFirst(); };
  const handleBgUpload = async (e) => { const file = e.target.files[0]; if (!file) return; let sid = sketch?.id; if (!sid) { const saved = await saveSketchFirst(); if (!saved) return; sid = saved.id; } console.log('Uploading bg for sketch', sid, 'file', file.name, file.size); const fd = new FormData(); fd.append('image', file); try { const res = await api.post(`/sketches/${sid}/background`, fd); const ip = res.data.background_image; console.log('Bg uploaded, path:', ip); setSketch(prev => ({ ...prev, background_image: ip })); const img = new window.Image(); img.src = ip; img.onload = () => { console.log('BG image loaded successfully'); setBgImage(img); setBgOpacity(0.4); }; img.onerror = () => console.error('BG image failed to load:', ip); } catch (err) { alert('Error al subir imagen: ' + (err.response?.data?.error || err.message)); } };
  const handlePasteBg = async (e) => { const items = e.clipboardData?.items; if (!items) return; for (const item of items) { if (item.type.startsWith('image/')) { const file = item.getAsFile(); if (!sketch?.id) { if (!(await saveSketchFirst())) return; } const sid = sketch?.id; if (!sid) return; const fd = new FormData(); fd.append('image', file); try { const res = await api.post(`/sketches/${sid}/background`, fd); const ip = res.data.background_image; setSketch(prev => ({ ...prev, background_image: ip })); const img = new window.Image(); img.crossOrigin = 'anonymous'; img.src = 'http://localhost:3001' + ip; img.onload = () => { setBgImage(img); setBgOpacity(0.4); }; } catch (err) { alert('Error al pegar imagen'); } break; } } };

  const insertRectangle = () => {
    const w = mToPx(Math.max(1, rectPreset.widthM)), h = mToPx(Math.max(1, rectPreset.heightM));
    const cx = snapToGrid(canvasSize.w / 2 - w / 2), cy = snapToGrid(canvasSize.h / 2 - h / 2);
    commitShapes([...shapes, { type: 'room', x1: cx, y1: cy, x2: cx + w, y2: cy + h, label: rectPreset.label || `Hab ${shapes.length + 1}` }]);
    setShowRectPreset(false); setMode(MODE_SELECT);
  };

  useEffect(() => {
    const hk = (e) => {
      if (e.key === 'Escape') { setMode(MODE_SELECT); setShowRectPreset(false); setShowEditor(null); }
      if (e.key === 'z' && e.ctrlKey && !e.shiftKey) { e.preventDefault(); handleUndo(); }
      if (e.key === 'Z' && e.ctrlKey && e.shiftKey) { e.preventDefault(); handleRedo(); }
      if (e.key === 'Delete' && selectedId) { const idx = shapes.findIndex((_, i) => `shape-${i}` === selectedId); if (idx >= 0) handleDeleteShape(idx); }
    };
    window.addEventListener('keydown', hk);
    return () => window.removeEventListener('keydown', hk);
  }, [selectedId, shapes]);

  if (loading) return <div className="loading"><div className="spinner" /></div>;

  const renderShape = (shape, i) => {
    const id = `shape-${i}`;
    const sx = Math.min(shape.x1, shape.x2), sy = Math.min(shape.y1, shape.y2);
    const sw = Math.max(Math.abs(shape.x2 - shape.x1), GRID_SIZE), sh = Math.max(Math.abs(shape.y2 - shape.y1), GRID_SIZE);
    const slen = Math.round(Math.sqrt(Math.pow(shape.x2 - shape.x1, 2) + Math.pow(shape.y2 - shape.y1, 2)));
    const dimText = (x, y) => showDimensions ? <Text text={fmt(slen)} fontSize={10} fill="#888" x={x} y={y} /> : null;
    const gProps = { key: id, id, x: sx, y: sy, draggable: mode === MODE_SELECT, onClick: () => handleShapeSelect('shape', id), onTap: () => handleShapeSelect('shape', id), onDragEnd: (e) => handleShapeDragEnd(i, e) };

    if (shape.type === 'wall') { const isH = sw > sh; const ww = isH ? sw : 6; const wh = isH ? 6 : sh; return <Group {...gProps}><Rect width={ww} height={wh} fill="#555" stroke="#333" strokeWidth={0.5} cornerRadius={1} />{dimText(sw > sh ? sw / 2 - 20 : sw + 8, sw > sh ? sh + 10 : sh / 2 - 6)}</Group>; }
    if (shape.type === 'room') return <Group {...gProps} onTransformEnd={(e) => handleTransformEnd(i, e)}><Rect width={sw} height={sh} stroke="#1a73e8" strokeWidth={2.5} dash={[8, 4]} fill="#1a73e808" cornerRadius={6} />{shape.label && <Text text={shape.label} x={sw / 2 - shape.label.length * 4} y={sh / 2 - 8} fontSize={15} fontStyle="bold" fill="#1a73e8" align="center" />}{showDimensions && sw > 80 && sh > 40 && <Text text={`${fmt(sw)} x ${fmt(sh)}`} x={4} y={sh - 16} fontSize={10} fill="#666" />}</Group>;
    if (shape.type === 'door') { const isH = sw > sh; const dw = isH ? sw : 8; const dh = isH ? 8 : sh; const flip = shape.swing === 'left'; return <Group {...gProps} onDblClick={() => updateShapeProp(i, 'swing', shape.swing === 'right' ? 'left' : 'right')}><Rect width={dw} height={dh} fill="#fff" stroke="#999" strokeWidth={0.5} />{isH ? <><Arc x={flip ? dw : 0} y={dh} innerRadius={0} outerRadius={dw} angle={flip ? -90 : 90} rotation={flip ? 0 : -90} fill="#ffffff40" stroke="#333" strokeWidth={1.5} /><Line points={[flip ? dw : 0, dh, flip ? dw : 0, 0]} stroke="#333" strokeWidth={1.5} /></> : <><Arc x={flip ? dw : 0} y={flip ? dh : 0} innerRadius={0} outerRadius={dh} angle={flip ? -90 : 90} rotation={flip ? 90 : 0} fill="#ffffff40" stroke="#333" strokeWidth={1.5} /><Line points={[flip ? dw : 0, flip ? dh : 0, flip ? 0 : dw, flip ? dh : 0]} stroke="#333" strokeWidth={1.5} /></>}{dimText(isH ? dw / 2 - 10 : dw + 4, isH ? dh + 6 : dh / 2 - 5)}</Group>; }
    if (shape.type === 'window') { const wh = 6; return <Group {...gProps}><Rect width={sw} height={wh} fill="#d4e8ff" stroke="#1a73e8" strokeWidth={0.5} cornerRadius={1} /><Line points={[0, wh/2, sw, wh/2]} stroke="#1a73e8" strokeWidth={0.5} />{dimText(sw / 2 - 15, wh + 6)}</Group>; }
    if (shape.type === 'cota') { const dx = shape.x2 - shape.x1, dy = shape.y2 - shape.y1, isH = Math.abs(dx) > Math.abs(dy); const offX = isH ? 0 : (dy > 0 ? -30 : 30), offY = isH ? (dx > 0 ? -30 : -30) : 0; const s2 = { x: shape.x1 + offX, y: shape.y1 + offY }, e2 = { x: shape.x2 + offX, y: shape.y2 + offY }; return <Group key={id} id={id} draggable={mode === MODE_SELECT} onClick={() => handleShapeSelect('shape', id)} onTap={() => handleShapeSelect('shape', id)} onDragEnd={(e) => handleShapeDragEnd(i, e)}><Line points={[shape.x1, shape.y1, s2.x, s2.y]} stroke="#d93025" strokeWidth={1.5} /><Line points={[shape.x2, shape.y2, e2.x, e2.y]} stroke="#d93025" strokeWidth={1.5} /><Line points={[s2.x, s2.y, e2.x, e2.y]} stroke="#d93025" strokeWidth={1.5} />{isH ? <><Line points={[s2.x, s2.y, s2.x + 8, s2.y - 5]} stroke="#d93025" strokeWidth={2} /><Line points={[s2.x, s2.y, s2.x + 8, s2.y + 5]} stroke="#d93025" strokeWidth={2} /><Line points={[e2.x, e2.y, e2.x - 8, e2.y - 5]} stroke="#d93025" strokeWidth={2} /><Line points={[e2.x, e2.y, e2.x - 8, e2.y + 5]} stroke="#d93025" strokeWidth={2} /></> : <><Line points={[s2.x, s2.y, s2.x - 5, s2.y + 8]} stroke="#d93025" strokeWidth={2} /><Line points={[s2.x, s2.y, s2.x + 5, s2.y + 8]} stroke="#d93025" strokeWidth={2} /><Line points={[e2.x, e2.y, e2.x - 5, e2.y - 8]} stroke="#d93025" strokeWidth={2} /><Line points={[e2.x, e2.y, e2.x + 5, e2.y - 8]} stroke="#d93025" strokeWidth={2} /></>}<Text text={fmt(slen)} fontSize={12} fill="#d93025" fontStyle="bold" x={isH ? (s2.x + e2.x) / 2 - 25 : (s2.x + e2.x) / 2 + 10} y={isH ? s2.y - 14 : (s2.y + e2.y) / 2 - 6} /></Group>; }
    return null;
  };

  const gridEls = [];
  if (showGrid) {
    for (let x = 0; x <= canvasSize.w; x += GRID_SIZE) gridEls.push(<Line key={`gv-${x}`} points={[x, 0, x, canvasSize.h]} stroke="#e0e0e0" strokeWidth={x % (GRID_SIZE * 5) === 0 ? 1 : 0.3} listening={false} />);
    for (let y = 0; y <= canvasSize.h; y += GRID_SIZE) gridEls.push(<Line key={`gh-${y}`} points={[0, y, canvasSize.w, y]} stroke="#e0e0e0" strokeWidth={y % (GRID_SIZE * 5) === 0 ? 1 : 0.3} listening={false} />);
    for (let x = 0; x <= canvasSize.w; x += GRID_SIZE * 5) gridEls.push(<Text key={`glx-${x}`} x={x + 2} y={2} text={useMeters ? `${(x / PX_PER_METER).toFixed(1)}m` : `${x}`} fontSize={9} fill="#aaa" listening={false} />);
  }

  const toolbar = (
    <div style={{ display: 'flex', gap: 4, padding: '6px 10px', background: '#ffffffee', borderRadius: 10, boxShadow: '0 2px 12px rgba(0,0,0,0.12)', flexWrap: 'wrap', alignItems: 'center', fontSize: 12 }}>
      <button className={`btn btn-sm ${mode === MODE_SELECT ? 'btn-primary' : 'btn-outline'}`} onClick={() => setMode(MODE_SELECT)} style={{ padding: '4px 9px' }} title="Seleccionar">✋</button>
      <button className={`btn btn-sm ${mode === MODE_WALL ? 'btn-primary' : 'btn-outline'}`} onClick={() => setMode(MODE_WALL)} style={{ padding: '4px 9px' }} title="Pared">🧱</button>
      <button className={`btn btn-sm ${mode === MODE_ROOM ? 'btn-primary' : 'btn-outline'}`} onClick={() => setMode(MODE_ROOM)} style={{ padding: '4px 9px' }} title="Area">📐</button>
      <button className={`btn btn-sm ${mode === MODE_DOOR ? 'btn-primary' : 'btn-outline'}`} onClick={() => setMode(MODE_DOOR)} style={{ padding: '4px 9px' }} title="Puerta">🚪</button>
      <button className={`btn btn-sm ${mode === MODE_WINDOW ? 'btn-primary' : 'btn-outline'}`} onClick={() => setMode(MODE_WINDOW)} style={{ padding: '4px 9px' }} title="Ventana">🪟</button>
      <button className={`btn btn-sm ${mode === MODE_COTA ? 'btn-primary' : 'btn-outline'}`} onClick={() => setMode(MODE_COTA)} style={{ padding: '4px 9px' }} title="Cota">📏</button>
      <button className={`btn btn-sm ${showRectPreset ? 'btn-primary' : 'btn-outline'}`} onClick={() => setShowRectPreset(!showRectPreset)} style={{ padding: '4px 9px' }} title="Rectangulo con medidas">⬜</button>
      <button className={`btn btn-sm ${mode === MODE_TRAP ? 'btn-primary' : 'btn-outline'}`} onClick={() => setMode(MODE_TRAP)} style={{ padding: '4px 9px' }} title="Trampa">📍</button>
      {mode === MODE_ROOM && <input placeholder="Nombre..." value={labelText} onChange={e => setLabelText(e.target.value)} style={{ width: 100, padding: '4px 6px', borderRadius: 4, border: '1px solid var(--gray-300)', fontSize: 11 }} />}
      <div style={{ width: 1, height: 20, background: 'var(--gray-300)', margin: '0 2px' }} />
      <button className={`btn btn-sm ${angleLock ? 'btn-primary' : 'btn-outline'}`} onClick={() => setAngleLock(!angleLock)} style={{ padding: '4px 6px', display: 'flex', alignItems: 'center', gap: 2 }} title="Bloquear a 90"><Lock size={10} /> {angleLock ? '90' : '-'}</button>
      <button className={`btn btn-sm ${showGrid ? 'btn-primary' : 'btn-outline'}`} onClick={() => setShowGrid(!showGrid)} style={{ padding: '4px 6px' }} title="Grid"><Grid3X3 size={10} /></button>
      <button className={`btn btn-sm ${showDimensions ? 'btn-primary' : 'btn-outline'}`} onClick={() => setShowDimensions(!showDimensions)} style={{ padding: '4px 6px' }} title="Cotas"><Ruler size={10} /></button>
      <button className={`btn btn-sm ${useMeters ? 'btn-primary' : 'btn-outline'}`} onClick={() => setUseMeters(!useMeters)} style={{ padding: '4px 6px' }} title="Metros/Pixels"><Hash size={10} /> {useMeters ? 'm' : 'px'}</button>
      {bgImage && <input type="range" min="0" max="100" value={Math.round(bgOpacity * 100)} onChange={e => setBgOpacity(parseInt(e.target.value) / 100)} style={{ width: 60, margin: '0 2px' }} title="Opacidad fondo" />}
      <div style={{ width: 1, height: 20, background: 'var(--gray-300)', margin: '0 2px' }} />
      <button className="btn btn-sm btn-outline" onClick={handleUndo} disabled={!canUndo} style={{ padding: '4px 6px' }} title="Deshacer Ctrl+Z"><Undo size={10} /></button>
      <button className="btn btn-sm btn-outline" onClick={handleRedo} disabled={!canRedo} style={{ padding: '4px 6px' }} title="Rehacer Ctrl+Shift+Z"><Redo size={10} /></button>
    </div>
  );

  return (
    <div ref={containerRef} style={{ position: 'fixed', inset: 0, zIndex: 2000, background: '#e8eaed', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Top bar */}
      <div style={{ position: 'absolute', top: 12, zIndex: 100, display: 'flex', gap: 4, width: '100%', justifyContent: 'space-between', padding: '0 12px' }}>
        <div style={{ display: 'flex', gap: 4 }}>
          <button className="btn btn-outline" onClick={() => navigate(`/sites/${siteId}`)} style={{ background: '#ffffffee', backdropFilter: 'blur(8px)', padding: '8px 16px', fontSize: 14 }}><ArrowLeft size={16} /> Volver</button>
          <label className="btn btn-outline" style={{ cursor: 'pointer', background: '#ffffffee', backdropFilter: 'blur(8px)', padding: '8px 16px', fontSize: 14 }}>🖼️ Fondo<input type="file" accept="image/*" onChange={handleBgUpload} style={{ display: 'none' }} /></label>
          <button className="btn btn-primary" onClick={handleSave} style={{ padding: '8px 20px', fontSize: 14 }}><Save size={16} /> Guardar</button>
        </div>
        <div style={{ position: 'absolute', left: '50%', transform: 'translateX(-50%)' }}>
          {toolbar}
        </div>
        <div style={{ width: 180 }} />
      </div>

      {/* Rect preset modal */}
      {showRectPreset && (
        <div style={{ position: 'absolute', top: 60, left: '50%', transform: 'translateX(-50%)', zIndex: 110, background: '#fff', borderRadius: 8, boxShadow: '0 4px 20px rgba(0,0,0,0.15)', padding: 14, width: 220, fontSize: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}><strong>Insertar Rectangulo</strong><button className="btn btn-sm btn-outline" onClick={() => setShowRectPreset(false)} style={{ padding: '2px 6px' }}><X size={12} /></button></div>
          <div style={{ marginBottom: 6 }}><label style={{ fontSize: 10, display: 'block', marginBottom: 2 }}>Ancho (m)</label><input type="number" min="0.5" step="0.5" value={rectPreset.widthM} onChange={e => setRectPreset({ ...rectPreset, widthM: parseFloat(e.target.value) || 4 })} style={{ width: '100%', padding: 4, borderRadius: 4, border: '1px solid var(--gray-300)', fontSize: 12 }} /></div>
          <div style={{ marginBottom: 6 }}><label style={{ fontSize: 10, display: 'block', marginBottom: 2 }}>Alto (m)</label><input type="number" min="0.5" step="0.5" value={rectPreset.heightM} onChange={e => setRectPreset({ ...rectPreset, heightM: parseFloat(e.target.value) || 3 })} style={{ width: '100%', padding: 4, borderRadius: 4, border: '1px solid var(--gray-300)', fontSize: 12 }} /></div>
          <div style={{ marginBottom: 8 }}><label style={{ fontSize: 10, display: 'block', marginBottom: 2 }}>Etiqueta</label><input value={rectPreset.label} onChange={e => setRectPreset({ ...rectPreset, label: e.target.value })} placeholder="Ej: Oficina" style={{ width: '100%', padding: 4, borderRadius: 4, border: '1px solid var(--gray-300)', fontSize: 12 }} /></div>
          <button className="btn btn-primary btn-sm" onClick={insertRectangle} style={{ width: '100%' }}>Insertar</button>
        </div>
      )}

      {/* Canvas */}
      <Stage ref={stageRef} width={canvasSize.w} height={canvasSize.h} scaleX={stageScale} scaleY={stageScale} x={stagePos.x} y={stagePos.y} draggable={mode === MODE_SELECT} onClick={handleClick} onTap={handleTap} onMouseDown={handleMouseDown} onTouchStart={handleMouseDown} onMouseMove={handleMouseMove} onTouchMove={handleMouseMove} onMouseUp={handleMouseUp} onTouchEnd={handleMouseUp} onWheel={handleWheel} style={{ flex: 1, background: '#f5f5f5', touchAction: 'none', cursor: mode === MODE_SELECT ? 'grab' : 'crosshair' }}>
<Layer><Rect x={0} y={0} width={canvasSize.w} height={canvasSize.h} stroke="#ccc" strokeWidth={1} fill="#ffffff" listening={false} />{bgImage && <KonvaImage image={bgImage} x={0} y={0} width={canvasSize.w} height={canvasSize.h} opacity={bgOpacity} listening={false} />}</Layer>
        <Layer listening={false}>{gridEls}</Layer>
        {/* Snap nodes guide layer */}
        <Layer listening={false}>
          {(mode !== MODE_SELECT && mode !== MODE_TRAP) && shapes.map((s, i) => {
            const pts = [];
            if (s.type !== 'cota') {
              pts.push({ x: s.x1, y: s.y1 }, { x: s.x2, y: s.y2 }, { x: (s.x1 + s.x2) / 2, y: (s.y1 + s.y2) / 2 });
            } else {
              pts.push({ x: s.x1, y: s.y1 }, { x: s.x2, y: s.y2 });
            }
            return pts.map((p, j) => <Circle key={`snap-${i}-${j}`} x={p.x} y={p.y} radius={5} fill="#1a73e830" stroke="#1a73e8" strokeWidth={1} />);
          })}
        </Layer>
        <Layer>
          {shapes.map((s, i) => renderShape(s, i))}
          {isDrawing && drawStart && drawCurrent && (() => {
            let ep = drawCurrent; if ((mode === MODE_WALL || mode === MODE_DOOR || mode === MODE_WINDOW) && angleLock) { const sn = snapAngle(drawStart.x, drawStart.y, drawCurrent.x, drawCurrent.y); ep = { x: snapToGrid(sn.x), y: snapToGrid(sn.y) }; }
            const x1 = Math.min(drawStart.x, ep.x), y1 = Math.min(drawStart.y, ep.y), w = Math.max(Math.abs(ep.x - drawStart.x), 8), h = Math.max(Math.abs(ep.y - drawStart.y), 8), dt = fmt(Math.round(Math.sqrt(w * w + h * h)));
            if (mode === MODE_WALL) { const isH = w > h; const wx = isH ? x1 : (drawStart.x - 3); const wy = isH ? (drawStart.y - 3) : y1; const ww = isH ? w : 6; const wh = isH ? 6 : h; return <><Rect x={wx} y={wy} width={ww} height={wh} fill="#55555588" stroke="#333" strokeWidth={0.5} dash={[3, 3]} /><Circle x={drawStart.x} y={drawStart.y} radius={4} fill="#ff4444" /><Circle x={ep.x} y={ep.y} radius={4} fill="#44ff44" />{showDimensions && <Text text={dt} x={x1 + w / 2 - 15} y={y1 + h + 4} fontSize={11} fill="#888" />}</>; }
            if (mode === MODE_DOOR) { const isH = w > h; const dw = isH ? w : 8; const dh = isH ? 8 : h; return <><Rect x={isH ? x1 : (drawStart.x - 4)} y={isH ? (drawStart.y - 4) : y1} width={dw} height={dh} fill="#ffffff88" stroke="#999" strokeWidth={0.5} dash={[3, 3]} /><Text text="Puerta" x={x1 + w / 2 - 18} y={y1 + h / 2 - 6} fontSize={11} fill="#999" /></>; }
            if (mode === MODE_WINDOW) { const isH = w > h; const wx = isH ? x1 : (drawStart.x - 3); const wy = isH ? (drawStart.y - 3) : y1; const ww = isH ? w : 6; const wh = isH ? 6 : h; return <><Rect x={wx} y={wy} width={ww} height={wh} fill="#d4e8ff88" stroke="#1a73e8" strokeWidth={0.5} dash={[3, 3]} cornerRadius={1} /><Text text="Ventana" x={x1 + w / 2 - 18} y={y1 + h / 2 - 5} fontSize={11} fill="#1a73e8" /></>; }
            if (mode === MODE_COTA) return <Line points={[drawStart.x, drawStart.y, ep.x, ep.y]} stroke="#d93025" strokeWidth={2} dash={[6, 3]} />;
            if (labelText) return <><Rect x={x1} y={y1} width={w} height={h} stroke="#1a73e888" strokeWidth={2} dash={[8, 4]} fill="#1a73e810" cornerRadius={6} /><Text text={labelText} x={x1 + w / 2 - labelText.length * 4} y={y1 + h / 2 - 8} fontSize={15} fontStyle="bold" fill="#1a73e888" align="center" /></>;
            return <Rect x={x1} y={y1} width={w} height={h} stroke="#1a73e888" strokeWidth={2} dash={[8, 4]} fill="#1a73e810" cornerRadius={6} />;
          })()}
          {traps.map(trap => { const color = trap.status === 'danada' ? '#d93025' : trap.status === 'requiere_reemplazo' ? '#f9ab00' : '#0d904f'; return <Group key={`trap-${trap.id}`} id={`trap-${trap.id}`} x={trap.x} y={trap.y} draggable={mode === MODE_SELECT} onClick={() => handleShapeSelect('trap', `trap-${trap.id}`)} onTap={() => handleShapeSelect('trap', `trap-${trap.id}`)} onDragEnd={(e) => handleTrapDragEnd(trap.id, e)}><Circle radius={16} fill={color} stroke="#fff" strokeWidth={3} shadowColor="#00000040" shadowBlur={6} shadowOffsetY={3} /><Text text={trap.code} fontSize={10} fontStyle="bold" fill="#fff" align="center" width={32} x={-16} y={-6} /><Text text={trap.trap_type_icon || 'L'} fontSize={10} x={-5} y={-24} /></Group>; })}
          <Transformer ref={transformerRef} boundBoxFunc={(old, n) => n.width < GRID_SIZE || n.height < GRID_SIZE ? old : n} enabledAnchors={selectedId?.startsWith('shape-') ? ['top-left', 'top-right', 'bottom-left', 'bottom-right'] : []} anchorSize={10} anchorCornerRadius={3} borderStroke="#1a73e8" borderStrokeWidth={2} anchorFill="#fff" anchorStroke="#1a73e8" rotateEnabled={false} padding={4} />
        </Layer>
      </Stage>

      {/* Zoom controls - bottom left */}
      <div style={{ position: 'absolute', bottom: 12, left: 12, zIndex: 100, display: 'flex', flexDirection: 'column', gap: 2, background: '#ffffffee', borderRadius: 8, padding: 4, boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
        <button className="btn btn-sm btn-outline" onClick={zoomIn} style={{ padding: '4px 8px', fontSize: 16 }}>+</button>
        <span style={{ textAlign: 'center', fontSize: 10, color: 'var(--gray-600)', padding: '2px 0' }}>{Math.round(stageScale * 100)}%</span>
        <button className="btn btn-sm btn-outline" onClick={zoomOut} style={{ padding: '4px 8px', fontSize: 16 }}>-</button>
        <button className="btn btn-sm btn-outline" onClick={zoomFit} style={{ padding: '4px 6px', fontSize: 10 }}><Crosshair size={12} /></button>
      </div>

      {/* Floating panels - bottom right */}
      <div style={{ position: 'absolute', bottom: 12, right: 12, zIndex: 100, display: 'flex', flexDirection: 'column', gap: 6, maxHeight: '50vh' }}>
        {showEditor === 'trap' && editingTrap && (
          <div style={{ width: 220, background: '#ffffffee', borderRadius: 8, padding: 10, boxShadow: '0 2px 12px rgba(0,0,0,0.12)', fontSize: 11, maxHeight: 300, overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}><strong>Trampa: {editingTrap.code}</strong><button className="btn btn-sm btn-outline" onClick={() => { setShowEditor(null); setSelectedId(null); }} style={{ padding: '2px 6px' }}><X size={12} /></button></div>
            <div style={{ marginBottom: 5 }}><label style={{ fontSize: 10, display: 'block' }}>Tipo</label><select value={trapForm.trap_type_id} onChange={e => setTrapForm({ ...trapForm, trap_type_id: e.target.value })} style={{ width: '100%', padding: 3, borderRadius: 4, border: '1px solid var(--gray-300)', fontSize: 11 }}><option value="">Seleccionar...</option>{trapTypes.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select></div>
            <div style={{ marginBottom: 5 }}><label style={{ fontSize: 10, display: 'block' }}>Codigo</label><input value={trapForm.code} onChange={e => setTrapForm({ ...trapForm, code: e.target.value })} style={{ width: '100%', padding: 3, borderRadius: 4, border: '1px solid var(--gray-300)', fontSize: 11 }} /></div>
            <div style={{ marginBottom: 5 }}><label style={{ fontSize: 10, display: 'block' }}>Estado</label><select value={trapForm.status} onChange={e => setTrapForm({ ...trapForm, status: e.target.value })} style={{ width: '100%', padding: 3, borderRadius: 4, border: '1px solid var(--gray-300)', fontSize: 11 }}><option value="activa">Activa</option><option value="danada">Danada</option><option value="requiere_reemplazo">Requiere reemplazo</option><option value="retirada">Retirada</option></select></div>
            <div style={{ display: 'flex', gap: 4, marginTop: 6 }}><button className="btn btn-primary btn-sm" onClick={handleUpdateTrap} style={{ flex: 1, padding: '4px 8px', fontSize: 11 }}>Actualizar</button><button className="btn btn-danger btn-sm" onClick={handleDeleteTrap} style={{ padding: '4px 8px', fontSize: 11 }}><Trash2 size={12} /></button></div>
          </div>
        )}
        {showEditor === 'shape' && selectedShape && selectedShapeIndex >= 0 && (
          <div style={{ width: 200, background: '#ffffffee', borderRadius: 8, padding: 10, boxShadow: '0 2px 12px rgba(0,0,0,0.12)', fontSize: 11 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}><strong>{selectedShape.type === 'wall' ? 'Pared' : selectedShape.type === 'room' ? 'Area' : selectedShape.type === 'door' ? 'Puerta' : selectedShape.type === 'window' ? 'Ventana' : 'Cota'}</strong><button className="btn btn-sm btn-outline" onClick={() => { setShowEditor(null); setSelectedId(null); }} style={{ padding: '2px 6px' }}><X size={12} /></button></div>
            {selectedShape.type === 'room' && <>
              <input value={selectedShape.label || ''} onChange={e => updateShapeProp(selectedShapeIndex, 'label', e.target.value)} placeholder="Etiqueta" style={{ width: '100%', padding: 3, borderRadius: 4, border: '1px solid var(--gray-300)', fontSize: 11, marginBottom: 4 }} />
              <div style={{ display: 'flex', gap: 4, marginBottom: 4 }}>
                <div style={{ flex: 1 }}><label style={{ fontSize: 9 }}>{useMeters ? 'Ancho(m)' : 'Ancho'}</label><input type="number" min="1" step={useMeters ? 0.5 : 40} value={useMeters ? pxToM(Math.abs(selectedShape.x2 - selectedShape.x1)) : Math.abs(selectedShape.x2 - selectedShape.x1)} onChange={e => { const nw = useMeters ? Math.round(parseFloat(e.target.value) * PX_PER_METER) : parseInt(e.target.value); updateShapeProp(selectedShapeIndex, 'x2', selectedShape.x1 + Math.max(GRID_SIZE, nw)); }} style={{ width: '100%', padding: 3, borderRadius: 4, border: '1px solid var(--gray-300)', fontSize: 11 }} /></div>
                <div style={{ flex: 1 }}><label style={{ fontSize: 9 }}>{useMeters ? 'Alto(m)' : 'Alto'}</label><input type="number" min="1" step={useMeters ? 0.5 : 40} value={useMeters ? pxToM(Math.abs(selectedShape.y2 - selectedShape.y1)) : Math.abs(selectedShape.y2 - selectedShape.y1)} onChange={e => { const nh = useMeters ? Math.round(parseFloat(e.target.value) * PX_PER_METER) : parseInt(e.target.value); updateShapeProp(selectedShapeIndex, 'y2', selectedShape.y1 + Math.max(GRID_SIZE, nh)); }} style={{ width: '100%', padding: 3, borderRadius: 4, border: '1px solid var(--gray-300)', fontSize: 11 }} /></div>
              </div>
            </>}
            <button className="btn btn-sm btn-danger" onClick={() => handleDeleteShape(selectedShapeIndex)} style={{ width: '100%', padding: '4px 8px', fontSize: 11 }}><Trash2 size={12} /> Eliminar</button>
            {(selectedShape.type === 'door') && (
              <button className="btn btn-sm btn-outline" onClick={() => updateShapeProp(selectedShapeIndex, 'swing', selectedShape.swing === 'right' ? 'left' : 'right')} style={{ width: '100%', marginTop: 4, padding: '4px 8px', fontSize: 11 }}>
                Abre hacia: {selectedShape.swing === 'right' ? 'Derecha' : 'Izquierda'} (doble click)
              </button>
            )}
          </div>
        )}
        <div style={{ width: 260, background: '#ffffffee', borderRadius: 10, boxShadow: '0 2px 16px rgba(0,0,0,0.15)', fontSize: 13, overflow: 'hidden' }}>
          <div onClick={() => setPanelOpen(panelOpen === 'elements' ? null : 'elements')} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', cursor: 'pointer', background: panelOpen === 'elements' ? 'var(--primary-light)' : 'transparent' }}>
            <span><Layers size={16} /> Elementos ({shapes.length})</span>
            {panelOpen === 'elements' ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
          </div>
          {panelOpen === 'elements' && (
            <div style={{ maxHeight: 200, overflowY: 'auto', borderTop: '1px solid var(--gray-200)' }}>
              {shapes.length === 0 ? <div style={{ padding: 16, textAlign: 'center', color: 'var(--gray-500)', fontSize: 13 }}>Sin elementos</div> :
                shapes.map((shape, i) => { const icons = { wall: '🧱', room: '📐', door: '🚪', window: '🪟', cota: '📏' }; return <div key={i} onClick={() => handleShapeSelect('shape', `shape-${i}`)} style={{ padding: '8px 14px', cursor: 'pointer', borderBottom: '1px solid var(--gray-100)', background: selectedId === `shape-${i}` ? 'var(--primary-light)' : 'transparent', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13 }}><span>{icons[shape.type] || '?'} {shape.label || shape.type}</span><button className="btn btn-sm btn-danger" style={{ padding: '2px 6px', fontSize: 11 }} onClick={(e) => { e.stopPropagation(); handleDeleteShape(i); }}><X size={12} /></button></div>; })}
            </div>
          )}
        </div>
        <div style={{ width: 260, background: '#ffffffee', borderRadius: 10, boxShadow: '0 2px 16px rgba(0,0,0,0.15)', fontSize: 13, overflow: 'hidden' }}>
          <div onClick={() => setPanelOpen(panelOpen === 'traps' ? null : 'traps')} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 10px', cursor: 'pointer', background: panelOpen === 'traps' ? 'var(--primary-light)' : 'transparent' }}>
            <span><Target size={12} /> Trampas ({traps.length})</span>
            {panelOpen === 'traps' ? <ChevronDown size={12} /> : <ChevronUp size={12} />}
          </div>
          {panelOpen === 'traps' && (
            <div style={{ maxHeight: 160, overflowY: 'auto', borderTop: '1px solid var(--gray-200)' }}>
              {traps.length === 0 ? <div style={{ padding: 12, textAlign: 'center', color: 'var(--gray-500)' }}>Sin trampas</div> :
                traps.map(tp => <div key={tp.id} onClick={() => handleShapeSelect('trap', `trap-${tp.id}`)} style={{ padding: '5px 10px', cursor: 'pointer', borderBottom: '1px solid var(--gray-100)', background: selectedId === `trap-${tp.id}` ? 'var(--primary-light)' : 'transparent', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 11 }}><span>{tp.trap_type_icon || '📍'} {tp.code}</span><span className={`badge badge-${tp.status === 'activa' ? 'green' : tp.status === 'danada' ? 'red' : 'yellow'}`} style={{ fontSize: 8, padding: '1px 6px' }}>{tp.status}</span></div>)}
            </div>
          )}
        </div>
      </div>

      {/* Info bar - bottom center */}
      <div style={{ position: 'absolute', bottom: 12, left: '50%', transform: 'translateX(-50%)', zIndex: 100, padding: '4px 12px', background: 'var(--primary-light)', borderRadius: 6, fontSize: 10, color: 'var(--primary-dark)', opacity: 0.9, whiteSpace: 'nowrap' }}>
        {mode === MODE_SELECT ? 'Arrastra elementos | Rueda=Zoom | Ctrl+Z=Deshacer | Supr=Eliminar' : mode === MODE_WALL ? 'Click inicio y fin para pared' : mode === MODE_ROOM ? 'Click y arrastra area' : mode === MODE_DOOR ? 'Dibuja puerta sobre muro' : mode === MODE_WINDOW ? 'Dibuja ventana sobre muro' : mode === MODE_COTA ? 'Click inicio y fin para cota' : mode === MODE_TRAP ? 'Click para colocar trampa' : ''}
        <span style={{ margin: '0 8px', color: 'var(--gray-400)' }}>|</span>
        {useMeters && '1m=40px | '}{safeSketch?.name || 'Croquis'} | {shapes.length}e | {traps.length}t | {canvasSize.w}x{canvasSize.h}
      </div>
    </div>
  );
}