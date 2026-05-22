import React, { useMemo, useState } from "react";
import {
  Button,
  Chip,
  Grid,
  MenuItem,
  Paper,
  TextField,
  Typography,
  makeStyles
} from "@material-ui/core";
import { Add, Save } from "@material-ui/icons";
import { toast } from "react-toastify";

const useStyles = makeStyles(theme => ({
  root: { display: "grid", gap: theme.spacing(2) },
  hero: {
    padding: theme.spacing(2),
    borderRadius: 12,
    border: "1px solid #b7dfb9",
    background: "linear-gradient(135deg, #f1fbf2 0%, #e4f6e6 100%)"
  },
  panel: {
    padding: theme.spacing(2),
    borderRadius: 12,
    border: "1px solid #c6e7c9",
    background: "#fcfffc"
  },
  canvasWrap: {
    position: "relative",
    minHeight: 520,
    borderRadius: 12,
    border: "1px solid #c6e7c9",
    background: "#f8fdf8",
    overflow: "hidden"
  },
  canvas: { position: "relative", width: "100%", height: 520 },
  node: {
    position: "absolute",
    minWidth: 180,
    background: "#fff",
    border: "1px solid #b7dfb9",
    borderRadius: 10,
    boxShadow: "0 4px 12px rgba(0,0,0,.06)",
    padding: 10,
    cursor: "move"
  },
  nodeTitle: { fontWeight: 700, fontSize: 13 },
  nodeBody: { fontSize: 12, opacity: 0.8, marginTop: 4 },
  svg: { position: "absolute", inset: 0, pointerEvents: "none" }
}));

const nodeTypes = [
  { value: "message", label: "Mensagem" },
  { value: "menu", label: "Menu" },
  { value: "condition", label: "Condição" },
  { value: "webhook", label: "Webhook" },
  { value: "kanban", label: "Mover Kanban" }
];

const initialNodes = [
  { id: "start", type: "start", label: "Início do fluxo", value: "Entrada", x: 80, y: 210 },
  { id: "n1", type: "message", label: "Mensagem", value: "Olá, em que posso ajudar?", x: 340, y: 120 },
  { id: "n2", type: "menu", label: "Menu", value: "1-Financeiro | 2-Suporte", x: 340, y: 300 }
];

const initialEdges = [
  { from: "start", to: "n1" },
  { from: "n1", to: "n2" }
];

const FlowBuilder = () => {
  const classes = useStyles();
  const [nodes, setNodes] = useState(initialNodes);
  const [edges, setEdges] = useState(initialEdges);
  const [newType, setNewType] = useState("message");
  const [selectedFrom, setSelectedFrom] = useState("start");
  const [selectedTo, setSelectedTo] = useState("n1");

  const byId = useMemo(() => Object.fromEntries(nodes.map(n => [n.id, n])), [nodes]);

  const addNode = () => {
    const id = `n${Date.now()}`;
    const typeLabel = nodeTypes.find(t => t.value === newType)?.label || "Bloco";
    setNodes(prev => [
      ...prev,
      {
        id,
        type: newType,
        label: typeLabel,
        value: "Configurar...",
        x: 620,
        y: 120 + (prev.length % 5) * 80
      }
    ]);
    toast.success("Bloco adicionado ao fluxo");
  };

  const addConnection = () => {
    if (!selectedFrom || !selectedTo || selectedFrom === selectedTo) {
      toast.warning("Selecione origem e destino válidos");
      return;
    }
    setEdges(prev => [...prev, { from: selectedFrom, to: selectedTo }]);
  };

  const onDrag = (id, e) => {
    const x = e.clientX - 220;
    const y = e.clientY - 180;
    setNodes(prev => prev.map(n => (n.id === id ? { ...n, x, y } : n)));
  };

  const saveFlow = () => {
    const payload = { version: 1, nodes, edges, updatedAt: new Date().toISOString() };
    localStorage.setItem("flowbuilder.visual.v1", JSON.stringify(payload));
    toast.success("Fluxo visual salvo (V1)");
  };

  return (
    <div className={classes.root}>
      <Paper className={classes.hero} elevation={0}>
        <Typography variant="h6">FlowBuilder Visual (V1)</Typography>
        <Typography style={{ opacity: 0.8 }}>
          Editor visual com blocos e conexões no estilo arrasta-e-solta. Próximo passo: persistência completa no backend.
        </Typography>
        <div style={{ marginTop: 8, display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Chip label={`${nodes.length} blocos`} />
          <Chip label={`${edges.length} conexões`} style={{ background: "#43a047", color: "#fff" }} />
        </div>
      </Paper>

      <Paper className={classes.panel} elevation={0}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} md={3}>
            <TextField select fullWidth label="Novo bloco" value={newType} onChange={e => setNewType(e.target.value)} variant="outlined" size="small">
              {nodeTypes.map(t => <MenuItem key={t.value} value={t.value}>{t.label}</MenuItem>)}
            </TextField>
          </Grid>
          <Grid item>
            <Button variant="contained" color="primary" startIcon={<Add />} onClick={addNode}>Adicionar bloco</Button>
          </Grid>

          <Grid item xs={12} md={3}>
            <TextField select fullWidth label="Conectar de" value={selectedFrom} onChange={e => setSelectedFrom(e.target.value)} variant="outlined" size="small">
              {nodes.map(n => <MenuItem key={n.id} value={n.id}>{n.label} ({n.id})</MenuItem>)}
            </TextField>
          </Grid>
          <Grid item xs={12} md={3}>
            <TextField select fullWidth label="Para" value={selectedTo} onChange={e => setSelectedTo(e.target.value)} variant="outlined" size="small">
              {nodes.map(n => <MenuItem key={n.id} value={n.id}>{n.label} ({n.id})</MenuItem>)}
            </TextField>
          </Grid>
          <Grid item>
            <Button variant="outlined" onClick={addConnection}>Conectar</Button>
          </Grid>
          <Grid item>
            <Button variant="contained" style={{ background: "#2e7d32", color: "#fff" }} startIcon={<Save />} onClick={saveFlow}>Salvar fluxo</Button>
          </Grid>
        </Grid>
      </Paper>

      <div className={classes.canvasWrap}>
        <div className={classes.canvas}>
          <svg className={classes.svg}>
            {edges.map((edge, idx) => {
              const from = byId[edge.from];
              const to = byId[edge.to];
              if (!from || !to) return null;
              const x1 = from.x + 180;
              const y1 = from.y + 34;
              const x2 = to.x;
              const y2 = to.y + 34;
              const mx = (x1 + x2) / 2;

              return (
                <path
                  key={`${edge.from}-${edge.to}-${idx}`}
                  d={`M ${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}`}
                  stroke="#4caf50"
                  strokeWidth="2"
                  fill="none"
                />
              );
            })}
          </svg>

          {nodes.map(node => (
            <div
              key={node.id}
              className={classes.node}
              style={{ left: node.x, top: node.y }}
              draggable
              onDrag={e => onDrag(node.id, e)}
            >
              <div className={classes.nodeTitle}>{node.label}</div>
              <div className={classes.nodeBody}>{node.value}</div>
              <Chip size="small" label={node.type} style={{ marginTop: 8 }} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default FlowBuilder;
