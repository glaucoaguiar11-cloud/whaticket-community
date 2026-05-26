import React, { useEffect, useMemo, useState } from "react";
import ReactFlow, { Background, Controls, MiniMap, Handle, Position } from "react-flow-renderer";
import { Button, Grid, IconButton, MenuItem, Paper, Table, TableBody, TableCell, TableHead, TableRow, TextField, Typography, makeStyles } from "@material-ui/core";
import { Add, ArrowBack, Delete, Edit, Save, Visibility } from "@material-ui/icons";
import { toast } from "react-toastify";
import api from "../../services/api";

const useStyles = makeStyles(theme => ({
  root: { display: "grid", gap: theme.spacing(1.5) },
  panel: { padding: theme.spacing(1.5), borderRadius: 10, border: "1px solid #e4e7ec", background: "#fff" },
  flowShell: { height: 680, border: "1px solid #d7dbe5", borderRadius: 10, overflow: "hidden" },
  topBar: { height: 8, background: "#2e7d32" },
  review: { marginTop: theme.spacing(1), padding: theme.spacing(1), border: "1px dashed #c8ced9", borderRadius: 8, background: "#fbfcfe" },
  editorPanel: { height: 680, border: "1px solid #d7dbe5", borderRadius: 10, background: "#fff", padding: 12, overflow: "auto" },
  editorTitle: { fontWeight: 700, marginBottom: 10, color: "#334155" },
  editorSection: { marginTop: 10 },
  rowClickable: { cursor: "pointer" }
}));

const nodeTypes = [
  { value: "message", label: "Exibir mensagem" },
  { value: "webhook", label: "Webhook (n8n)" },
  { value: "kanban", label: "Mover Kanban" },
  { value: "condition", label: "Condição" },
  { value: "menu", label: "Menu" }
];

const typeMeta = {
  start: { icon: "🏁", color: "#475569", bg: "#f1f5f9" },
  message: { icon: "💬", color: "#2563eb", bg: "#eff6ff" },
  webhook: { icon: "🔗", color: "#7c3aed", bg: "#f5f3ff" },
  kanban: { icon: "📌", color: "#0f766e", bg: "#f0fdfa" },
  condition: { icon: "🔀", color: "#b45309", bg: "#fffbeb" },
  menu: { icon: "📋", color: "#1d4ed8", bg: "#eff6ff" }
};

const defaultNodes = [
  { id: "start", type: "start", label: "Início", value: "Mensagem recebida", x: 120, y: 180, config: {} },
  { id: "n1", type: "message", label: "Exibir mensagem", value: "Olá! Como posso ajudar?", x: 380, y: 180, config: {} }
];

const defaultEdges = [{ from: "start", to: "n1" }];

const FlowNode = ({ data }) => {
  const meta = typeMeta[data.type] || { icon: "🧩", color: "#334155", bg: "#f8fafc" };
  return (
    <div style={{ borderRadius: 12, border: `1px solid ${data.selected ? "#2e7d32" : "#d6dbe6"}`, boxShadow: data.selected ? "0 0 0 3px rgba(46,125,50,.15), 0 8px 18px rgba(15,23,42,.12)" : "0 4px 12px rgba(15,23,42,.08)", width: 220, fontSize: 11, background: "#fff", overflow: "hidden" }}>
      <Handle type="target" position={Position.Left} style={{ width: 14, height: 14, background: "#4f6b95", border: "2px solid #fff", boxShadow: "0 0 0 2px rgba(79,107,149,.25)" }} />
      <div style={{ padding: "6px 8px", display: "flex", alignItems: "center", justifyContent: "space-between", background: meta.bg, borderBottom: "1px solid #e2e8f0" }}>
        <span style={{ fontWeight: 700, color: meta.color }}>{meta.icon} {data.title}</span>
        <span style={{ fontSize: 10, color: "#64748b" }}>{data.type}</span>
      </div>
      <div style={{ padding: "8px 10px", color: "#334155", whiteSpace: "pre-line", minHeight: 44 }}>{data.value || "(sem conteúdo)"}</div>
      <Handle type="source" position={Position.Right} style={{ width: 14, height: 14, background: "#2e7d32", border: "2px solid #fff", boxShadow: "0 0 0 2px rgba(46,125,50,.25)" }} />
    </div>
  );
};

const toFlowElements = (nodes, edges, selectedNodeId) => ([
  ...nodes.map(n => ({ id: n.id, type: "flowNode", position: { x: n.x || 120, y: n.y || 120 }, data: { title: n.label, value: n.value || "", type: n.type, selected: n.id === selectedNodeId } })),
  ...edges.map((e, idx) => ({ id: `e-${e.from}-${e.to}-${idx}`, source: e.from, target: e.to, animated: true, style: { stroke: "#64748b", strokeWidth: 2 }, markerEnd: { type: "arrowclosed", color: "#64748b" } }))
]);

