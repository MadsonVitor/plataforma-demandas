const db = require('../config/database');
const { horaDoItem } = require('../utils/agruparPorDia');

// Fuso do Brasil
const OFFSET_HORAS = -3;

function index(req, res) {
    // Mês selecionado (formato "2026-10"). Padrão = mês atual
    const agora = new Date(Date.now() + OFFSET_HORAS * 60 * 60 * 1000);
    const mesAtual = `${agora.getUTCFullYear()}-${String(agora.getUTCMonth() + 1).padStart(2, '0')}`;
    const mes = req.query.mes || mesAtual;

    if (!/^\d{4}-\d{2}$/.test(mes)) {
        return res.redirect('/demandas/calendario');
    }

    const [ano, numMes] = mes.split('-').map(Number);

    // Busca todas as atividades do mês (considerando fuso do Brasil -3h)
    const atividades = db.prepare(`
    SELECT a.*, u.nome AS usuario_nome, d.titulo AS demanda_titulo
    FROM atividades a
    JOIN usuarios u ON u.id = a.usuario_id
    LEFT JOIN demandas d ON d.id = a.demanda_id
    WHERE strftime('%Y-%m', datetime(a.criado_em, '-3 hours')) = ?
    ORDER BY a.criado_em DESC
  `).all(mes);

    // Agrupa por dia usando o MESMO método do agruparPorDia
    const porDia = {};
    atividades.forEach(a => {
        // Converte UTC → Brasil corretamente
        const iso = String(a.criado_em).replace(' ', 'T') + 'Z';
        const dataUTC = new Date(iso);
        const dataBR = new Date(dataUTC.getTime() + OFFSET_HORAS * 60 * 60 * 1000);

        const ano2 = dataBR.getUTCFullYear();
        const mes2 = String(dataBR.getUTCMonth() + 1).padStart(2, '0');
        const dia2 = String(dataBR.getUTCDate()).padStart(2, '0');
        const chave = `${ano2}-${mes2}-${dia2}`;

        if (!porDia[chave]) porDia[chave] = [];

        // Adiciona hora formatada em cada atividade
        porDia[chave].push({
            ...a,
            hora: horaDoItem(a.criado_em),
        });
    });

    // Monta a grade do calendário
    const primeiroDia = new Date(ano, numMes - 1, 1);
    const ultimoDia = new Date(ano, numMes, 0);
    const diasNoMes = ultimoDia.getDate();
    const diaSemanaInicio = primeiroDia.getDay();

    // Navegação
    const mesAnterior = numMes === 1
        ? `${ano - 1}-12`
        : `${ano}-${String(numMes - 1).padStart(2, '0')}`;
    const mesProximo = numMes === 12
        ? `${ano + 1}-01`
        : `${ano}-${String(numMes + 1).padStart(2, '0')}`;

    const nomesMeses = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
        'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
    const nomeMes = `${nomesMeses[numMes - 1]} ${ano}`;

    // Dia selecionado
    const diaSelecionado = req.query.dia || null;
    let atividadesDoDia = [];
    if (diaSelecionado && porDia[diaSelecionado]) {
        atividadesDoDia = porDia[diaSelecionado];
    }

    res.render('demandas/calendario', {
        usuario: req.usuario,
        mes,
        nomeMes,
        mesAnterior,
        mesProximo,
        ano,
        numMes,
        diasNoMes,
        diaSemanaInicio,
        porDia,
        diaSelecionado,
        atividadesDoDia,
    });
}

module.exports = { index };