# Segurança

## Escopo

O AutoStamp PDF é um aplicativo local, em versão inicial. Ele escuta em `127.0.0.1` e rejeita hosts e origens web externas. Não há suporte a implantação pública ou multiusuário.

## Relatar uma vulnerabilidade

Prefira a opção privada **Report a vulnerability**, na aba Security do repositório, quando disponível. Caso ela não esteja disponível, abra uma issue sem detalhes exploráveis pedindo um canal privado. Não publique PDFs reais, chaves, tokens ou conteúdo de clientes.

Não há prazo de resposta garantido. Uma correção será avaliada conforme a reprodução e o impacto do problema.

## Uso

- Mantenha Node.js e dependências atualizados.
- Guarde `OPENAI_API_KEY` somente no servidor e limite o orçamento da organização na plataforma OpenAI.
- Não exponha o servidor local à internet nem use um túnel público sem implementar autenticação e limites adequados.
- Trate PDFs e resultados da IA como dados não confiáveis e revise o arquivo final.
- `store: false` não substitui a avaliação das políticas de dados da API.
