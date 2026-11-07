---
author: Rogério Luiz Prando
pubDatetime: 2026-11-07T12:00:00Z
title: "Além do Livro-Texto: SOLID no Mundo Real (e quando ele vira Over-Engineering)"
postSlug: solid-no-mundo-real-e-over-engineering
featured: true
draft: false
tags:
  - java
  - architecture
  - clean-code
  - solid
  - backend
description: "Uma análise prática dos princípios SOLID aplicados a sistemas complexos de otimização e escala de transporte, com foco em quando aplicar e quando evitar a complexidade acidental."
---

Quem nunca leu um artigo sobre **SOLID** que usava uma classe `Carro` herdando de `Veiculo` ou um e-commerce simplificado com `ProcessadorDePedido`? Embora didáticos, esses exemplos nem sempre mostram os desafios de sistemas que precisam acompanhar regras de negócio em constante mudança.

Em um sistema que monta escalas de trabalho no transporte público, por exemplo, várias regras se cruzam: leis trabalhistas, acordos coletivos que podem variar de uma região para outra e limites da própria operação. Se uma empresa precisar reorganizar jornadas — como em uma mudança no modelo de escala 6x1 —, o software terá de acomodar as novas condições sem transformar cada ajuste em uma cadeia de exceções e remendos. Nesse contexto, o código nem sempre fica “bonitinho”: ele precisa representar regras complexas e acompanhar mudanças frequentes.

Neste artigo, vamos usar exemplos em **Java com Spring Boot** para mostrar como os princípios SOLID podem ajudar a organizar esse tipo de evolução e, mais importante, **quando a busca cega pela “pureza arquitetural” resulta em over-engineering**.

---

## Quando o processamento da escala acumula responsabilidades

Imagine um serviço em Java/Spring Boot que processa a jornada de motoristas de ônibus. Para simplificar, o exemplo considera duas validações comuns a todas as escalas; em um sistema real, outras regras poderiam depender da região, do acordo coletivo ou do tipo de operação. Com o tempo, novas exigências e mudanças nos custos fazem o serviço concentrar responsabilidades diferentes:

```java file="DriverScheduleService.java"
@Service
public class DriverScheduleService {

    @Autowired
    private DriverRepository driverRepository;
    @Autowired
    private EmailService emailService;

    @Transactional
    public void processShift(Long driverId, ShiftData shift) {
        // 1. Validação de regras comuns da jornada
        if (shift.getContinuousDrivingMinutes() > 240) { // máx 4h seguidas
            throw new IllegalArgumentException("Motorista excedeu o tempo máximo de direção contínua.");
        }
        if (shift.getRestBreakMinutes() < 30) {
            throw new IllegalArgumentException("Intervalo de descanso intrajornada insuficiente.");
        }

        // 2. Cálculo do custo operacional
        double cost = shift.getDurationHours() * 25.0;
        if (shift.isNightShift()) {
            cost *= 1.20; // Adicional noturno
        }
        shift.setEstimatedCost(cost);

        // 3. Persistência da escala
        driverRepository.saveShift(driverId, shift);

        // 4. Notificação síncrona ao motorista
        emailService.sendNotification(driverId, "Escala confirmada com custo: R$ " + cost);
    }
}
```

> [!WARNING]
> **Onde estão os problemas?**
>
> - **Responsabilidades misturadas:** validação da jornada, cálculo de custo, persistência e notificação estão no mesmo método. Uma mudança em qualquer uma dessas áreas exige mexer no mesmo serviço.
> - **Mudanças difíceis de isolar:** se uma nova regra de jornada for adicionada com mais um `if`, o método cresce e passa a concentrar ainda mais decisões. O mesmo acontece se mudarem as regras de adicional noturno ou o canal de notificação.
> - **Testes acoplados à infraestrutura:** para testar uma validação, pode ser necessário preparar ou simular também repositório e serviço de e-mail, embora eles não façam parte daquela regra.
> - **Mais risco a cada alteração:** uma mudança aparentemente localizada pode afetar o fluxo inteiro, que também salva dados e envia notificações.
>
> É aqui que **SRP** ajuda a separar motivos diferentes para mudar e **OCP** ajuda a incluir novas regras sem precisar reescrever o fluxo central a cada vez.