export default function FlowBuilder() {
  const classes = useStyles();
  const [mode, setMode] = useState("list");
  const [search, setSearch] = useState("");
  const [editingFlowId, setEditingFlowId] = useState(null);
  const [flowName, setFlowName] = useState("Novo fluxo");
  const [keywords, setKeywords] = useState("");
  const [newType, setNewType] = useState("message");
  const [replyMessage, setReplyMessage] = useState("Olá! Como posso ajudar?");
  const [reviewOpen, setReviewOpen] = useState(false);
  const [savedFlows, setSavedFlows] = useState([]);
  const [nodes, setNodes] = useState(defaultNodes);
  const [edges, setEdges] = useState(defaultEdges);
  const [selectedNodeId, setSelectedNodeId] = useState("n1");

  const byId = useMemo(() => Object.fromEntries(nodes.map(n => [n.id, n])), [nodes]);
  const selectedNode = byId[selectedNodeId];
  const elements = useMemo(() => toFlowElements(nodes, edges, selectedNodeId), [nodes, edges, selectedNodeId]);
  const rfNodeTypes = useMemo(() => ({ flowNode: FlowNode }), []);

  const loadFlows = async () => {
    try { const { data } = await api.get("/flows"); setSavedFlows(Array.isArray(data) ? data : []); }
    catch { toast.warning("Não foi possível carregar os fluxos salvos"); }
  };

  useEffect(() => { loadFlows(); }, []);

  const openEditorForFlow = flow => {
    const payload = flow.visualPayload || {};
    setEditingFlowId(flow.id || null);
    setFlowName(flow.name || "Novo fluxo");
    setKeywords(flow.containsText || payload?.metadata?.keywords || "");
    setNodes(Array.isArray(payload.nodes) && payload.nodes.length ? payload.nodes : defaultNodes);
    setEdges(Array.isArray(payload.edges) && payload.edges.length ? payload.edges : defaultEdges);
    setSelectedNodeId((Array.isArray(payload.nodes) && payload.nodes[1]?.id) || "n1");
    setMode("editor");
  };

  const createFlow = () => {
    setEditingFlowId(null);
    setFlowName("Novo fluxo");
    setKeywords("");
    setReplyMessage("Olá! Como posso ajudar?");
    setNewType("message");
    setNodes(defaultNodes);
    setEdges(defaultEdges);
    setSelectedNodeId("n1");
    setMode("editor");
  };

  const deleteFlow = async flow => {
    if (!window.confirm(`Excluir fluxo \"${flow.name}\"?`)) return;
    try { await api.delete(`/flows/${flow.id}`); toast.success("Fluxo excluído"); loadFlows(); }
    catch { toast.error("Falha ao excluir fluxo"); }
  };

  const filteredFlows = savedFlows.filter(f => `${f.id} ${f.name || ""}`.toLowerCase().includes(search.toLowerCase()));

  const addNode = () => {
    if (!flowName.trim() || !keywords.trim()) return toast.warning("Preencha nome e palavras-chave");
    const id = `n${Date.now()}`;
    const label = nodeTypes.find(t => t.value === newType)?.label || "Bloco";
    const value = newType === "message" ? replyMessage : "Configurar...";
    setNodes(prev => [...prev, { id, type: newType, label, value, x: 620, y: 120 + (prev.length % 6) * 90, config: {} }]);
    setSelectedNodeId(id);
  };

  const updateNode = patch => setNodes(prev => prev.map(n => (n.id === selectedNodeId ? { ...n, ...patch } : n)));
  const updateNodeConfig = (key, value) => setNodes(prev => prev.map(n => (n.id === selectedNodeId ? { ...n, config: { ...(n.config || {}), [key]: value } } : n)));
  const onConnect = p => setEdges(prev => prev.find(e => e.from === p.source && e.to === p.target) ? prev : [...prev, { from: p.source, to: p.target }]);
  const onNodeDragStop = (_e, node) => setNodes(prev => prev.map(n => (n.id === node.id ? { ...n, x: node.position.x, y: node.position.y } : n)));

  const saveFlow = async () => {
    const visualPayload = { version: 4, metadata: { flowName, keywords }, nodes, edges, updatedAt: new Date().toISOString() };
    const payload = { name: flowName, triggerType: "message_received", containsText: keywords, actionType: newType, actionValue: replyMessage, isActive: true, visualPayload };
    try {
      if (editingFlowId) await api.put(`/flows/${editingFlowId}`, payload);
      else await api.post("/flows", payload);
      toast.success("Fluxo salvo no backend");
      setMode("list");
      await loadFlows();
    } catch {
      localStorage.setItem("flowbuilder.visual.v4", JSON.stringify(visualPayload));
      toast.warning("Salvo localmente para teste");
    }
  };

  if (mode === "list") {
    return (
      <div className={classes.root}>
        <Paper className={classes.panel} elevation={0}>
          <Grid container spacing={1} alignItems="center">
            <Grid item xs={12} md={5}><TextField fullWidth label="Buscar fluxo" variant="outlined" size="small" value={search} onChange={e => setSearch(e.target.value)} /></Grid>
            <Grid item><Button variant="contained" color="primary" startIcon={<Add />} onClick={createFlow}>Adicionar projeto</Button></Grid>
          </Grid>
        </Paper>

        <Paper className={classes.panel} elevation={0}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>ID</TableCell>
                <TableCell>Nome</TableCell>
                <TableCell align="right">Ações</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredFlows.map(flow => (
                <TableRow key={flow.id} hover className={classes.rowClickable} onClick={() => openEditorForFlow(flow)}>
                  <TableCell>{flow.id}</TableCell>
                  <TableCell>{flow.name || "(sem nome)"}</TableCell>
                  <TableCell align="right" onClick={e => e.stopPropagation()}>
                    <IconButton size="small" onClick={() => openEditorForFlow(flow)}><Edit fontSize="small" /></IconButton>
                    <IconButton size="small" onClick={() => deleteFlow(flow)}><Delete fontSize="small" /></IconButton>
                  </TableCell>
                </TableRow>
              ))}
              {!filteredFlows.length && <TableRow><TableCell colSpan={3}>Nenhum fluxo encontrado.</TableCell></TableRow>}
            </TableBody>
          </Table>
        </Paper>
      </div>
    );
  }

  return (
    <div className={classes.root}>
      <Paper className={classes.panel} elevation={0}>
        <Grid container spacing={1} alignItems="center">
          <Grid item><Button variant="outlined" startIcon={<ArrowBack />} onClick={() => setMode("list")}>Voltar</Button></Grid>
          <Grid item xs={12} md={3}><TextField fullWidth label="Nome do fluxo" variant="outlined" size="small" value={flowName} onChange={e => setFlowName(e.target.value)} /></Grid>
          <Grid item xs={12} md={4}><TextField fullWidth label="Palavras-chave" variant="outlined" size="small" value={keywords} onChange={e => setKeywords(e.target.value)} /></Grid>
          <Grid item xs={12} md={3}><TextField select fullWidth label="Ação" value={newType} onChange={e => setNewType(e.target.value)} variant="outlined" size="small">{nodeTypes.map(t => <MenuItem key={t.value} value={t.value}>{t.label}</MenuItem>)}</TextField></Grid>
          <Grid item><Button variant="contained" color="primary" startIcon={<Add />} onClick={addNode}>Adicionar</Button></Grid>
          <Grid item><Button variant="outlined" startIcon={<Visibility />} onClick={() => setReviewOpen(v => !v)}>Revisão</Button></Grid>
          <Grid item><Button variant="contained" style={{ background: "#2e7d32", color: "#fff" }} startIcon={<Save />} onClick={saveFlow}>Salvar</Button></Grid>
        </Grid>
        {reviewOpen && <div className={classes.review}><Typography variant="body2">SE mensagem contém: {keywords || "(não informado)"}</Typography></div>}
      </Paper>

      <Grid container spacing={2}>
        <Grid item xs={12} md={8}>
          <div className={classes.flowShell}><div className={classes.topBar} /><ReactFlow elements={elements} nodeTypes={rfNodeTypes} onConnect={onConnect} deleteKeyCode={46} onNodeDragStop={onNodeDragStop} onElementClick={(_e, el) => { if (!el.source && !el.target) setSelectedNodeId(el.id); }} snapToGrid snapGrid={[10, 10]} connectionLineStyle={{ stroke: "#2e7d32", strokeWidth: 2 }}><MiniMap /><Controls /><Background color="#dce1e9" gap={22} /></ReactFlow></div>
        </Grid>
        <Grid item xs={12} md={4}>
          <div className={classes.editorPanel}><Typography className={classes.editorTitle}>Propriedades do Bloco</Typography>{selectedNode ? <><TextField fullWidth label="Título" variant="outlined" size="small" value={selectedNode.label || ""} onChange={e => updateNode({ label: e.target.value })} /><div className={classes.editorSection}><TextField fullWidth label="Tipo" variant="outlined" size="small" value={selectedNode.type || ""} disabled /></div>{(selectedNode.type === "message" || selectedNode.type === "start") && <div className={classes.editorSection}><TextField fullWidth multiline minRows={5} label="Mensagem" variant="outlined" value={selectedNode.value || ""} onChange={e => updateNode({ value: e.target.value })} /></div>}</> : <Typography variant="body2">Selecione um bloco para editar.</Typography>}</div>
        </Grid>
      </Grid>
    </div>
  );
}
