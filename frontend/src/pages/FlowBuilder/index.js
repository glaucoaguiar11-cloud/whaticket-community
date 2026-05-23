import React, { useEffect, useMemo, useState } from "react";
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
import { Add, Save, Visibility } from "@material-ui/icons";
import { toast } from "react-toastify";
import api from "../../services/api";

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
    minWidth: 220,
    background: "#fff",
    border: "1px solid #b7dfb9",
    borderRadius: 10,
    boxShadow: "0 4px 12px rgba(0,0,0,.06)",
    padding: 10,
    cursor: "move"
  },
  nodeTitle: { fontWeight: 700, fontSize: 13 },
  nodeBody: { fontSize: 12, opacity: 0.8, marginTop: 4, whiteSpace: "pre-line" },
  svg: { position: "absolute", inset: 0, pointerEvents: "none" },
  review: {
    marginTop: theme.spacing(2),
    padding: theme.spacing(1.5),
    border: "1px dashed #9ccc9c",
    borderRadius: 10,
    background: "#f6fff6"
  }
}));

const nodeTypes = [
  { value: "message", label: "Exibir mensagem" },
  { value: "webhook", label: "Webhook (n8n)" },
  { value: "kanban", label: "Mover Kanban" },
  { value: "condition", label: "Condição" },
  { value: "menu", label: "Menu" }
];

