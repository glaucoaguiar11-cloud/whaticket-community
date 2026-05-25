import React, { useEffect, useMemo, useState } from "react";
import ReactFlow, { addEdge, Background, Controls, MiniMap, removeElements } from "react-flow-renderer";
import { Button, Chip, Grid, MenuItem, Paper, TextField, Typography, makeStyles } from "@material-ui/core";
import { Add, Save, Visibility } from "@material-ui/icons";
import { toast } from "react-toastify";
import api from "../../services/api";

const useStyles = makeStyles(theme => ({
  root: { display: "grid", gap: theme.spacing(1.5) },
  panel: { padding: theme.spacing(1.5), borderRadius: 10, border: "1px solid #e4e7ec", background: "#fff" },
  flowShell: { height: 640, border: "1px solid #d7dbe5", borderRadius: 10, overflow: "hidden" },
  topBar: { height: 8, background: "#2e7d32" },
  review: { marginTop: theme.spacing(1), padding: theme.spacing(1), border: "1px dashed #c8ced9", borderRadius: 8, background: "#fbfcfe" }
}));

const nodeTypes = [
  { value: "message", label: "Exibir mensagem" },
  { value: "webhook", label: "Webhook (n8n)" },
  { value: "kanban", label: "Mover Kanban" },
  { value: "condition", label: "Condição" },
  { value: "menu", label: "Menu" }
];

const toFlowElements = (nodes, edges) => ([
  ...nodes.map(n => ({
    id: n.id,
    type: "default",
    position: { x: n.x || 120, y: n.y || 120 },
    data: { label: `${n.label}\n${n.value || ""}` },
    style: { borderRadius: 8, border: "1px solid #d6dbe6", padding: 8, width: 180, fontSize: 11, whiteSpace: "pre-line" }
  })),
  ...edges.map((e, idx) => ({ id: `e-${e.from}-${e.to}-${idx}`, source: e.from, target: e.to, animated: false, style: { stroke: "#6e7f9e", strokeWidth: 1.7 } }))
]);

