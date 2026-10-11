const OFFSET_HORAS = -3;

function dataUTCparaBR(criadoEm) {
    if (!criadoEm) return null;
    const iso = criadoEm.replace(' ', 'T') + 'Z';
    const data = new Date(iso);
    if (isNaN(data.getTime())) return null;
    return new Date(data.getTime() + OFFSET_HORAS * 60 * 60 * 1000);
}

function chaveDoDia(criadoEm) {
    const data = dataUTCparaBR(criadoEm);
    if (!data) return 'sem-data';
    const ano = data.getUTCFullYear();
    const mes = String(data.getUTCMonth() + 1).padStart(2, '0');
    const dia = String(data.getUTCDate()).padStart(2, '0');
    return `${ano}-${mes}-${dia}`;
}

function horaDoItem(criadoEm) {
    const data = dataUTCparaBR(criadoEm);
    if (!data) return '';
    const hora = String(data.getUTCHours()).padStart(2, '0');
    const min = String(data.getUTCMinutes()).padStart(2, '0');
    return `${hora}:${min}`;
}

function tituloDoDia(chave) {
    if (chave === 'sem-data') return 'Sem data';
    const [ano, mes, dia] = chave.split('-');
    const dataBR = `${dia}/${mes}/${ano}`;
    const agora = new Date(Date.now() + OFFSET_HORAS * 60 * 60 * 1000);
    const hojeISO = `${agora.getUTCFullYear()}-${String(agora.getUTCMonth() + 1).padStart(2, '0')}-${String(agora.getUTCDate()).padStart(2, '0')}`;
    const ontem = new Date(agora.getTime() - 24 * 60 * 60 * 1000);
    const ontemISO = `${ontem.getUTCFullYear()}-${String(ontem.getUTCMonth() + 1).padStart(2, '0')}-${String(ontem.getUTCDate()).padStart(2, '0')}`;
    if (chave === hojeISO) return `Hoje, ${dataBR}`;
    if (chave === ontemISO) return `Ontem, ${dataBR}`;
    return dataBR;
}

function agruparPorDia(itens) {
    const grupos = new Map();
    itens.forEach(item => {
        const chave = chaveDoDia(item.criado_em);
        if (!grupos.has(chave)) grupos.set(chave, []);
        grupos.get(chave).push(item);
    });
    const chavesOrdenadas = Array.from(grupos.keys()).sort().reverse();
    return chavesOrdenadas.map(chave => ({
        chave,
        titulo: tituloDoDia(chave),
        itens: grupos.get(chave),
    }));
}

module.exports = { agruparPorDia, horaDoItem };