# Backup e compartilhamento

## Arquivo .bek

O formato **.bek** é o backup portátil do Rebeka. Contém:

- Workspace e coleções (pastas + requisições)
- Ambientes com base URL e variáveis
- Workflows

É um arquivo ZIP com JSON estruturado — leve e fácil de versionar ou enviar ao time.

---

## Exportar

1. Selecione o workspace desejado no header.
2. Header → **Exportar**.
3. Escolha onde salvar o arquivo `.bek`.

---

## Importar

1. Header → **Importar**.
2. Selecione um arquivo `.bek` válido.
3. Um **novo workspace** é criado com o conteúdo importado.

> Importação não sobrescreve workspaces existentes — cada import gera um workspace separado.

---

## Boas práticas

- Exporte antes de excluir um workspace
- Use nomes claros nos arquivos (`cliente-x-homolog.bek`)
- Revise variáveis sensíveis (tokens) antes de compartilhar — o `.bek` inclui valores salvos
