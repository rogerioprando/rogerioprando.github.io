---
author: Rogério Luiz Prando
pubDatetime: 2026-11-16T12:00:00Z
title: "Como funciona um sorteio de times? Engenharia reversa de um algoritmo"
slug: sorteio-times-engenharia-reversa
featured: true
draft: false
tags:
  - algoritmos
  - csharp
  - engenharia-reversa
  - inteligencia-artificial
description: "Uma análise assistida por IA do Sorteador de Peladeiro: como as notas são calculadas, como os times são balanceados e o que uma extração do algoritmo revela."
---

Como um aplicativo decide se dois times estão equilibrados? O que acontece quando vários jogadores têm a mesma nota, quando a quantidade é ímpar ou quando o sorteio não encontra uma divisão aceitável?

Para responder a essas perguntas, analisei o fluxo de sorteio do [Sorteador de Peladeiro](https://github.com/azsoncini/SorteadorDePeladeiro), projeto de **Alessandro Soncini**. A investigação foi feita com auxílio de IA para localizar e explicar as regras no código; a análise e a proposta de extração foram revisadas antes de virar este artigo. 

O objetivo aqui não é reimplementar o aplicativo inteiro. É separar a lógica de negócio da interface gráfica, entender as decisões do algoritmo e tornar explícitas algumas situações-limite que ficam escondidas quando os resultados são exibidos diretamente em controles visuais.

## Do cadastro ao sorteio

O fluxo tem duas etapas principais:

1. Cada jogador recebe uma nota calculada a partir de seus atributos e de sua posição.
2. O algoritmo distribui os jogadores entre dois times e compara a soma das notas para decidir se aceita a divisão.

No aplicativo original, essas responsabilidades aparecem em `calcula_atributo_por_posicao()`, `normaliza()` e `sortear_jogadores()`, no arquivo `Main_Form.cs`. O resultado final é escrito na interface. Para analisar o sorteio isoladamente, é útil imaginar uma função que receba jogadores com notas já calculadas e devolva os dois times, seus pesos e o número de tentativas.

## A nota depende da posição

O modelo considera os atributos nesta ordem: desarme, cobertura, passe, lançamento, drible, chute longo, finalização, velocidade, força, domínio e fôlego. Cada posição atribui um peso diferente a cada atributo:

| Posição       | Pesos dos atributos, na ordem acima                     |
| ------------- | ------------------------------------------------------- |
| Zagueiro      | `1.1, 1.1, 1.0, 0.6, 0.5, 0.5, 0.1, 0.6, 0.8, 0.2, 0.3` |
| Volante       | `0.6, 0.7, 1.0, 0.8, 0.8, 0.9, 0.5, 0.6, 0.5, 1.0, 0.4` |
| Lateral       | `0.6, 0.8, 0.6, 0.8, 0.4, 0.2, 0.2, 1.0, 0.3, 0.4, 0.7` |
| Meio-campista | `0.2, 0.5, 1.0, 0.8, 1.0, 0.8, 0.6, 0.8, 0.3, 1.0, 0.5` |
| Atacante      | `0.1, 0.3, 0.6, 0.2, 1.0, 0.7, 1.0, 0.8, 0.5, 0.9, 0.7` |
| Banheira      | `0, 0, 0.9, 0.2, 1.0, 0.2, 1.0, 1.0, 1.0, 1.0, 0`       |

Em termos gerais, a nota bruta resulta da soma dos atributos multiplicados pelos pesos da posição. Um atributo chamado `fominha` também existe no modelo, mas não participa do cálculo de nenhuma posição.

Depois, as notas passam por uma normalização: calcula-se a média e o desvio padrão populacional, transforma-se cada valor, aplica-se uma escala, arredonda-se e tenta-se manter o resultado entre 1 e 10. Há um detalhe importante no código legado: o acumulador chamado `media` não é zerado antes de somar os valores transformados. Com isso, o denominador da escala também inclui a média original — provavelmente diferente do que se pretendia.

Outro caso delicado ocorre quando todos os jogadores têm a mesma nota bruta. O desvio padrão fica igual a zero; a divisão pode produzir `NaN`, e uma comparação numérica com esse valor nunca aprova o balanceamento. É um bom exemplo de por que os casos de borda precisam ser tratados antes de confiar no resultado de uma fórmula.

## Como o sorteio aceita uma divisão

Com as notas prontas, o sorteio segue estas regras:

1. A interface exige pelo menos dois jogadores.
2. O primeiro time recebe `ceil(n / 2)` jogadores; o segundo fica com os demais. Para um total ímpar, portanto, o primeiro time tem um jogador a mais.
3. O código soma as notas dos times e calcula `Time1Weight / Time2Weight`.
4. A divisão só é aceita quando essa razão está **estritamente** entre `1 - tolerância` e `1 + tolerância`.
5. Se a tolerância recebida for zero ou negativa, usa-se `0,2`. Na interface, o valor é limitado a 2 e pode ter duas casas decimais.
6. São feitas até 50 tentativas. O algoritmo original não garante que encontrará uma divisão válida nesse limite.

O critério compara uma razão, e não a diferença absoluta entre as somas. Por isso, ele não é simétrico: inverter os times transforma a razão em seu inverso, e a aceitação de uma divisão pode depender de qual time ficou como o primeiro.

## Aleatoriedade e problemas encontrados

No legado, a escolha usa `System.Random` e sorteia índices repetidamente, descartando os que já foram usados. Isso é uma seleção aleatória sem reposição, mas a tentativa de preencher um time não tem limite próprio: em condições ruins, pode ficar presa antes mesmo de concluir uma tentativa de balanceamento.

Também há um vetor de índices usados que utiliza `255` como sentinela. Com mais de 255 jogadores, esse valor pode ser confundido com um índice ainda não preenchido, levando a um loop infinito. A interface pode limitar os dados hoje, mas uma rotina de negócio fica mais confiável quando valida suas próprias entradas.

Por fim, posições não reconhecidas podem fazer o cálculo posicional deixar de avançar o índice, outro caminho para um loop sem fim. Mesmo que a interface limite as opções, a validação deve estar no limite da lógica que depende desses valores.

O sorteio usa `Random.Next(0, quantidade)`: o limite inferior é inclusivo e o superior, exclusivo. `System.Random` é adequado para aleatoriedade comum, mas não para fins criptográficos — algo que não é necessário para esse tipo de aplicação.

## Extraindo um núcleo testável

Uma forma de desacoplar o sorteio da interface é passar os jogadores, a tolerância e o gerador aleatório como dependências explícitas. O exemplo abaixo mantém as regras de tamanho, razão e limite de tentativas, mas usa Fisher–Yates para embaralhar sem selecionar índices duplicados. Também retorna um objeto com o resultado e valida dados que poderiam invalidar as contas.

```csharp
using System;
using System.Collections.Generic;
using System.Linq;

public sealed class Player
{
    public int Id { get; private set; }
    public string Name { get; private set; }
    public double Rating { get; private set; }

    public Player(int id, string name, double rating)
    {
        Id = id;
        Name = name;
        Rating = rating;
    }
}

public sealed class TeamDrawResult
{
    public bool Succeeded { get; private set; }
    public Player[] Team1 { get; private set; }
    public Player[] Team2 { get; private set; }
    public double Team1Weight { get; private set; }
    public double Team2Weight { get; private set; }
    public double Ratio { get; private set; }
    public int Attempts { get; private set; }

    public TeamDrawResult(
        bool succeeded,
        Player[] team1,
        Player[] team2,
        double team1Weight,
        double team2Weight,
        double ratio,
        int attempts)
    {
        Succeeded = succeeded;
        Team1 = team1;
        Team2 = team2;
        Team1Weight = team1Weight;
        Team2Weight = team2Weight;
        Ratio = ratio;
        Attempts = attempts;
    }
}

public static class TeamDrawer
{
    public static TeamDrawResult Draw(
        IReadOnlyList<Player> players,
        double tolerance,
        Random random)
    {
        if (players == null)
            throw new ArgumentNullException(nameof(players));
        if (random == null)
            throw new ArgumentNullException(nameof(random));
        if (players.Count < 2)
            throw new ArgumentException(
                "At least two players are required.",
                nameof(players));
        if (double.IsNaN(tolerance) || double.IsInfinity(tolerance))
            throw new ArgumentOutOfRangeException(nameof(tolerance));

        foreach (Player player in players)
        {
            if (player == null)
                throw new ArgumentException(
                    "Players cannot contain null entries.",
                    nameof(players));
            if (double.IsNaN(player.Rating) ||
                double.IsInfinity(player.Rating) ||
                player.Rating <= 0)
            {
                throw new ArgumentException(
                    "Each player must have a finite, positive rating.",
                    nameof(players));
            }
        }

        double offset = tolerance > 0 ? tolerance : 0.2;
        int team1Size = (players.Count + 1) / 2;
        double lastTeam1Weight = 0;
        double lastTeam2Weight = 0;
        double lastRatio = 0;

        for (int attempt = 1; attempt <= 50; attempt++)
        {
            var shuffled = new List<Player>(players);

            for (int i = shuffled.Count - 1; i > 0; i--)
            {
                int j = random.Next(i + 1);
                Player temp = shuffled[i];
                shuffled[i] = shuffled[j];
                shuffled[j] = temp;
            }

            Player[] team1 = shuffled.GetRange(0, team1Size).ToArray();
            Player[] team2 = shuffled
                .GetRange(team1Size, shuffled.Count - team1Size)
                .ToArray();

            lastTeam1Weight = team1.Sum(player => player.Rating);
            lastTeam2Weight = team2.Sum(player => player.Rating);
            lastRatio = lastTeam1Weight / lastTeam2Weight;

            if (lastRatio > 1 - offset && lastRatio < 1 + offset)
            {
                return new TeamDrawResult(
                    true,
                    team1,
                    team2,
                    lastTeam1Weight,
                    lastTeam2Weight,
                    lastRatio,
                    attempt);
            }
        }

        return new TeamDrawResult(
            false,
            new Player[0],
            new Player[0],
            lastTeam1Weight,
            lastTeam2Weight,
            lastRatio,
            50);
    }
}
```

Injetar `Random` permite fornecer uma semente fixa nos testes e reproduzir uma sequência de sorteios. Já Fisher–Yates evita a rejeição de índices duplicados e a sentinela `255`. A proposta ainda preserva o limite de 50 tentativas: se nenhuma divisão passar pelo critério, o resultado informa a falha e mantém os pesos e a razão da última tentativa para diagnóstico.

Esse núcleo recebe notas já calculadas. O cálculo dos atributos por posição e a normalização continuam sendo etapas anteriores; extraí-los e corrigi-los exigiria testes próprios, especialmente para o caso de desvio padrão zero e para a escala observada no legado.

## O que vale testar

Uma suíte de testes para essa lógica pode tornar explícitos os comportamentos importantes:

- rejeitar uma lista nula ou com menos de dois jogadores;
- rejeitar notas nulas, não finitas ou menores ou iguais a zero;
- verificar que todos os jogadores aparecem exatamente uma vez entre os dois times;
- confirmar que o primeiro time recebe o jogador extra quando a quantidade é ímpar;
- validar a tolerância padrão quando o valor é zero ou negativo;
- cobrir a fronteira do balanceamento, lembrando que os limites são estritos;
- usar uma semente fixa para reproduzir um resultado;
- confirmar que, após 50 tentativas sem sucesso, o resultado informa a falha e preserva os dados da última tentativa;
- testar a normalização com notas iguais e a validação de posições desconhecidas.

Separar regras da interface torna o código mais fácil de testar, mas também evidencia as escolhas que merecem revisão: a normalização, o critério assimétrico de razão e o limite fixo de tentativas. A engenharia reversa ajuda justamente nisso: não apenas reproduzir o comportamento, mas identificar o que é regra intencional e o que pode ser um acidente de implementação.

## Créditos

O algoritmo analisado pertence ao [Sorteador de Peladeiro, de Alessandro Soncini](https://github.com/azsoncini/SorteadorDePeladeiro). Obrigado ao Alessandro por autorizar a publicação desta análise e da proposta de extração. O código apresentado é uma versão didática e desacoplada para explicar o núcleo do sorteio; não substitui nem representa uma alteração no repositório original.