const FlowBuilder = () => {
  const classes = useStyles();

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

  const [nodes, setNodes] = useState([
    { id: "start", type: "start", label: "Início", value: "Mensagem recebida", x: 80, y: 210 },
    { id: "n1", type: "message", label: "Exibir mensagem", value: "Olá! Como posso ajudar?", x: 370, y: 210 }
  ]);
  const [edges, setEdges] = useState([{ from: "start", to: "n1" }]);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [savedFlows, setSavedFlows] = useState([]);

  const loadFlows = async () => {
    try {
      const { data } = await api.get("/flows");
      setSavedFlows(Array.isArray(data) ? data : []);
    } catch (error) {
      toast.warning("Não foi possível carregar os fluxos salvos");
    }
  };

  useEffect(() => {
    loadFlows();
  }, []);

  const byId = useMemo(() => Object.fromEntries(nodes.map(n => [n.id, n])), [nodes]);

  const buildNodeValue = () => {
    if (newType === "message") return replyMessage || "Configurar resposta";
    if (newType === "webhook") return `${webhookMethod} ${webhookUrl || "URL pendente"}`;
    if (newType === "kanban") return `Mover para: ${kanbanColumn || "coluna pendente"}`;
    if (newType === "menu") return "1-Financeiro | 2-Suporte";
    return "Configurar...";
  };

  const validateAction = () => {
    if (!flowName.trim()) return "Informe o nome do fluxo.";
    if (!keywords.trim()) return "Informe ao menos 1 palavra-chave.";

    if (newType === "message" && !replyMessage.trim()) return "A resposta automática está vazia.";
    if (newType === "webhook") {
      if (!webhookUrl.trim()) return "Informe a URL do webhook.";
      try { new URL(webhookUrl); } catch { return "URL do webhook inválida."; }
    }
    if (newType === "kanban" && !kanbanColumn) return "Selecione a coluna do Kanban.";

    return null;
  };

  const addNode = () => {
    const validationError = validateAction();
    if (validationError) {
      toast.warning(validationError);
      return;
    }

    const id = `n${Date.now()}`;
    const typeLabel = nodeTypes.find(t => t.value === newType)?.label || "Bloco";
    setNodes(prev => [
      ...prev,
      {
        id,
        type: newType,
        label: typeLabel,
        value: buildNodeValue(),
        x: 640,
        y: 120 + (prev.length % 5) * 80
      }
    ]);

    setSelectedTo(id);
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

  const saveFlow = async () => {
    const validationError = validateAction();
    if (validationError) {
      toast.warning(validationError);
      return;
    }

    const visualPayload = {
      version: 2,
      metadata: { flowName, keywords, createdFrom: "flowbuilder-visual" },
      actionDefaults: { newType, replyMessage, webhookUrl, webhookMethod, webhookPayload, kanbanColumn },
      nodes,
      edges,
      updatedAt: new Date().toISOString()
    };

    const actionValue =
      newType === "message"
        ? replyMessage
        : newType === "webhook"
          ? JSON.stringify({ url: webhookUrl, method: webhookMethod, payload: webhookPayload })
          : newType === "kanban"
            ? kanbanColumn
            : "";

    const apiPayload = {
      name: flowName,
      triggerType: "message_received",
      containsText: keywords,
      actionType: newType,
      actionValue,
      isActive: true,
      visualPayload
    };

    try {
      await api.post("/flows", apiPayload);
      localStorage.setItem("flowbuilder.visual.v2", JSON.stringify(visualPayload));
      toast.success("Fluxo salvo no backend com sucesso");
      loadFlows();
    } catch (error) {
      localStorage.setItem("flowbuilder.visual.v2", JSON.stringify(visualPayload));
      toast.warning("Backend indisponível. Salvo localmente para teste.");
    }
  };

  const reviewText = `SE mensagem contém: ${keywords || "(não informado)"}\nENTÃO ação atual: ${nodeTypes.find(t => t.value === newType)?.label || "-"}`;

  const toggleFlow = async flow => {
    try {
      await api.put(`/flows/${flow.id}`, { isActive: !flow.isActive });
      toast.success(`Fluxo ${!flow.isActive ? "ativado" : "desativado"}`);
      loadFlows();
    } catch (error) {
      toast.error("Não foi possível atualizar o status do fluxo");
    }
  };

  const removeFlow = async flow => {
    if (!window.confirm(`Excluir fluxo \"${flow.name}\"?`)) return;
    try {
      await api.delete(`/flows/${flow.id}`);
      toast.success("Fluxo excluído");
      loadFlows();
    } catch (error) {
      toast.error("Não foi possível excluir o fluxo");
    }
  };

  const editFlow = flow => {
    setFlowName(flow.name || "");
    setKeywords(flow.containsText || "");
    setNewType(flow.actionType || "message");
    if (flow.actionType === "message") setReplyMessage(flow.actionValue || "");
    if (flow.actionType === "kanban") setKanbanColumn(flow.actionValue || "");
    if (flow.actionType === "webhook") {
      try {
        const parsed = JSON.parse(flow.actionValue || "{}");
        setWebhookUrl(parsed.url || "");
        setWebhookMethod(parsed.method || "POST");
        setWebhookPayload(parsed.payload || "");
      } catch (_e) {
        setWebhookUrl("");
      }
    }
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div className={classes.root}>
      <Paper className={classes.hero} elevation={0}>
        <Typography variant="h6">FlowBuilder Visual (Teste)</Typography>
        <Typography style={{ opacity: 0.8 }}>
          Estrutura com gatilho + ação condicional para facilitar a criação de fluxos e chamada de webhook no n8n.
        </Typography>
        <div style={{ marginTop: 8, display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Chip label={`${nodes.length} blocos`} />
          <Chip label={`${edges.length} conexões`} style={{ background: "#43a047", color: "#fff" }} />
        </div>
      </Paper>

      <Paper className={classes.panel} elevation={0}>
        <Grid container spacing={2}>
          <Grid item xs={12} md={4}>
            <TextField fullWidth label="Nome interno do fluxo" variant="outlined" size="small" value={flowName} onChange={e => setFlowName(e.target.value)} />
          </Grid>
          <Grid item xs={12} md={8}>
            <TextField fullWidth label="Palavras-chave (vírgula)" variant="outlined" size="small" value={keywords} onChange={e => setKeywords(e.target.value)} placeholder="boleto, pagamento, suporte" />
          </Grid>

          <Grid item xs={12} md={3}>
            <TextField select fullWidth label="Ação" value={newType} onChange={e => setNewType(e.target.value)} variant="outlined" size="small">
              {nodeTypes.map(t => <MenuItem key={t.value} value={t.value}>{t.label}</MenuItem>)}
            </TextField>
          </Grid>

          {newType === "message" && (
            <Grid item xs={12} md={9}>
              <TextField fullWidth label="Resposta automática" variant="outlined" size="small" value={replyMessage} onChange={e => setReplyMessage(e.target.value)} />
            </Grid>
          )}

          {newType === "webhook" && (
            <>
              <Grid item xs={12} md={4}>
                <TextField fullWidth label="Método" select variant="outlined" size="small" value={webhookMethod} onChange={e => setWebhookMethod(e.target.value)}>
                  <MenuItem value="POST">POST</MenuItem>
                  <MenuItem value="GET">GET</MenuItem>
                  <MenuItem value="PUT">PUT</MenuItem>
                </TextField>
              </Grid>
              <Grid item xs={12} md={8}>
                <TextField fullWidth label="URL do webhook" variant="outlined" size="small" value={webhookUrl} onChange={e => setWebhookUrl(e.target.value)} />
              </Grid>
              <Grid item xs={12}>
                <TextField fullWidth label="Payload JSON" variant="outlined" size="small" value={webhookPayload} onChange={e => setWebhookPayload(e.target.value)} multiline rows={2} />
              </Grid>
            </>
          )}

          {newType === "kanban" && (
            <Grid item xs={12} md={6}>
              <TextField fullWidth label="Coluna destino" select variant="outlined" size="small" value={kanbanColumn} onChange={e => setKanbanColumn(e.target.value)}>
                <MenuItem value="novo">Novo</MenuItem>
                <MenuItem value="em-atendimento">Em atendimento</MenuItem>
                <MenuItem value="financeiro">Financeiro</MenuItem>
                <MenuItem value="concluido">Concluído</MenuItem>
              </TextField>
            </Grid>
          )}

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
            <Button variant="outlined" startIcon={<Visibility />} onClick={() => setReviewOpen(v => !v)}>Revisão</Button>
          </Grid>
          <Grid item>
            <Button variant="contained" style={{ background: "#2e7d32", color: "#fff" }} startIcon={<Save />} onClick={saveFlow}>Salvar fluxo</Button>
          </Grid>
        </Grid>

        {reviewOpen && (
          <div className={classes.review}>
            <Typography variant="subtitle2">Pré-visualização da regra</Typography>
            <Typography variant="body2" style={{ whiteSpace: "pre-line" }}>{reviewText}</Typography>
          </div>
        )}
      </Paper>

      <Paper className={classes.panel} elevation={0}>
        <Typography variant="subtitle1" style={{ fontWeight: 700, marginBottom: 10 }}>
          Fluxos salvos
        </Typography>
        {savedFlows.length === 0 ? (
          <Typography variant="body2" style={{ opacity: 0.7 }}>
            Nenhum fluxo salvo ainda.
          </Typography>
        ) : (
          <Grid container spacing={2}>
            {savedFlows.map(flow => (
              <Grid item xs={12} md={6} key={flow.id}>
                <Paper variant="outlined" style={{ padding: 12, borderRadius: 10 }}>
                  <Typography variant="subtitle2">{flow.name}</Typography>
                  <Typography variant="body2" style={{ opacity: 0.8 }}>
                    Palavras-chave: {flow.containsText || "-"}
                  </Typography>
                  <Typography variant="body2" style={{ opacity: 0.8 }}>
                    Ação: {flow.actionType || "-"}
                  </Typography>
                  <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <Chip size="small" label={flow.isActive ? "Ativo" : "Inativo"} style={{ background: flow.isActive ? "#e8f5e9" : "#f3f4f6" }} />
                    <Button size="small" variant="outlined" onClick={() => editFlow(flow)}>Editar</Button>
                    <Button size="small" variant="outlined" onClick={() => toggleFlow(flow)}>{flow.isActive ? "Desativar" : "Ativar"}</Button>
                    <Button size="small" variant="outlined" style={{ color: "#c62828", borderColor: "#ef9a9a" }} onClick={() => removeFlow(flow)}>Excluir</Button>
                  </div>
                </Paper>
              </Grid>
            ))}
          </Grid>
        )}
      </Paper>

      <div className={classes.canvasWrap}>
        <div className={classes.canvas}>
          <svg className={classes.svg}>
            {edges.map((edge, idx) => {
              const from = byId[edge.from];
              const to = byId[edge.to];
              if (!from || !to) return null;
              const x1 = from.x + 220;
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