---

## 1. Single Responsibility (SRP) e Open/Closed (OCP) na Prática

Para reduzir esse acoplamento sem criar uma teia ininteligível de código, podemos aplicar **SRP** (Responsabilidade Única) e **OCP** (Aberto/Fechado) em etapas: primeiro isolamos as validações; depois permitimos acrescentar regras sem alterar o processador central.

### Refatorando com o Princípio da Responsabilidade Única (SRP)

Isolamos a responsabilidade de validação de regras trabalhistas em um componente especializado e extensível:

```java file="ShiftValidationRule.java"
public interface ShiftValidationRule {
    void validate(ShiftData shift);
}

@Component
public class MaxDrivingTimeRule implements ShiftValidationRule {
    @Override
    public void validate(ShiftData shift) {
        if (shift.getContinuousDrivingMinutes() > 240) {
            throw new IllegalArgumentException("Motorista excedeu o tempo máximo de direção contínua.");
        }
    }
}

@Component
public class MandatoryRestBreakRule implements ShiftValidationRule {
    @Override
    public void validate(ShiftData shift) {
        if (shift.getRestBreakMinutes() < 30) {
            throw new IllegalArgumentException("Intervalo de descanso intrajornada insuficiente.");
        }
    }
}
```

### Aplicando o Open/Closed Principle (OCP) com Spring Boot

Agora, a classe de processamento depende de uma lista de regras injetadas automaticamente pelo Spring. Se amanhã uma nova lei trabalhista exigir a regra de _Descanso Interjornada de 11h_, basta criar uma nova classe que implementa `ShiftValidationRule`. **Nenhuma linha do serviço principal precisa ser tocada.**

```java file="DriverScheduleProcessor.java"
@Service
public class DriverScheduleProcessor {

    private final List<ShiftValidationRule> validationRules;
    private final ShiftRepository shiftRepository;

    // Spring injeta automaticamente todas as implementações da interface
    public DriverScheduleProcessor(List<ShiftValidationRule> validationRules, ShiftRepository shiftRepository) {
        this.validationRules = validationRules;
        this.shiftRepository = shiftRepository;
    }

    public void processShift(Long driverId, ShiftData shift) {
        // Valida todas as regras sem saber quais são
        validationRules.forEach(rule -> rule.validate(shift));

        shiftRepository.save(driverId, shift);
    }
}
```

> [!SUCCESS]
> **Resultado:** O sistema tornou-se modular. Testes unitários para regras de jornada agora testam apenas a regra específica, eliminando mocks gigantescos do serviço principal.

---

## 2. As Outras Letras na Trincheira (L, I, D)

Embora o **S** e o **O** façam o trabalho pesado em sistemas de domínio denso, as outras três letras garantem a integridade da arquitetura.

### Liskov Substitution Principle (LSP)

_Subclasses devem poder ser substituídas por seus tipos de base sem quebrar o sistema._

Em sistemas de transporte, temos diferentes perfis de funcionários: **Motorista Urbano**, **Motorista Rodoviário** e **Fiscal de Terminal**. Se `FiscalTerminal` herdar de `Driver` mas lançar exceções ao tentar executar métodos como `checkDriverLicense()`, o princípio de Liskov foi violado.

> [!TIP]
> **Solução:** Prefira composição ou hierarquias de interfaces coesas em vez de herança de classes concretas para reaproveitamento de código.

### Interface Segregation Principle (ISP)

_Nenhum cliente deve ser forçado a depender de métodos que não utiliza._

Evite interfaces "gordas":

```java
// ❌ Interface poluída e gorda
public interface TransportWorkerOperations {
    void driveRoute();
    void validateTickets();
    void inspectVehicle();
    void generateReliefReport();
}

// ✅ Interfaces segregadas e focadas
public interface Driveable {
    void driveRoute();
}

public interface VehicleInspectable {
    void inspectVehicle();
}
```

