import React, { useEffect, useMemo, useState } from "react";
import {
  Button,
  CircularProgress,
  Grid,
  MenuItem,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
  Chip,
  Divider,
  makeStyles
} from "@material-ui/core";
import { toast } from "react-toastify";

import api from "../../services/api";
import toastError from "../../errors/toastError";

const useStyles = makeStyles(theme => ({
  root: {
    display: "grid",
    gap: theme.spacing(2)
  },
  hero: {
    padding: theme.spacing(2),
    borderRadius: 12,
    border: "1px solid #b7dfb9",
    background: "linear-gradient(135deg, #f1fbf2 0%, #e4f6e6 100%)"
  },
  titleRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: theme.spacing(1),
    flexWrap: "wrap"
  },
  subtitle: { opacity: 0.78, marginTop: theme.spacing(0.5) },
  formCard: {
    padding: theme.spacing(2),
    borderRadius: 12,
    border: "1px solid #c6e7c9",
    backgroundColor: "#f8fdf8"
  },
  fieldHelp: {
    fontSize: 12,
    opacity: 0.7,
    marginTop: -2
  },
  tableCard: {
    padding: theme.spacing(1),
    borderRadius: 12,
    border: "1px solid #c6e7c9",
    backgroundColor: "#fcfffc"
  },
  empty: {
    padding: theme.spacing(4),
    textAlign: "center",
    opacity: 0.7
  },
  actionButtons: {
    display: "flex",
    gap: theme.spacing(1),
    flexWrap: "wrap"
  }
}));

const emptyForm = {
  name: "",
  containsText: "",
  actionType: "send_message",
  actionValue: "",
  isActive: true
};

const stageHint = "novo | em_atendimento | aguardando_morador | resolvido";

const actionTypeLabels = {
  send_message: "Enviar mensagem",
  move_stage: "Mover Kanban",
  webhook_post: "Webhook POST"
};

