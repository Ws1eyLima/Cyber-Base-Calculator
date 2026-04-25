# Cyber Base Calculator

Ferramenta web estatica para portfolio de cybersecurity. O objetivo e acelerar
conversoes comuns em redes, CTFs, payloads e analise de logs.

## Features

- Conversao entre decimal, binario, hexadecimal e hextets IPv6
- IPv4 em decimal, binario, hexadecimal e hextet
- Calculadora IPv4 CIDR/subnet
- Mascara, wildcard, rede, broadcast e hosts uteis
- Conversor ASCII/UTF-8 para hex, binario e decimal bytes
- Conversao reversa de hex, binario e decimal bytes para texto
- Interface responsiva para desktop e celular

## Demo

https://calculadora.fluxlabsbr.com

## Como usar localmente

Abra `index.html` no navegador.

Tambem funciona com um servidor local simples:

```bash
python3 -m http.server 8000
```

Depois acesse `http://localhost:8000`.

## Exemplos

- `255` gera `0xff` e `11111111`
- `192.168.1.10/24` gera rede, broadcast, mascara e hosts
- `admin` gera `61 64 6d 69 6e`

## Por que este projeto existe?

Durante estudos de redes, SOC, Security+ e CTFs, é comum precisar converter rapidamente valores entre decimal, binário, hexadecimal, CIDR e bytes ASCII.

Este projeto centraliza essas conversões em uma interface simples para acelerar análises técnicas e reforçar fundamentos de redes e segurança.
