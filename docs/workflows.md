# Workflows

Workflows permitem **automatizar várias requisições** em sequência, conectadas visualmente.

## Acessar

Header → botão **Workflow** (alterna a view do painel central).

## Criar workflow

1. Clique em **+ Workflow** no header.
2. Informe o nome.
3. O canvas abre com grade para montar o grafo.

## Montar o grafo

- Cada **nó** representa uma requisição do workspace
- **Arraste** nós pelo canvas
- **Conecte** nós pelas âncoras (bolinhas nas laterais): saída → entrada
- A execução segue as conexões definidas

## Executar

Use o botão **Run** na toolbar do workflow. O status da execução aparece na barra do canvas.

## Agendar (jobs)

É possível **agendar** execuções periódicas de um workflow (intervalo em segundos). O histórico de execuções fica registrado para consulta.

---

## Quando usar workflow

| Cenário | Exemplo |
|---------|---------|
| Smoke test | Login → listar → detalhe |
| Fluxo dependente | Criar recurso → usar ID na próxima call |
| Rotina repetitiva | Health checks em sequência |

> Workflows usam o **ambiente ativo** do header (base URL + variáveis) no momento da execução.