const FlowBuilder = () => {
  const classes = useStyles();
  const [flows, setFlows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState(emptyForm);

  const safeFlows = useMemo(() => (Array.isArray(flows) ? flows : []), [flows]);
  const activeCount = useMemo(() => safeFlows.filter(flow => flow.isActive).length, [safeFlows]);

  const loadFlows = async () => {
    try {
      setLoading(true);
      const { data } = await api.get("/flows");
      setFlows(Array.isArray(data) ? data : []);
    } catch (err) {
      setFlows([]);
      toastError(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFlows();
  }, []);

  const setField = (field, value) => {
    setForm(prev => ({ ...(prev || emptyForm), [field]: value }));
  };

  const actionLabel =
    form.actionType === "send_message"
      ? "Mensagem de resposta"
      : form.actionType === "move_stage"
        ? "Etapa do Kanban"
        : "URL do webhook (n8n)";

  const validateForm = () => {
    if (!form.name.trim()) {
      toast.warning("Informe um nome para o fluxo");
      return false;
    }

    if (!form.actionValue.trim()) {
      toast.warning("Preencha o valor da ação");
      return false;
    }

    if (form.actionType === "move_stage") {
      const validStages = ["novo", "em_atendimento", "aguardando_morador", "resolvido"];
      if (!validStages.includes(form.actionValue.trim())) {
        toast.warning("Etapa inválida. Use um dos valores sugeridos.");
        return false;
      }
    }

    return true;
  };

  const handleCreate = async e => {
    e.preventDefault();

    if (!validateForm()) return;

    try {
      setCreating(true);
      await api.post("/flows", {
        name: form.name.trim(),
        triggerType: "message_received",
        containsText: form.containsText.trim(),
        actionType: form.actionType,
        actionValue: form.actionValue.trim(),
        isActive: true
      });

      setForm(emptyForm);
      toast.success("Fluxo criado com sucesso");
      loadFlows();
    } catch (err) {
      toastError(err);
    } finally {
      setCreating(false);
    }
  };

  const toggleFlow = async flow => {
    try {
      await api.put(`/flows/${flow.id}`, { isActive: !flow.isActive });
      loadFlows();
    } catch (err) {
      toastError(err);
    }
  };

  const removeFlow = async flow => {
    try {
      await api.delete(`/flows/${flow.id}`);
      toast.success("Fluxo removido");
      loadFlows();
    } catch (err) {
      toastError(err);
    }
  };

  return (
    <div className={classes.root}>
      <Paper className={classes.hero} elevation={0}>
        <div className={classes.titleRow}>
          <Typography variant="h6">FlowBuilder • Automação de Mensagens</Typography>
          <div className={classes.actionButtons}>
            <Chip label={`${safeFlows.length} fluxo(s)`} size="small" />
            <Chip label={`${activeCount} ativo(s)`} size="small" style={{ backgroundColor: "#43a047", color: "#fff" }} />
          </div>
        </div>
        <Typography className={classes.subtitle}>
          Regras por palavra-chave para responder automaticamente, mover ticket no Kanban ou chamar webhook no n8n.
        </Typography>
      </Paper>

      <Paper className={classes.formCard} elevation={0}>
        <Typography variant="subtitle1"><b>Novo fluxo</b></Typography>
        <Divider style={{ margin: "10px 0 16px" }} />

        <form onSubmit={handleCreate}>
          <Grid container spacing={2}>
            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                label="Nome do fluxo"
                value={form.name}
                onChange={e => setField("name", e.target.value)}
                required
                variant="outlined"
                size="small"
              />
            </Grid>

            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                label="Quando mensagem contém"
                value={form.containsText}
                onChange={e => setField("containsText", e.target.value)}
                placeholder="ex: boleto, 2ª via"
                helperText="Pode usar múltiplas palavras separadas por vírgula"
                variant="outlined"
                size="small"
              />
            </Grid>

            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                select
                label="Ação"
                value={form.actionType}
                onChange={e => setField("actionType", e.target.value)}
                variant="outlined"
                size="small"
              >
                <MenuItem value="send_message">Enviar mensagem</MenuItem>
                <MenuItem value="move_stage">Mover Kanban</MenuItem>
                <MenuItem value="webhook_post">Webhook POST (n8n)</MenuItem>
              </TextField>
            </Grid>

            <Grid item xs={12}>
              <TextField
                fullWidth
                label={actionLabel}
                value={form.actionValue}
                onChange={e => setField("actionValue", e.target.value)}
                required
                variant="outlined"
                size="small"
              />
              {form.actionType === "move_stage" && (
                <Typography className={classes.fieldHelp}>
                  Sugestão: {stageHint}
                </Typography>
              )}
            </Grid>

            <Grid item xs={12}>
              <Button type="submit" variant="contained" color="primary" disabled={creating}>
                {creating ? "Criando..." : "Criar fluxo"}
              </Button>
            </Grid>
          </Grid>
        </form>
      </Paper>

      <Paper className={classes.tableCard} elevation={0}>
        {loading ? (
          <div className={classes.empty}>
            <CircularProgress size={24} />
          </div>
        ) : safeFlows.length === 0 ? (
          <div className={classes.empty}>Nenhum fluxo criado ainda.</div>
        ) : (
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Nome</TableCell>
                <TableCell>Gatilho</TableCell>
                <TableCell>Ação</TableCell>
                <TableCell>Valor</TableCell>
                <TableCell>Status</TableCell>
                <TableCell align="right">Ações</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {safeFlows.map(flow => (
                <TableRow key={flow.id} hover>
                  <TableCell>{flow.name}</TableCell>
                  <TableCell>{flow.containsText || "(qualquer mensagem)"}</TableCell>
                  <TableCell>{actionTypeLabels[flow.actionType] || flow.actionType}</TableCell>
                  <TableCell>{flow.actionValue}</TableCell>
                  <TableCell>
                    <Chip
                      label={flow.isActive ? "Ativo" : "Inativo"}
                      size="small"
                      style={
                        flow.isActive
                          ? { backgroundColor: "#43a047", color: "#fff" }
                          : { backgroundColor: "#e0e0e0", color: "#424242" }
                      }
                    />
                  </TableCell>
                  <TableCell align="right">
                    <div className={classes.actionButtons}>
                      <Button size="small" variant="outlined" onClick={() => toggleFlow(flow)}>
                        {flow.isActive ? "Desativar" : "Ativar"}
                      </Button>
                      <Button size="small" color="secondary" variant="outlined" onClick={() => removeFlow(flow)}>
                        Excluir
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Paper>
    </div>
  );
};

export default FlowBuilder;