export default function FlowBuilder() {
  const classes = useStyles();

  const [flowName, setFlowName] = useState("Novo fluxo");
  const [keywords, setKeywords] = useState("");
  const [newType, setNewType] = useState("message");
  const [replyMessage, setReplyMessage] = useState("Olá! Como posso ajudar?");
  const [webhookUrl, setWebhookUrl] = useState("");
  const [webhookMethod, setWebhookMethod] = useState("POST");
  const [webhookPayload, setWebhookPayload] = useState('{"ticketId":"{{ticket.id}}","message":"{{message.body}}"}');
  const [kanbanColumn, setKanbanColumn] = useState("");
  const [reviewOpen, setReviewOpen] = useState(false);
  const [savedFlows, setSavedFlows] = useState([]);

  const [nodes, setNodes] = useState([
    { id: "start", type: "start", label: "Início", value: "Mensagem recebida", x: 120, y: 180 },
    { id: "n1", type: "message", label: "Exibir mensagem", value: "Olá! Como posso ajudar?", x: 380, y: 180 }
  ]);
  const [edges, setEdges] = useState([{ from: "start", to: "n1" }]);
  const [selectedNodeId, setSelectedNodeId] = useState("n1");

  const byId = useMemo(() => Object.fromEntries(nodes.map(n => [n.id, n])), [nodes]);
  const elements = useMemo(() => toFlowElements(nodes, edges), [nodes, edges]);

  const loadFlows = async () => {
    try { const { data } = await api.get("/flows"); setSavedFlows(Array.isArray(data) ? data : []); }
    catch { toast.warning("Não foi possível carregar os fluxos salvos"); }
  };

  useEffect(() => { loadFlows(); }, []);

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
    const label = nodeTypes.find(t => t.value === newType)?.label || "Bloco";
    const value = newType === "message" ? replyMessage : newType === "webhook" ? `${webhookMethod} ${webhookUrl || "URL pendente"}` : newType === "kanban" ? `Mover para: ${kanbanColumn || "coluna pendente"}` : "Configurar...";
    setNodes(prev => [...prev, { id, type: newType, label, value, x: 620, y: 120 + (prev.length % 6) * 90 }]);
    setSelectedNodeId(id);
  };

  const onConnect = params => {
    setEdges(prev => {
      if (prev.find(e => e.from === params.source && e.to === params.target)) return prev;
      return [...prev, { from: params.source, to: params.target }];
    });
  };

  const onElementsRemove = elementsToRemove => {
    const ids = new Set(elementsToRemove.map(el => el.id));
    setNodes(prev => prev.filter(n => !ids.has(n.id)));
    setEdges(prev => prev.filter(e => !ids.has(`e-${e.from}-${e.to}-0`) && !ids.has(e.from) && !ids.has(e.to)));
  };

  const onNodeDragStop = (_e, node) => {
    setNodes(prev => prev.map(n => (n.id === node.id ? { ...n, x: node.position.x, y: node.position.y } : n)));
  };

  const updateNodeValue = (id, value) => {
    setNodes(prev => prev.map(n => (n.id === id ? { ...n, value } : n)));
  };

  const saveFlow = async () => {
    const err = validateAction(); if (err) return toast.warning(err);
    const visualPayload = { version: 3, metadata: { flowName, keywords }, actionDefaults: { newType, replyMessage, webhookUrl, webhookMethod, webhookPayload, kanbanColumn }, nodes, edges, updatedAt: new Date().toISOString() };
    const actionValue = newType === "message" ? replyMessage : newType === "webhook" ? JSON.stringify({ url: webhookUrl, method: webhookMethod, payload: webhookPayload }) : newType === "kanban" ? kanbanColumn : "";
    try { await api.post("/flows", { name: flowName, triggerType: "message_received", containsText: keywords, actionType: newType, actionValue, isActive: true, visualPayload }); toast.success("Fluxo salvo no backend com sucesso"); loadFlows(); }
    catch { localStorage.setItem("flowbuilder.visual.v3", JSON.stringify(visualPayload)); toast.warning("Backend indisponível. Salvo localmente para teste."); }
  };

  return (
    <div className={classes.root}>
      <Paper className={classes.panel} elevation={0}>
        <Grid container spacing={1} alignItems="center">
          <Grid item xs={12} md={4}><TextField fullWidth label="Nome do fluxo" variant="outlined" size="small" value={flowName} onChange={e => setFlowName(e.target.value)} /></Grid>
          <Grid item xs={12} md={5}><TextField fullWidth label="Palavras-chave" variant="outlined" size="small" value={keywords} onChange={e => setKeywords(e.target.value)} /></Grid>
          <Grid item xs={12} md={3}><TextField select fullWidth label="Ação" value={newType} onChange={e => setNewType(e.target.value)} variant="outlined" size="small">{nodeTypes.map(t => <MenuItem key={t.value} value={t.value}>{t.label}</MenuItem>)}</TextField></Grid>
          <Grid item><Button variant="contained" color="primary" startIcon={<Add />} onClick={addNode}>Adicionar</Button></Grid>
          <Grid item><Button variant="outlined" startIcon={<Visibility />} onClick={() => setReviewOpen(v => !v)}>Revisão</Button></Grid>
          <Grid item><Button variant="contained" style={{ background: "#2e7d32", color: "#fff" }} startIcon={<Save />} onClick={saveFlow}>Salvar</Button></Grid>
          <Grid item xs={12} md={6}>
            <TextField fullWidth label="Editar mensagem do bloco selecionado" variant="outlined" size="small" value={(byId[selectedNodeId] && byId[selectedNodeId].value) || ""} onChange={e => updateNodeValue(selectedNodeId, e.target.value)} disabled={!selectedNodeId || !byId[selectedNodeId]} />
          </Grid>
        </Grid>
        {reviewOpen && <div className={classes.review}><Typography variant="body2">SE mensagem contém: {keywords || "(não informado)"}</Typography></div>}
      </Paper>

      <div className={classes.flowShell}>
        <div className={classes.topBar} />
        <ReactFlow
          elements={elements}
          onConnect={onConnect}
          onElementsRemove={onElementsRemove}
          deleteKeyCode={46}
          onNodeDragStop={onNodeDragStop}
          onElementClick={(_e, el) => { if (el.source || el.target) return; setSelectedNodeId(el.id); }}
          snapToGrid
          snapGrid={[10, 10]}
          connectionLineStyle={{ stroke: "#2e7d32", strokeWidth: 2 }}
        >
          <MiniMap />
          <Controls />
          <Background color="#dce1e9" gap={22} />
        </ReactFlow>
      </div>

      <Paper className={classes.panel} elevation={0}><Typography variant="subtitle2">Fluxos salvos: {savedFlows.length}</Typography></Paper>
    </div>
  );
}
