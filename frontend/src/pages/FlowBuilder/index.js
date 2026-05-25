import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { Button, Chip, Grid, MenuItem, Paper, TextField, Typography, makeStyles } from "@material-ui/core";
import { Add, Save, Visibility } from "@material-ui/icons";
import { toast } from "react-toastify";
import api from "../../services/api";

const useStyles = makeStyles(theme => ({
  root: { display: "grid", gap: theme.spacing(1.5) },
  panel: { padding: theme.spacing(1.5), borderRadius: 10, border: "1px solid #e4e7ec", background: "#fff" },
  canvasShell: { position: "relative", borderRadius: 10, overflow: "hidden", border: "1px solid #d7dbe5" },
  topBar: { height: 8, background: "#2e7d32" },
  canvasWrap: { position: "relative", minHeight: 560, maxHeight: 680, background: "#eef0f3", overflow: "auto" },
  canvas: { position: "relative", width: 2000, height: 980, transformOrigin: "top left" },
  node: {
    position: "absolute",
    minWidth: 170,
    maxWidth: 210,
    background: "#fff",
    border: "1px solid #d6dbe6",
    borderRadius: 6,
    boxShadow: "0 2px 8px rgba(17,24,39,.08)",
    padding: "6px 8px",
    cursor: "move"
  },
  nodeHandle: {
    position: "absolute",
    width: 10,
    height: 10,
    borderRadius: "50%",
    background: "#2e7d32",
    border: "2px solid #fff",
    boxShadow: "0 0 0 1px #9eb3d1",
    cursor: "crosshair"
  },
  nodeTitle: { fontWeight: 600, fontSize: 11, color: "#384152" },
  nodeBody: { fontSize: 10, opacity: 0.9, marginTop: 3, whiteSpace: "pre-line", color: "#5a6474" },
  svg: { position: "absolute", inset: 0, pointerEvents: "none" },
  toolbar: { display: "flex", justifyContent: "space-between", gap: 8, marginBottom: 6, flexWrap: "wrap" },
  navGroup: { display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" },
  fullscreen: { position: "fixed", inset: 0, zIndex: 1300, background: "#eceff4", padding: 10 },
  review: { marginTop: theme.spacing(1), padding: theme.spacing(1), border: "1px dashed #c8ced9", borderRadius: 8, background: "#fbfcfe" },
  stencil: {
    position: "absolute",
    left: 8,
    top: 12,
    zIndex: 4,
    display: "grid",
    gap: 8,
    background: "transparent",
    borderRadius: 999,
    padding: 4
  },
  stencilItem: { display: "flex", alignItems: "center", gap: 8 },
  stencilDot: {
    width: 26,
    height: 26,
    borderRadius: "50%",
    display: "grid",
    placeItems: "center",
    fontSize: 11,
    color: "#243244",
    background: "#fff",
    border: "1px solid #cfd6e3",
    boxShadow: "0 1px 4px rgba(0,0,0,.08)"
  },
  stencilLabel: {
    fontSize: 10,
    background: "#f7f8fb",
    border: "1px solid #d8ddea",
    borderRadius: 6,
    padding: "2px 8px",
    color: "#6a7385"
  },
  miniSave: { position: "absolute", right: 8, top: 14, zIndex: 4, minWidth: 72, height: 24, fontSize: 10, borderRadius: 4 }
}));

const nodeTypes = [
  { value: "message", label: "Exibir mensagem" },
  { value: "webhook", label: "Webhook (n8n)" },
  { value: "kanban", label: "Mover Kanban" },
  { value: "condition", label: "Condição" },
  { value: "menu", label: "Menu" }
];

const stencilItems = ["Início", "Conteúdo", "Menu", "Randomizador", "Intervalo", "Ticket", "TypeBot", "OpenAI", "Pergunta"];

export default function FlowBuilder() {
  const classes = useStyles();
  const canvasRef = useRef(null);
  const dragStateRef = useRef(null);
  const [zoom, setZoom] = useState(1);
  const [maximized, setMaximized] = useState(false);

  const [flowName, setFlowName] = useState("Novo fluxo");
  const [keywords, setKeywords] = useState("");
  const [newType, setNewType] = useState("message");
  const [selectedFrom, setSelectedFrom] = useState("start");
  const [selectedTo, setSelectedTo] = useState("n1");
  const [replyMessage, setReplyMessage] = useState("Olá! Como posso ajudar?");
  const [webhookUrl, setWebhookUrl] = useState("");
  const [webhookMethod, setWebhookMethod] = useState("POST");
  const [webhookPayload, setWebhookPayload] = useState('{"ticketId":"{{ticket.id}}","message":"{{message.body}}"}');
  const [kanbanColumn, setKanbanColumn] = useState("");
  const [reviewOpen, setReviewOpen] = useState(false);
  const [savedFlows, setSavedFlows] = useState([]);
  const [linkingFrom, setLinkingFrom] = useState(null);
  const [linkPointer, setLinkPointer] = useState(null);
  const [hoverTarget, setHoverTarget] = useState(null);
  const [isLinkMode, setIsLinkMode] = useState(false);
  const [selectedNodeId, setSelectedNodeId] = useState("n1");

  const [nodes, setNodes] = useState([
    { id: "start", type: "start", label: "Início", value: "Mensagem recebida", x: 120, y: 150 },
    { id: "n1", type: "message", label: "Exibir mensagem", value: "Olá! Como posso ajudar?", x: 360, y: 150 }
  ]);
  const [edges, setEdges] = useState([{ from: "start", to: "n1" }]);

  const byId = useMemo(() => Object.fromEntries(nodes.map(n => [n.id, n])), [nodes]);
  const validEdges = useMemo(() => edges.filter(e => byId[e.from] && byId[e.to]), [edges, byId]);

  const loadFlows = async () => {
    try { const { data } = await api.get("/flows"); setSavedFlows(Array.isArray(data) ? data : []); }
    catch { toast.warning("Não foi possível carregar os fluxos salvos"); }
  };

  useEffect(() => { loadFlows(); }, []);
  useEffect(() => {
    const onKeyDown = e => {
      if (e.key === "Escape") {
        setMaximized(false);
        setLinkingFrom(null);
        setLinkPointer(null);
        setHoverTarget(null);
        setIsLinkMode(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => { setEdges(prev => prev.filter(e => byId[e.from] && byId[e.to])); }, [byId]);

  const onGlobalMouseMove = useCallback((e) => {
    if (!canvasRef.current) return;
    const canvasRect = canvasRef.current.getBoundingClientRect();
    const pointerX = (e.clientX - canvasRect.left + canvasRef.current.scrollLeft) / zoom;
    const pointerY = (e.clientY - canvasRect.top + canvasRef.current.scrollTop) / zoom;

    if (linkingFrom) {
      setLinkPointer({ x: pointerX, y: pointerY });
    }

    const drag = dragStateRef.current;
    if (!drag) return;
    const nextX = Math.max(20, pointerX - drag.offsetX);
    const nextY = Math.max(20, pointerY - drag.offsetY);
    setNodes(prev => prev.map(n => (n.id === drag.id ? { ...n, x: nextX, y: nextY } : n)));
  }, [zoom, linkingFrom]);

  const onGlobalMouseUp = useCallback(() => {
    dragStateRef.current = null;
  }, []);

  useEffect(() => {
    window.addEventListener("mousemove", onGlobalMouseMove);
    window.addEventListener("mouseup", onGlobalMouseUp);
    return () => {
      window.removeEventListener("mousemove", onGlobalMouseMove);
      window.removeEventListener("mouseup", onGlobalMouseUp);
    };
  }, [onGlobalMouseMove, onGlobalMouseUp]);

  const scrollCanvas = (dx, dy) => canvasRef.current?.scrollBy({ left: dx, top: dy, behavior: "smooth" });

  const validateAction = () => {
    if (!flowName.trim()) return "Informe o nome do fluxo.";
    if (!keywords.trim()) return "Informe ao menos 1 palavra-chave.";
    if (newType === "message" && !replyMessage.trim()) return "A resposta automática está vazia.";
    if (newType === "webhook") { if (!webhookUrl.trim()) return "Informe a URL do webhook."; try { new URL(webhookUrl); } catch { return "URL do webhook inválida."; } }
    if (newType === "kanban" && !kanbanColumn) return "Selecione a coluna do Kanban.";
    return null;
  };

  const addNode = () => {
    const err = validateAction(); if (err) return toast.warning(err);
    const id = `n${Date.now()}`;
    const value = newType === "message" ? replyMessage : newType === "webhook" ? `${webhookMethod} ${webhookUrl || "URL pendente"}` : newType === "kanban" ? `Mover para: ${kanbanColumn || "coluna pendente"}` : "Configurar...";
    setNodes(prev => [...prev, { id, type: newType, label: nodeTypes.find(t => t.value === newType)?.label || "Bloco", value, x: 580, y: 120 + (prev.length % 6) * 75 }]);
    setSelectedTo(id);
  };

  const addConnection = () => {
    if (!selectedFrom || !selectedTo || selectedFrom === selectedTo) return toast.warning("Selecione origem e destino válidos");
    setEdges(prev => prev.find(e => e.from === selectedFrom && e.to === selectedTo) ? prev : [...prev, { from: selectedFrom, to: selectedTo }]);
  };

  const onStartLink = (id, e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!canvasRef.current) return;
    const canvasRect = canvasRef.current.getBoundingClientRect();
    const pointerX = (e.clientX - canvasRect.left + canvasRef.current.scrollLeft) / zoom;
    const pointerY = (e.clientY - canvasRect.top + canvasRef.current.scrollTop) / zoom;
    setLinkingFrom(id);
    setLinkPointer({ x: pointerX, y: pointerY });
    setHoverTarget(null);
    setIsLinkMode(true);
  };

  const finishLinkTo = (id) => {
    if (!linkingFrom) return;
    if (linkingFrom === id) {
      setLinkingFrom(null);
      setLinkPointer(null);
      setHoverTarget(null);
      setIsLinkMode(false);
      return;
    }
    setEdges(prev => prev.find(edge => edge.from === linkingFrom && edge.to === id) ? prev : [...prev, { from: linkingFrom, to: id }]);
    setLinkingFrom(null);
    setLinkPointer(null);
    setHoverTarget(null);
    setIsLinkMode(false);
  };

  const onFinishLink = (id, e) => {
    e.stopPropagation();
    finishLinkTo(id);
  };

  const onNodeMouseDown = (id, e) => {
    if (isLinkMode || linkingFrom) return;
    if (e.button !== 0) return;
    if (!canvasRef.current) return;
    const node = byId[id];
    if (!node) return;
    const canvasRect = canvasRef.current.getBoundingClientRect();
    const pointerX = (e.clientX - canvasRect.left + canvasRef.current.scrollLeft) / zoom;
    const pointerY = (e.clientY - canvasRect.top + canvasRef.current.scrollTop) / zoom;
    dragStateRef.current = {
      id,
      offsetX: pointerX - node.x,
      offsetY: pointerY - node.y
    };
    e.preventDefault();
  };

  const updateNodeValue = (id, value) => {
    setNodes(prev => prev.map(n => (n.id === id ? { ...n, value } : n)));
  };

  const saveFlow = async () => {
    const err = validateAction(); if (err) return toast.warning(err);
    const visualPayload = { version: 2, metadata: { flowName, keywords }, actionDefaults: { newType, replyMessage, webhookUrl, webhookMethod, webhookPayload, kanbanColumn }, nodes, edges, updatedAt: new Date().toISOString() };
    const actionValue = newType === "message" ? replyMessage : newType === "webhook" ? JSON.stringify({ url: webhookUrl, method: webhookMethod, payload: webhookPayload }) : newType === "kanban" ? kanbanColumn : "";
    try { await api.post("/flows", { name: flowName, triggerType: "message_received", containsText: keywords, actionType: newType, actionValue, isActive: true, visualPayload }); toast.success("Fluxo salvo no backend com sucesso"); loadFlows(); }
    catch { localStorage.setItem("flowbuilder.visual.v2", JSON.stringify(visualPayload)); toast.warning("Backend indisponível. Salvo localmente para teste."); }
  };

  return (
    <div className={classes.root}>
      <Paper className={classes.panel} elevation={0}>
        <Grid container spacing={1} alignItems="center">
          <Grid item xs={12} md={4}><TextField fullWidth label="Nome do fluxo" variant="outlined" size="small" value={flowName} onChange={e => setFlowName(e.target.value)} /></Grid>
          <Grid item xs={12} md={5}><TextField fullWidth label="Palavras-chave" variant="outlined" size="small" value={keywords} onChange={e => setKeywords(e.target.value)} /></Grid>
          <Grid item xs={12} md={3}><TextField select fullWidth label="Ação" value={newType} onChange={e => setNewType(e.target.value)} variant="outlined" size="small">{nodeTypes.map(t => <MenuItem key={t.value} value={t.value}>{t.label}</MenuItem>)}</TextField></Grid>
          <Grid item><Button variant="contained" color="primary" startIcon={<Add />} onClick={addNode}>Adicionar</Button></Grid>
          <Grid item><Button variant="outlined" onClick={addConnection}>Conectar</Button></Grid>
          {linkingFrom && <Grid item><Chip size="small" label={`Conectando: ${linkingFrom} (clique na entrada ou no bloco destino (Esc cancela))`} onDelete={() => { setLinkingFrom(null); setLinkPointer(null); setHoverTarget(null); setIsLinkMode(false); }} /></Grid>}
          <Grid item><Button variant="outlined" startIcon={<Visibility />} onClick={() => setReviewOpen(v => !v)}>Revisão</Button></Grid>
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              label="Editar mensagem do bloco selecionado"
              variant="outlined"
              size="small"
              value={(byId[selectedNodeId] && byId[selectedNodeId].value) || ""}
              onChange={e => updateNodeValue(selectedNodeId, e.target.value)}
              disabled={!selectedNodeId || !byId[selectedNodeId]}
            />
          </Grid>
          <Grid item><Button variant="contained" style={{ background: "#8d3cff", color: "#fff" }} startIcon={<Save />} onClick={saveFlow}>Salvar</Button></Grid>
        </Grid>
        {reviewOpen && <div className={classes.review}><Typography variant="body2">SE mensagem contém: {keywords || "(não informado)"}</Typography></div>}
      </Paper>

      <div className={maximized ? classes.fullscreen : ""}>
        <div className={classes.toolbar}>
          <div className={classes.navGroup}>
            <Button size="small" variant="outlined" onClick={() => scrollCanvas(-240, 0)}>◀</Button>
            <Button size="small" variant="outlined" onClick={() => scrollCanvas(240, 0)}>▶</Button>
            <Button size="small" variant="outlined" onClick={() => scrollCanvas(0, -180)}>▲</Button>
            <Button size="small" variant="outlined" onClick={() => scrollCanvas(0, 180)}>▼</Button>
            <Button size="small" variant="outlined" onClick={() => setZoom(z => Math.max(0.6, z - 0.1))}>-</Button>
            <Chip size="small" label={`${Math.round(zoom * 100)}%`} />
            <Button size="small" variant="outlined" onClick={() => setZoom(z => Math.min(1.8, z + 0.1))}>+</Button>
          </div>
          <Button size="small" variant="contained" onClick={() => setMaximized(v => !v)}>{maximized ? "Restaurar" : "Maximizar"}</Button>
        </div>

        <div className={classes.canvasShell}>
          <div className={classes.topBar} />
          <Button className={classes.miniSave} variant="contained" style={{ background: "#2e7d32", color: "#fff" }} onClick={saveFlow}>SALVAR</Button>
          <div className={classes.stencil}>
            {stencilItems.map((i, idx) => (
              <div key={i} className={classes.stencilItem}>
                <div className={classes.stencilDot}>{idx + 1}</div>
                <div className={classes.stencilLabel}>{i}</div>
              </div>
            ))}
          </div>

          <div className={classes.canvasWrap} ref={canvasRef} style={maximized ? { maxHeight: "calc(100vh - 80px)" } : {}}>
            <div className={classes.canvas} style={{ transform: `scale(${zoom})` }}>
              <svg className={classes.svg}>
                {validEdges.map((edge, idx) => {
                  const from = byId[edge.from];
                  const to = byId[edge.to];
                  const x1 = from.x + 170; const y1 = from.y + 28;
                  const x2 = to.x; const y2 = to.y + 28;
                  const mx = (x1 + x2) / 2;
                  return <path key={`${edge.from}-${edge.to}-${idx}`} d={`M ${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}`} stroke="#7f8faa" strokeWidth="1.7" fill="none" />;
                })}
                {linkingFrom && byId[linkingFrom] && linkPointer && (() => {
                  const from = byId[linkingFrom];
                  const x1 = from.x + 170; const y1 = from.y + 28;
                  const x2 = linkPointer.x; const y2 = linkPointer.y;
                  const mx = (x1 + x2) / 2;
                  return <path d={`M ${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}`} stroke="#2e7d32" strokeWidth="2" strokeDasharray="6 4" fill="none" />;
                })()}
              </svg>
              {nodes.map(node => (
                <div
                  key={node.id}
                  className={classes.node}
                  style={{ left: node.x, top: node.y, borderColor: selectedNodeId === node.id ? "#2e7d32" : "#d6dbe6" }}
                  onMouseDown={e => onNodeMouseDown(node.id, e)}
                  onClick={() => {
                    setSelectedNodeId(node.id);
                    if (linkingFrom) finishLinkTo(node.id);
                  }}
                >
                  <div
                    className={classes.nodeHandle}
                    style={{ left: -6, top: "50%", transform: "translateY(-50%)", background: "#4f6b95", boxShadow: "0 0 0 1px #9eb3d1" }}
                    onMouseDown={e => onFinishLink(node.id, e)}
                    title="Entrada"
                  />
                  <div
                    className={classes.nodeHandle}
                    style={{ right: -6, top: "50%", transform: "translateY(-50%)" }}
                    onMouseDown={e => onStartLink(node.id, e)}
                    title="Saída"
                  />
                  <div className={classes.nodeTitle}>{node.label}</div>
                  <div className={classes.nodeBody}>{node.value}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <Paper className={classes.panel} elevation={0}><Typography variant="subtitle2">Fluxos salvos: {savedFlows.length}</Typography></Paper>
    </div>
  );
}
