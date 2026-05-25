import React, { useEffect, useMemo, useRef, useState } from "react";
import { Button, Chip, Grid, MenuItem, Paper, TextField, Typography, makeStyles } from "@material-ui/core";
import { Add, Save, Visibility } from "@material-ui/icons";
import { toast } from "react-toastify";
import api from "../../services/api";

const useStyles = makeStyles(theme => ({
  root: { display: "grid", gap: theme.spacing(1.5) },
  panel: { padding: theme.spacing(1.5), borderRadius: 10, border: "1px solid #e4e7ec", background: "#fff" },
  canvasShell: { position: "relative", borderRadius: 10, overflow: "hidden", border: "1px solid #d7dbe5" },
  topBar: { height: 8, background: "#8d3cff" },
  canvasWrap: { position: "relative", minHeight: 560, maxHeight: 680, background: "#f2f4f7", overflow: "auto" },
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
    gap: 7,
    background: "rgba(255,255,255,.7)",
    borderRadius: 999,
    padding: 6
  },
  stencilItem: { display: "flex", alignItems: "center", gap: 8 },
  stencilDot: {
    width: 24,
    height: 24,
    borderRadius: "50%",
    display: "grid",
    placeItems: "center",
    fontSize: 11,
    color: "#243244",
    background: "#fff",
    border: "1px solid #d6dbe6",
    boxShadow: "0 1px 4px rgba(0,0,0,.08)"
  },
  stencilLabel: {
    fontSize: 10,
    background: "#fff",
    border: "1px solid #dde2ec",
    borderRadius: 6,
    padding: "2px 6px",
    color: "#6a7385"
  },
  miniSave: { position: "absolute", right: 8, top: 14, zIndex: 4, minWidth: 70, height: 24, fontSize: 10 }
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
    const onKeyDown = e => { if (e.key === "Escape") setMaximized(false); };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => { setEdges(prev => prev.filter(e => byId[e.from] && byId[e.to])); }, [byId]);

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

  const onDrag = (id, e) => {
    if (!e.clientX || !e.clientY) return;
    setNodes(prev => prev.map(n => (n.id === id ? { ...n, x: Math.max(30, e.clientX - 240), y: Math.max(40, e.clientY - 150) } : n)));
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
          <Grid item><Button variant="outlined" startIcon={<Visibility />} onClick={() => setReviewOpen(v => !v)}>Revisão</Button></Grid>
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
          <Button className={classes.miniSave} variant="contained" style={{ background: "#8d3cff", color: "#fff" }} onClick={saveFlow}>SALVAR</Button>
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
              </svg>
              {nodes.map(node => (
                <div key={node.id} className={classes.node} style={{ left: node.x, top: node.y }} draggable onDrag={e => onDrag(node.id, e)}>
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
