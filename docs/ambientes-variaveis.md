# Ambientes e variáveis

## Ambientes

Um **ambiente** representa um alvo de execução: Local, Develop, Homolog, Produção, etc.

Cada ambiente possui:

| Campo | Descrição |
|-------|-----------|
| **Nome** | Rótulo exibido no header (ex.: `Homolog`) |
| **Base URL** | URL raiz do servidor (ex.: `https://api.homolog.com`) |

### Selecionar ambiente

Use o seletor **Ambiente** no header. Ao trocar:

- A **base URL** usada no envio muda
- As **variáveis** daquele ambiente passam a valer
- A **árvore de coleções não muda** — requests são compartilhados no workspace

### Gerenciar ambientes

1. Clique no botão **+** ao lado do seletor de ambiente.
2. Crie, edite ou exclua ambientes (nome + base URL).
3. Defina qual ambiente está **ativo** para o workspace.

---

## Variáveis

Variáveis guardam valores reutilizáveis: tokens, IDs, paths comuns, etc.

### Onde editar

Sidebar → **Variáveis** → editor key/value do ambiente ativo.

### Sintaxe

Use `{{nome_da_variavel}}` em:

- Path da requisição (`/users/{{user_id}}`)
- Query params e headers
- Body (JSON, texto, etc.)

No body JSON, mantenha aspas na string:

```json
{"token": "{{token_auth}}"}
```

### Atalho `@` no body

Ao digitar `@` no editor de body, você pode inserir variáveis rapidamente (equivalente a `{{nome}}`).

### Preview

Ao montar a URL, o app mostra um preview com variáveis reconhecidas destacadas.

---

## URL final no envio

```text
baseUrl do ambiente  +  path da requisição  +  interpolação {{var}}
```

**Exemplo:**

| Ambiente | Base URL | Path | Resultado |
|----------|----------|------|-----------|
| Local | `http://localhost:3000` | `/api/users` | `http://localhost:3000/api/users` |
| Prod | `https://api.com` | `/v1/users/{{id}}` | `https://api.com/v1/users/42` |

### Modo URL absoluta

Na barra da requisição, troque **Host** por **URL** para informar a URL completa (ignora a base URL do ambiente).
