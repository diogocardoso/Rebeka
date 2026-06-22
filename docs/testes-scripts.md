# Testes e scripts

Scripts permitem automatizar lógica antes e depois de cada requisição.

## Pre-request vs Tests

| Aba | Quando roda | Uso típico |
|-----|-------------|------------|
| **Pre-request** | Antes do envio | Montar token, alterar headers |
| **Tests** | Depois da resposta | Validar status/body, extrair dados |

---

## API disponível nos scripts

| Nome | Descrição |
|------|-----------|
| `req` | Dados da requisição enviada |
| `res.statusCode` | Código HTTP (200, 401…) |
| `res.body` | Corpo da resposta (texto) |
| `res.headers` | Headers da resposta |
| `res.durationMs` | Tempo em milissegundos |
| `env` | Variáveis do ambiente ativo |
| `setVar(nome, valor)` | Grava variável (persiste após o envio) |
| `execute(caminho, workspace?)` | Executa outra request da coleção e retorna a resposta |
| `assert.ok(v, msg?)` | Falha se valor for falsy |
| `assert.equal(a, b, msg?)` | Falha se `a !== b` |
| `assert.exists(v, msg?)` | Falha se `null` ou `undefined` |
| `console.log/warn/error` | Mensagens no painel **Console** |

---

## execute — chamar outra request

Executa uma request pelo **caminho da coleção**, da pasta raiz até o nome da request, separado por `.`

```javascript
// workspace ativo: Frota → Empresa → dataGrid
const grid = await execute('Frota.Empresa.dataGrid');

// workspace específico pelo nome
const empresas = await execute('Frota.Empresa.dataGrid', 'Sinetram');

assert.equal(empresas.statusCode, 200);
console.log(empresas.data);   // body JSON parseado (se aplicável)
console.log(empresas.body);   // body bruto
```

| Retorno | Descrição |
|---------|-----------|
| `statusCode` | Código HTTP |
| `body` | Corpo da resposta (texto) |
| `data` | JSON parseado do body (ou `null`) |
| `headers` | Headers da resposta |
| `durationMs` | Tempo da chamada |

**Regras:**

- Pastas e requests são buscadas **pelo nome** (sem diferenciar maiúsculas/minúsculas)
- Sem o 2º parâmetro, usa o **workspace de onde o script foi chamado**
- Usa o **ambiente ativo** do workspace alvo (base URL + variáveis)
- Variáveis do script atual (`env`) são mescladas por cima e **propagadas de volta** após o `execute`
- Executa o fluxo completo: **Pre-request → HTTP → Tests** da request alvo
- Use **`await`** — a chamada é assíncrona

---

## Exemplo: login e salvar token

1. Crie a variável `token_auth` em **Variáveis** (pode começar vazia).
2. Configure a request de login (POST + body).
3. Na aba **Tests**, adicione:

```javascript
if (res.statusCode === 200) {
  try {
    const data = JSON.parse(res.body);
    const token = data.authorization ?? data.access_token ?? data.token;
    if (token) {
      setVar('token_auth', token);
      console.log('Token salvo');
    }
  } catch (e) {
    console.error('Resposta não é JSON:', e.message);
  }
}
```

4. **Enviar** a requisição.
5. Na próxima request, use **Auth → Bearer** com `{{token_auth}}`.

---

## Asserções

```javascript
assert.equal(res.statusCode, 200, 'Status deve ser 200');

const data = JSON.parse(res.body);
assert.exists(data.id, 'Resposta precisa ter id');
assert.ok(data.active === true, 'Usuário deve estar ativo');
```

Resultados aparecem na tabela **Resultados dos Testes** (Passou / Falhou).

---

## Dicas e limitações

| Situação | O que fazer |
|----------|-------------|
| Token vira `"undefined"` | Confira o campo correto no JSON (aba Raw) |
| Variável não atualizou | Verifique se o status foi 200 e o script rodou (Console) |
| JSON inválido no body | Use aspas: `"{{var}}"`, não `{{var}}` solto em strings JSON |
| Script com erro | O envio HTTP **não é bloqueado**; o erro aparece no Console/Tests |

Scripts rodam em sandbox JavaScript — sem `fetch`, DOM ou bibliotecas externas.