### Dependency Inversion Principle (DIP)

_Módulos de alto nível não devem depender de módulos de baixo nível. Ambos devem depender de abstrações._

Esta é a essência da Injeção de Dependência que usamos diariamente com o Spring Framework. Ao programar para a interface `ShiftRepository` em vez da classe concreta `JpaShiftRepositoryAdapter`, tornamos nosso código totalmente desacoplado da tecnologia de banco de dados e trivial de testar com mocks via `Mockito`.

---

## O Outro Lado da Moeda: O Perigo do Over-Engineering

A teoria é linda, mas a prática exige bom senso. O maior erro de desenvolvedores ao aprenderem SOLID é tentar aplicar todos os 5 princípios em **qualquer trecho de código**, independentemente da sua complexidade.

### O caso da formatação de horários

Imagine que você precisa converter minutos trabalhados no formato de exibição da interface de usuário (`HH:mm`).

Um desenvolvedor tomado pelo "dogma do SOLID" poderia escrever isto:

```java
// ❌ OVER-ENGINEERING: 3 arquivos para converter minutos em String
public interface TimeFormatterStrategy {
    String format(int minutes);
}

@Component
public class StandardTimeFormatter implements TimeFormatterStrategy {
    @Override
    public String format(int minutes) {
        return String.format("%02d:%02d", minutes / 60, minutes % 60);
    }
}

@Component
public class TimeFormatterFactory {
    public TimeFormatterStrategy getFormatter(String type) { ... }
}
```

Para uma função utilitária pura de conversão de tempo, isso é **complexidade acidental**. Um método estático simples e puro resolve o problema com 100% de clareza:

```java
// ✅ SIMPLES E EFICIENTE
public final class DateUtils {
    private DateUtils() {}

    public static String formatMinutesToHours(int minutes) {
        return String.format("%02d:%02d", minutes / 60, minutes % 60);
    }
}
```

> [!DANGER]
> **A Armadilha:** Criar abstrações prematuras aumenta a quantidade de arquivos no projeto, dificulta a navegação (`Ctrl + Click` vai para a interface e não para o código real) e torna o onboarding de novos devs desnecessariamente lento.

---

## Tabela Comparativa: Quando Aplicar?

| Cenário                                                                  | Aplicar SOLID com Rigor? | Motivo                                                                                                        |
| :----------------------------------------------------------------------- | :----------------------- | :------------------------------------------------------------------------------------------------------------ |
| **Regras de Negócio Voláteis** (ex: Leis trabalhistas, cálculo de frete) | **SIM**                  | As regras mudam com frequência. O isolamento previne quebras em cascata.                                      |
| **Integrações Externas** (ex: Gateways de pagamento, APIs de mapas)      | **SIM**                  | Isolar a infraestrutura permite trocar o provedor sem impactar o domínio.                                     |
| **Scripts e Utilitários Internos**                                       | **NÃO**                  | Código simples e de escopo fechado não se beneficia de abstrações abstratas.                                  |
| **DTOs, Mappers e Módulos CRUD Simples**                                 | **NÃO**                  | Aplicar padrões complexos em operações básicas de consulta adiciona burocracia sem ganho de manutenibilidade. |

---

## Conclusão

O SOLID não é um manual de regras dogmáticas que devem ser seguidas sob pena de excomunhão arquitetural. **SOLID é uma ferramenta de gestão do custo da mudança.**

1. Aplique **SRP** e **OCP** onde o negócio muda frequentemente ou onde a complexidade é inerente ao domínio (como em escalas e otimizações).
2. Use **DIP** para manter seu software testável e desacoplado de frameworks e bancos.
3. **Tenha coragem de manter o código simples** em utilitários e fluxos lineares.

Antes de criar mais uma interface ou classe abstrata no seu projeto, faça a pergunta definitiva: _Esta abstração está simplificando uma mudança futura real ou apenas satisfazendo o meu ego de desenvolvedor?_

---

_Gostou do artigo ou tem uma visão diferente sobre a aplicação de padrões em Java? Sinta-se à vontade para conectar e trocar uma ideia!_
